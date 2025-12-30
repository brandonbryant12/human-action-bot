import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { Effect } from "effect"
import type { CloudflareEnv } from "./lib/effect-runtime"
import { makeEnvLayer } from "./lib/effect-runtime"
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
    version: "1.0.0",
    endpoints: {
      health: "/health",
      chat: "/chat",
      lesson: "/lesson",
      progress: "/progress",
      news: "/news",
      telegram: "/telegram/webhook"
    }
  })
})

// Mount routes
app.route("/chat", chatRoutes)
app.route("/lesson", lessonRoutes)
app.route("/progress", progressRoutes)
app.route("/telegram", telegramRoutes)

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
