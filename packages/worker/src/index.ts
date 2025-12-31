import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { Effect } from "effect"
import type { CloudflareEnv } from "./lib/effect-runtime"
import { makeEnvLayer } from "./lib/effect-runtime"
import { DrizzleLive } from "./db/DrizzleLive"
import chatRoutes from "./routes/chat"
import lessonRoutes from "./routes/lessons"
import progressRoutes from "./routes/progress"
import telegramRoutes from "./routes/telegram"
import { NewsServiceTag, NewsServiceLive } from "./services/NewsService"
import { StudentServiceTag, StudentServiceLive } from "./services/StudentService"
import { AIServiceLive } from "./services/AIService"
import { RAGServiceLive } from "./services/RAGService"

type Bindings = CloudflareEnv

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use("*", logger())
app.use("*", cors())

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT ?? "development"
  })
})

// Root route
app.get("/", (c) => {
  return c.json({
    name: "Human Action Bot",
    description: "AI tutor for Ludwig von Mises' Human Action",
    version: c.env.TUTOR_VERSION ?? "1.0.0",
    model: c.env.MODEL_NAME ?? "gemini-2.5-flash",
    endpoints: {
      health: "/health",
      chat: "/chat",
      lesson: "/lesson",
      progress: "/progress",
      feedback: "/feedback",
      news: "/news",
      telegram: "/telegram/webhook"
    }
  })
})

// Version info endpoint
app.get("/version", (c) => {
  return c.json({
    tutorVersion: c.env.TUTOR_VERSION ?? "1.0.0",
    modelName: c.env.MODEL_NAME ?? "gemini-2.5-flash",
    environment: c.env.ENVIRONMENT ?? "development"
  })
})

// Mount routes
app.route("/chat", chatRoutes)
app.route("/lesson", lessonRoutes)
app.route("/progress", progressRoutes)
app.route("/telegram", telegramRoutes)

// Feedback endpoint
app.post("/feedback", async (c) => {
  const body = await c.req.json<{
    userId: string
    feedbackType: "lesson" | "chat" | "overall"
    rating: number
    comment?: string
    lessonId?: string
    chapterNumber?: number
    clientType?: string
  }>()

  if (!body.userId || !body.feedbackType || !body.rating) {
    return c.json({ error: "userId, feedbackType, and rating are required" }, 400)
  }

  if (body.rating < 1 || body.rating > 5) {
    return c.json({ error: "rating must be between 1 and 5" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const student = yield* studentService.getByUserId(body.userId)

    if (!student) {
      yield* Effect.fail(new Error("Student not found"))
    }

    // Insert feedback directly using D1
    const db = c.env.human_action_db
    yield* Effect.promise(() =>
      db.prepare(`
        INSERT INTO feedback (student_id, feedback_type, rating, comment, lesson_id, chapter_number, tutor_version, model_name, model_version, client_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        student!.id,
        body.feedbackType,
        body.rating,
        body.comment ?? null,
        body.lessonId ?? null,
        body.chapterNumber ?? null,
        c.env.TUTOR_VERSION ?? "1.0.0",
        c.env.MODEL_NAME ?? "gemini-2.5-flash",
        null, // model_version for future use
        body.clientType ?? "cli"
      ).run()
    )

    return { success: true, message: "Thank you for your feedback!" }
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
    console.error("Feedback error:", error)
    return c.json(
      { error: "Failed to submit feedback", details: String(error) },
      500
    )
  }
})

// News/current events routes
app.get("/news", async (c) => {
  return c.json({
    message: "POST to /news with { content: string } to analyze a news item"
  })
})

app.post("/news", async (c) => {
  const body = await c.req.json<{
    userId: string
    content: string
    source?: string
    url?: string
  }>()

  if (!body.userId || !body.content) {
    return c.json({ error: "userId and content are required" }, 400)
  }

  const program = Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const newsService = yield* NewsServiceTag

    const student = yield* studentService.getByUserId(body.userId)
    if (!student) {
      yield* Effect.fail(new Error("Student not found"))
    }

    return yield* newsService.analyzeNews(student!, {
      content: body.content,
      source: body.source,
      url: body.url
    })
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(NewsServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(AIServiceLive),
        Effect.provide(RAGServiceLive),
        Effect.provide(DrizzleLive),
        Effect.provide(envLayer)
      )
    )
    return c.json(result)
  } catch (error) {
    console.error("News analysis error:", error)
    return c.json(
      { error: "Failed to analyze news", details: String(error) },
      500
    )
  }
})

// Scheduled handler for daily lessons
const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (
  event,
  _env,
  _ctx
) => {
  console.log("Running scheduled lesson trigger:", event.cron)
  // TODO: Implement daily lesson delivery to all students
}

export default {
  fetch: app.fetch,
  scheduled
}
