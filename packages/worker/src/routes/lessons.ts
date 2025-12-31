import { Hono } from "hono"
import { Effect } from "effect"
import type { CloudflareEnv } from "../lib/effect-runtime"
import { makeEnvLayer } from "../lib/effect-runtime"
import { DrizzleLive } from "../db/DrizzleLive"
import { LessonServiceTag, LessonServiceLive } from "../services/LessonService"
import { ComprehensionServiceTag, ComprehensionServiceLive } from "../services/ComprehensionService"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { AIServiceLive } from "../services/AIService"
import { RAGServiceLive } from "../services/RAGService"
import { ChatServiceLive } from "../services/ChatService"
import { ConversationServiceLive } from "../services/ConversationService"
import {
  LessonSessionServiceTag,
  LessonSessionServiceLive
} from "../services/LessonSessionService"

type Bindings = CloudflareEnv

const lessonRoutes = new Hono<{ Bindings: Bindings }>()

// Get a new lesson for a student
lessonRoutes.get("/", async (c) => {
  const userId = c.req.query("userId")

  if (!userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const lessonService = yield* LessonServiceTag

    // Get or create student
    let student = yield* studentService.getByUserId(userId)
    if (!student) {
      student = yield* studentService.create({ userId })
    }

    return yield* lessonService.generateLesson(student)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(LessonServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(AIServiceLive),
        Effect.provide(RAGServiceLive),
        Effect.provide(DrizzleLive),
        Effect.provide(envLayer)
      )
    )
    return c.json(result)
  } catch (error) {
    console.error("Lesson error:", error)
    return c.json(
      { error: "Failed to generate lesson", details: String(error) },
      500
    )
  }
})

