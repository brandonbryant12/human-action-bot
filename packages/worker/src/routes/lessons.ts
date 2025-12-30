import { Hono } from "hono"
import { Effect } from "effect"
import type { CloudflareEnv } from "../lib/effect-runtime"
import { makeEnvLayer } from "../lib/effect-runtime"
import { LessonServiceTag, LessonServiceLive } from "../services/LessonService"
import { ComprehensionServiceTag, ComprehensionServiceLive } from "../services/ComprehensionService"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { AIServiceLive } from "../services/AIService"
import { RAGServiceLive } from "../services/RAGService"

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

    const student = yield* studentService.getByUserId(userId)
    if (!student) {
      yield* Effect.fail(new Error("Student not found"))
    }

    return yield* lessonService.generateLesson(student!)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(LessonServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(AIServiceLive),
        Effect.provide(RAGServiceLive),
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

    const student = yield* studentService.getByUserId(body.userId)
    if (!student) {
      yield* Effect.fail(new Error("Student not found"))
    }

    const result = yield* comprehensionService.assessAnswer(
      student!,
      body.question,
      body.answer,
      body.chapterContext ?? "",
      body.expectedConcepts ?? []
    )

    // Update student progress
    yield* comprehensionService.updateStudentProgress(student!, result.score)

    return result
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(ComprehensionServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(AIServiceLive),
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

export default lessonRoutes
