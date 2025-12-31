import { Hono } from "hono"
import { Effect } from "effect"
import type { CloudflareEnv } from "../lib/effect-runtime"
import { makeEnvLayer } from "../lib/effect-runtime"
import { DrizzleLive } from "../db/DrizzleLive"
import {
  TelegramServiceTag,
  TelegramServiceLive,
  type InlineKeyboardMarkup
} from "../services/TelegramService"
import type { TelegramUpdate } from "../services/TelegramService"
import { ChatServiceTag, ChatServiceLive } from "../services/ChatService"
import { LessonServiceLive } from "../services/LessonService"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { AIServiceLive } from "../services/AIService"
import { RAGServiceLive } from "../services/RAGService"
import { ConversationServiceLive } from "../services/ConversationService"
import {
  LessonSessionServiceTag,
  LessonSessionServiceLive,
  type LessonStep
} from "../services/LessonSessionService"

type Bindings = CloudflareEnv

const telegramRoutes = new Hono<{ Bindings: Bindings }>()

// Help message
const HELP_MESSAGE = `*Human Action Bot*

I'm your AI tutor for Ludwig von Mises' "Human Action"!

*Commands:*
/start - Start your learning journey
/lesson - Start an interactive lesson
/progress - View your learning progress
/news - Analyze current events through Austrian economics
/help - Show this help message

Just send me any message to chat about Austrian economics!`

// Build keyboard for a lesson step
function buildLessonKeyboard(step: LessonStep): InlineKeyboardMarkup | undefined {
  switch (step.action.type) {
    case "continue":
      return {
        inline_keyboard: [
          [
            { text: "Continue →", callback_data: "lesson_continue" },
            { text: "Skip ⏭", callback_data: "lesson_skip" }
          ]
        ]
      }
    case "answer_question":
      return {
        inline_keyboard: [
          [{ text: "Skip this question ⏭", callback_data: "lesson_skip" }]
        ]
      }
    case "rate":
      return {
        inline_keyboard: [
          [
            { text: "1 ⭐", callback_data: "lesson_rate_1" },
            { text: "2 ⭐", callback_data: "lesson_rate_2" },
            { text: "3 ⭐", callback_data: "lesson_rate_3" },
            { text: "4 ⭐", callback_data: "lesson_rate_4" },
            { text: "5 ⭐", callback_data: "lesson_rate_5" }
          ],
          [{ text: "Skip feedback", callback_data: "lesson_continue" }]
        ]
      }
    case "complete":
      return {
        inline_keyboard: [
          [{ text: "Start New Lesson 📚", callback_data: "lesson_start" }]
        ]
      }
    default:
      return undefined
  }
}

// Format step content for Telegram
function formatStepMessage(step: LessonStep): string {
  const progressBar = `[${step.progress.current}/${step.progress.total}]`
  let message = `📚 *${step.lessonTitle}* ${progressBar}\n`
  message += `_${step.lessonType} lesson_\n\n`

  if (step.phase === "comprehension" && step.question) {
    message += `📝 *Question ${step.question.index}/${step.question.total}*\n\n`
    message += `${step.question.text}\n\n`
    message += `_Reply with your answer, or tap Skip._`
  } else if (step.action.type === "answer_question") {
    message += `${step.content}\n\n`
    message += `💭 *${step.action.questionText}*\n\n`
    message += `_Reply with your thoughts, or tap Skip._`
  } else if (step.action.type === "rate") {
    message += `✅ *Lesson Complete!*\n\n`
    message += `${step.content}\n\n`
    message += `_Rate this lesson to help us improve:_`
  } else if (step.action.type === "complete") {
    message += `🎉 *Congratulations!*\n\n`
    message += step.content
  } else {
    message += step.content
  }

  return message
}

// Helper to run with all telegram layers
const runWithTelegramLayers = <A, E>(
  program: Effect.Effect<A, E, any>,
  envLayer: ReturnType<typeof makeEnvLayer>
) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(TelegramServiceLive),
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

