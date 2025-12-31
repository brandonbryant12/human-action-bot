import { Hono } from "hono"
import { Effect } from "effect"
import type { CloudflareEnv } from "../lib/effect-runtime"
import { makeEnvLayer } from "../lib/effect-runtime"
import { DrizzleLive } from "../db/DrizzleLive"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { LessonServiceTag, LessonServiceLive } from "../services/LessonService"
import { AdaptivePacingServiceTag, AdaptivePacingServiceLive } from "../services/AdaptivePacingService"
import { AIServiceLive } from "../services/AIService"
import { RAGServiceLive } from "../services/RAGService"

type Bindings = CloudflareEnv

const progressRoutes = new Hono<{ Bindings: Bindings }>()

// Get student progress
progressRoutes.get("/", async (c) => {
  const userId = c.req.query("userId")

  if (!userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const lessonService = yield* LessonServiceTag
    const pacingService = yield* AdaptivePacingServiceTag

    // Get or create student
    let student = yield* studentService.getByUserId(userId)
    if (!student) {
      student = yield* studentService.create({ userId })
    }

    const recentLessons = yield* lessonService.getRecentLessons(student.id, 10)
    const pacingRecommendation = yield* pacingService.calculatePacing(student)

    return {
      student: {
        userId: student.userId,
        currentChapter: student.currentChapter,
        currentChunk: student.currentChunk,
        totalLessonsCompleted: student.totalLessonsCompleted,
        averageComprehensionScore: student.averageComprehensionScore,
        paceMultiplier: student.paceMultiplier,
        createdAt: student.createdAt
      },
      recentLessons: recentLessons.map((lesson) => ({
        chapterNumber: lesson.chapterNumber,
        lessonType: lesson.lessonType,
        comprehensionScore: lesson.comprehensionScore,
        completedAt: lesson.completedAt
      })),
      pacing: pacingRecommendation
    }
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(AdaptivePacingServiceLive),
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
    console.error("Progress error:", error)
    return c.json(
      { error: "Failed to get progress", details: String(error) },
      500
    )
  }
})

// Create or update student
progressRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    userId: string
    telegramChatId?: string
    displayName?: string
  }>()

  if (!body.userId) {
    return c.json({ error: "userId is required" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag

    // Check if student exists
    const existing = yield* studentService.getByUserId(body.userId)

    if (existing) {
      // Update if provided
      if (body.displayName) {
        return yield* studentService.update(body.userId, {
          displayName: body.displayName
        })
      }
      return existing
    }

    // Create new student
    const input: { userId: string; telegramChatId?: string; displayName?: string } = {
      userId: body.userId
    }
    if (body.telegramChatId) input.telegramChatId = body.telegramChatId
    if (body.displayName) input.displayName = body.displayName

    return yield* studentService.create(input)
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(StudentServiceLive),
        Effect.provide(DrizzleLive),
        Effect.provide(envLayer)
      )
    )
    return c.json(result)
  } catch (error) {
    console.error("Create student error:", error)
    return c.json(
      { error: "Failed to create/update student", details: String(error) },
      500
    )
  }
})

export default progressRoutes