// Submit a comprehension answer
lessonRoutes.post("/comprehension", async (c) => {
  const body = await c.req.json<{
    userId: string
    lessonId: string
    question: string
    answer: string
    chapterContext?: string
    expectedConcepts?: string[]
  }>()

  if (!body.userId || !body.question || !body.answer) {
    return c.json({ error: "userId, question, and answer are required" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const comprehensionService = yield* ComprehensionServiceTag

    // Get or create student
    let student = yield* studentService.getByUserId(body.userId)
    if (!student) {
      student = yield* studentService.create({ userId: body.userId })
    }

    const result = yield* comprehensionService.assessAnswer(
      student,
      body.question,
      body.answer,
      body.chapterContext ?? "",
      body.expectedConcepts ?? []
    )

    // Update student progress
    yield* comprehensionService.updateStudentProgress(student, result.score)

    return result
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(ComprehensionServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(AIServiceLive),
        Effect.provide(DrizzleLive),
        Effect.provide(envLayer)
      )
    )
    return c.json(result)
  } catch (error) {
    console.error("Comprehension error:", error)
    return c.json(
      { error: "Failed to assess comprehension", details: String(error) },
      500
    )
  }
})

// Complete a lesson and record progress
lessonRoutes.post("/complete", async (c) => {
  const body = await c.req.json<{
    userId: string
    lessonId: string
    chapter: number
    chunkId: string
    lessonType: string
    comprehensionScore?: number
    timeSpentSeconds?: number
    questionsAsked?: number
  }>()

  if (!body.userId || !body.lessonId) {
    return c.json({ error: "userId and lessonId are required" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const lessonService = yield* LessonServiceTag

    // Get or create student
    let student = yield* studentService.getByUserId(body.userId)
    if (!student) {
      student = yield* studentService.create({ userId: body.userId })
    }

    // Record lesson history
    yield* lessonService.recordLessonHistory(
      student.id,
      {
        id: body.lessonId,
        type: (body.lessonType || "intro") as "intro" | "deep_dive" | "application" | "review",
        chapter: body.chapter,
        chunkId: body.chunkId || `ch${body.chapter}_chunk000`,
        title: `Chapter ${body.chapter}`,
        content: "",
        questions: [],
        estimatedMinutes: 10
      },
      body.comprehensionScore ?? 0.7,
      body.timeSpentSeconds ?? 600,
      body.questionsAsked ?? 0
    )

    // Update student progress
    yield* studentService.recordLessonComplete(
      body.userId,
      body.comprehensionScore ?? 0.7
    )

    return { success: true, message: "Lesson completed" }
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(LessonServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(AIServiceLive),
        Effect.provide(RAGServiceLive),
        Effect.provide(DrizzleLive),
        Effect.provide(envLayer)
      )
    )
    return c.json(result)
  } catch (error) {
    console.error("Lesson complete error:", error)
    return c.json(
      { error: "Failed to complete lesson", details: String(error) },
      500
    )
  }
})

// ============================================
// Interactive Lesson Session Endpoints
// These provide a unified interface for CLI and Telegram
// ============================================

// Helper to run with all session layers
const runWithSessionLayers = <A, E>(
  program: Effect.Effect<A, E, any>,
  envLayer: ReturnType<typeof makeEnvLayer>
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(LessonSessionServiceLive),
      Effect.provide(ChatServiceLive),
      Effect.provide(LessonServiceLive),
      Effect.provide(StudentServiceLive),
      Effect.provide(AIServiceLive),
      Effect.provide(RAGServiceLive),
      Effect.provide(ConversationServiceLive),
      Effect.provide(DrizzleLive),
      Effect.provide(envLayer)
    )
  )

// Start a new interactive lesson session
lessonRoutes.post("/session/start", async (c) => {
  const body = await c.req.json<{ userId: string }>()

  if (!body.userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const sessionService = yield* LessonSessionServiceTag
    return yield* sessionService.startLesson(body.userId)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const step = await runWithSessionLayers(program, envLayer)
    return c.json(step)
  } catch (error) {
    console.error("Session start error:", error)
    return c.json({ error: "Failed to start lesson", details: String(error) }, 500)
  }
})

// Continue to next section
lessonRoutes.post("/session/continue", async (c) => {
  const body = await c.req.json<{ userId: string }>()

  if (!body.userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const sessionService = yield* LessonSessionServiceTag
    return yield* sessionService.continueLesson(body.userId)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const step = await runWithSessionLayers(program, envLayer)
    return c.json(step)
  } catch (error) {
    console.error("Session continue error:", error)
    return c.json({ error: "Failed to continue lesson", details: String(error) }, 500)
  }
})

// Answer a question
lessonRoutes.post("/session/answer", async (c) => {
  const body = await c.req.json<{ userId: string; answer: string }>()

  if (!body.userId || !body.answer) {
    return c.json({ error: "userId and answer are required" }, 400)
  }

  const program = Effect.gen(function* () {
    const sessionService = yield* LessonSessionServiceTag
    return yield* sessionService.answerQuestion(body.userId, body.answer)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const response = await runWithSessionLayers(program, envLayer)
    return c.json(response)
  } catch (error) {
    console.error("Session answer error:", error)
    return c.json({ error: "Failed to process answer", details: String(error) }, 500)
  }
})

// Skip current section/question
lessonRoutes.post("/session/skip", async (c) => {
  const body = await c.req.json<{ userId: string }>()

  if (!body.userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const sessionService = yield* LessonSessionServiceTag
    return yield* sessionService.skip(body.userId)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const step = await runWithSessionLayers(program, envLayer)
    return c.json(step)
  } catch (error) {
    console.error("Session skip error:", error)
    return c.json({ error: "Failed to skip", details: String(error) }, 500)
  }
})

// Submit feedback and complete lesson
lessonRoutes.post("/session/feedback", async (c) => {
  const body = await c.req.json<{
    userId: string
    rating: number
    comment?: string
  }>()

  if (!body.userId || !body.rating) {
    return c.json({ error: "userId and rating are required" }, 400)
  }

  const program = Effect.gen(function* () {
    const sessionService = yield* LessonSessionServiceTag
    return yield* sessionService.submitFeedback(body.userId, body.rating, body.comment)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const response = await runWithSessionLayers(program, envLayer)
    return c.json(response)
  } catch (error) {
    console.error("Session feedback error:", error)
    return c.json({ error: "Failed to submit feedback", details: String(error) }, 500)
  }
})

// Get current session state
lessonRoutes.get("/session", async (c) => {
  const userId = c.req.query("userId")

  if (!userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const sessionService = yield* LessonSessionServiceTag
    return yield* sessionService.getSession(userId)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const session = await runWithSessionLayers(program, envLayer)
    return c.json({ session })
  } catch (error) {
    console.error("Session get error:", error)
    return c.json({ error: "Failed to get session", details: String(error) }, 500)
  }
})

export default lessonRoutes