// Handle Telegram webhook
telegramRoutes.post("/webhook", async (c) => {
  const update = await c.req.json<TelegramUpdate>()
  const envLayer = makeEnvLayer(c.env)

  // Handle callback queries (button presses)
  if (update.callback_query) {
    const query = update.callback_query
    const chatId = query.message?.chat.id
    const messageId = query.message?.message_id
    const data = query.data ?? ""
    const userId = `telegram_${query.from.id}`

    if (!chatId || !messageId) {
      return c.json({ ok: true })
    }

    const program = Effect.gen(function* () {
      const telegramService = yield* TelegramServiceTag
      const sessionService = yield* LessonSessionServiceTag

      // Answer the callback immediately
      yield* telegramService.answerCallbackQuery(query.id)

      if (data === "lesson_start") {
        yield* telegramService.sendTypingAction(chatId)
        const step = yield* sessionService.startLesson(userId)
        yield* telegramService.sendMessage(
          chatId,
          formatStepMessage(step),
          { parseMode: "Markdown", replyMarkup: buildLessonKeyboard(step) }
        )
      } else if (data === "lesson_continue" || data === "lesson_skip") {
        yield* telegramService.sendTypingAction(chatId)
        const step = yield* sessionService.continueLesson(userId)
        yield* telegramService.sendMessage(
          chatId,
          formatStepMessage(step),
          { parseMode: "Markdown", replyMarkup: buildLessonKeyboard(step) }
        )
      } else if (data.startsWith("lesson_rate_")) {
        const rating = parseInt(data.replace("lesson_rate_", ""), 10)
        yield* sessionService.submitFeedback(userId, rating)
        yield* telegramService.sendMessage(
          chatId,
          `✅ Thank you for rating this lesson ${rating}/5!\n\nUse /lesson to start your next lesson, or just send me a message to chat.`,
          { parseMode: "Markdown" }
        )
      }
    })

    try {
      await runWithTelegramLayers(program, envLayer)
    } catch (error) {
      console.error("Telegram callback error:", error)
    }

    return c.json({ ok: true })
  }

  // Handle regular messages
  if (update.message) {
    const message = update.message
    const chatId = message.chat.id
    const userId = `telegram_${message.from?.id ?? chatId}`

    const program = Effect.gen(function* () {
      const telegramService = yield* TelegramServiceTag
      const studentService = yield* StudentServiceTag
      const chatService = yield* ChatServiceTag
      const sessionService = yield* LessonSessionServiceTag

      // Parse command if present
      const command = telegramService.parseCommand(message)

      // Get or create student
      const student = yield* chatService.getOrCreateStudent(userId, String(chatId))

      // Send typing indicator
      yield* telegramService.sendTypingAction(chatId)

      if (command) {
        switch (command.command) {
          case "start": {
            yield* telegramService.sendMessage(
              chatId,
              `Welcome to the Human Action Bot, ${command.firstName}! 📚\n\n` +
                "I'm here to guide you through Ludwig von Mises' masterwork on economics.\n\n" +
                "Use /lesson to start an interactive lesson, or just send me a message to chat about Austrian economics!",
              { parseMode: "Markdown" }
            )
            break
          }

          case "lesson": {
            const step = yield* sessionService.startLesson(userId)
            yield* telegramService.sendMessage(
              chatId,
              formatStepMessage(step),
              { parseMode: "Markdown", replyMarkup: buildLessonKeyboard(step) }
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
              const response = yield* chatService.chat({
                userId,
                message: `Analyze this news from an Austrian economics perspective: ${command.args}`
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
        // Check if there's an active lesson session expecting an answer
        const session = yield* sessionService.getSession(userId)

        if (session && (session.currentPhase === "comprehension" ||
            (session.currentPhase === "body" &&
             (session.currentSectionIndex + 1) % 2 === 0))) {
          // User is answering a lesson question
          const answerResult = yield* sessionService.answerQuestion(userId, message.text)

          let responseText = `💬 *Tutor's Response:*\n\n${answerResult.feedback}`

          if (!answerResult.hasFollowUp) {
            // Move to next step
            responseText += `\n\n---`
          }

          yield* telegramService.sendMessage(chatId, responseText, {
            parseMode: "Markdown"
          })

          if (!answerResult.hasFollowUp) {
            // Send next step
            yield* telegramService.sendMessage(
              chatId,
              formatStepMessage(answerResult.nextStep),
              { parseMode: "Markdown", replyMarkup: buildLessonKeyboard(answerResult.nextStep) }
            )
          }
        } else {
          // Regular chat message
          const response = yield* chatService.chat({
            userId,
            message: message.text
          })
          yield* telegramService.sendMessage(chatId, response.message)
        }
      }
    })

    try {
      await runWithTelegramLayers(program, envLayer)
    } catch (error) {
      console.error("Telegram webhook error:", error)
    }
  }

  // Always return OK to Telegram
  return c.json({ ok: true })
})

export default telegramRoutes
