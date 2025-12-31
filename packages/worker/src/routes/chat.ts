import { Hono } from "hono"
import { Effect } from "effect"
import type { CloudflareEnv } from "../lib/effect-runtime"
import { makeEnvLayer } from "../lib/effect-runtime"
import { DrizzleLive } from "../db/DrizzleLive"
import { ChatServiceTag, ChatServiceLive } from "../services/ChatService"
import { AIServiceLive } from "../services/AIService"
import { RAGServiceLive } from "../services/RAGService"
import { ConversationServiceLive } from "../services/ConversationService"
import { StudentServiceLive } from "../services/StudentService"

type Bindings = CloudflareEnv

const chatRoutes = new Hono<{ Bindings: Bindings }>()

// Chat endpoint
chatRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    userId: string
    message: string
    useRag?: boolean
  }>()

  if (!body.userId || !body.message) {
    return c.json({ error: "userId and message are required" }, 400)
  }

  const program = Effect.gen(function* () {
    const chatService = yield* ChatServiceTag
    return yield* chatService.chat({
      userId: body.userId,
      message: body.message,
      useRag: body.useRag ?? true
    })
  })

  const envLayer = makeEnvLayer(c.env)

  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(ChatServiceLive),
        Effect.provide(AIServiceLive),
        Effect.provide(RAGServiceLive),
        Effect.provide(ConversationServiceLive),
        Effect.provide(StudentServiceLive),
        Effect.provide(DrizzleLive),
        Effect.provide(envLayer)
      )
    )
    return c.json(result)
  } catch (error) {
    console.error("Chat error:", error)
    return c.json(
      { error: "Failed to process chat request", details: String(error) },
      500
    )
  }
})

export default chatRoutes
