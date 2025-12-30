import { Hono } from "hono"
import { Effect } from "effect"
import type { CloudflareEnv } from "../lib/effect-runtime"
import { makeEnvLayer } from "../lib/effect-runtime"
import {
  TelegramServiceTag,
  TelegramServiceLive
} from "../services/TelegramService"
import type { TelegramUpdate } from "../services/TelegramService"
import { ChatServiceTag, ChatServiceLive } from "../services/ChatService"
import { LessonServiceTag, LessonServiceLive } from "../services/LessonService"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { AIServiceLive } from "../services/AIService"
import { RAGServiceLive } from "../services/RAGService"
import { ConversationServiceLive } from "../services/ConversationService"

type Bindings = CloudflareEnv

const telegramRoutes = new Hono<{ Bindings: Bindings }>()

// Help message
const HELP_MESSAGE = `*Human Action Bot*

I'm your AI tutor for Ludwig von Mises' "Human Action"!

*Commands:*
/start - Start your learning journey
/lesson - Get today's lesson
/chat - Start a conversation about economics
/progress - View your learning progress
/news - Analyze current events through Austrian economics
/help - Show this help message

Just send me any message to chat about Austrian economics!`

// Handle Telegram webhook
telegramRoutes.post("/webhook", async (c) => {
  const update = await c.req.json<TelegramUpdate>()
  const envLayer = makeEnvLayer(c.env)

  // Handle message
  if (update.message) {
    const message = update.message
    const chatId = message.chat.id

    const program = Effect.gen(function* () {
      const telegramService = yield* TelegramServiceTag
      yield* StudentServiceTag // Ensure dependency is available
      const chatService = yield* ChatServiceTag
      const lessonService = yield* LessonServiceTag

      // Parse command if present
      const command = telegramService.parseCommand(message)

      // Get or create student
      const userId = `telegram_${message.from?.id ?? chatId}`
      const student = yield* chatService.getOrCreateStudent(
        userId,
        String(chatId)
      )

      // Send typing indicator
      yield* telegramService.sendTypingAction(chatId)

      if (command) {
        switch (command.command) {
          case "start": {
            yield* telegramService.sendMessage(
              chatId,
              `Welcome to the Human Action Bot, ${command.firstName}! 📚\n\n` +
                "I'm here to guide you through Ludwig von Mises' masterwork on economics.\n\n" +
                "Use /lesson to start learning, or just send me a message to chat about Austrian economics!",
              { parseMode: "Markdown" }
            )
            break
          }

          case "lesson": {
            const lesson = yield* lessonService.generateLesson(student)
            yield* telegramService.sendMessage(
              chatId,
              `📖 *${lesson.title}*\n\n${lesson.content}`,
              { parseMode: "Markdown" }
            )
            break
          }

          case "progress": {
            yield* telegramService.sendMessage(
              chatId,
              `📊 *Your Progress*\n\n` +
                `Current Chapter: ${student.currentChapter}\n` +
                `Lessons Completed: ${student.totalLessonsCompleted}\n` +
                `Comprehension Score: ${(student.averageComprehensionScore * 100).toFixed(0)}%\n` +
                `Learning Pace: ${student.paceMultiplier}x`,
              { parseMode: "Markdown" }
            )
            break
          }

          case "help": {
            yield* telegramService.sendMessage(chatId, HELP_MESSAGE, {
              parseMode: "Markdown"
            })
            break
          }

          case "news": {
            if (!command.args) {
              yield* telegramService.sendMessage(
                chatId,
                "Please provide a news topic or headline to analyze.\n\n" +
                  "Example: `/news Federal Reserve raises interest rates`",
                { parseMode: "Markdown" }
              )
            } else {
              // Handle news analysis through chat
              const response = yield* chatService.chat({
                userId,
                message: `Analyze this news from an Austrian economics perspective: ${command.args}`
              })
              yield* telegramService.sendMessage(chatId, response.message)
            }
            break
          }

          case "chat": {
            if (!command.args) {
              yield* telegramService.sendMessage(
                chatId,
                "What would you like to discuss about Human Action or Austrian economics?",
                { parseMode: "Markdown" }
              )
            } else {
              const response = yield* chatService.chat({
                userId,
                message: command.args
              })
              yield* telegramService.sendMessage(chatId, response.message)
            }
            break
          }

          default: {
            yield* telegramService.sendMessage(
              chatId,
              `Unknown command. Use /help to see available commands.`
            )
          }
        }
      } else if (message.text) {
        // Handle regular message as chat
        const response = yield* chatService.chat({
          userId,
          message: message.text
        })
        yield* telegramService.sendMessage(chatId, response.message)
      }
    })

    try {
      await Effect.runPromise(
        program.pipe(
          Effect.provide(TelegramServiceLive),
          Effect.provide(ChatServiceLive),
          Effect.provide(LessonServiceLive),
          Effect.provide(StudentServiceLive),
          Effect.provide(AIServiceLive),
          Effect.provide(RAGServiceLive),
          Effect.provide(ConversationServiceLive),
          Effect.provide(envLayer)
        )
      )
    } catch (error) {
      console.error("Telegram webhook error:", error)
      // Still return OK to Telegram
    }
  }

  // Always return OK to Telegram
  return c.json({ ok: true })
})

export default telegramRoutes
