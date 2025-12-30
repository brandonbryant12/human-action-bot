import { Effect, Context, Layer } from "effect"
import { AIServiceTag } from "./AIService"
import { RAGServiceTag } from "./RAGService"
import { ConversationServiceTag } from "./ConversationService"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import { buildTutorPrompt } from "../prompts/tutor"
import { AIError, VectorizeError, DatabaseError } from "../lib/effect-runtime"

// Chat request
export interface ChatRequest {
  userId: string
  message: string
  useRag?: boolean
}

// Source type
export interface ChatSource {
  chapterId: string
  chapterTitle: string
  score: number
}

// Chat response
export interface ChatResponse {
  message: string
  sources: ChatSource[] | undefined
  usage: {
    promptTokens: number
    completionTokens: number
  } | undefined
}

// ChatService error type
export type ChatError = AIError | VectorizeError | DatabaseError

// ChatService interface
export interface ChatService {
  readonly chat: (request: ChatRequest) => Effect.Effect<ChatResponse, ChatError>
  readonly getOrCreateStudent: (userId: string, telegramChatId?: string) => Effect.Effect<Student, DatabaseError>
}

// ChatService Tag
export class ChatServiceTag extends Context.Tag("ChatService")<
  ChatServiceTag,
  ChatService
>() {}

// ChatService implementation
export const ChatServiceLive = Layer.effect(
  ChatServiceTag,
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag
    const ragService = yield* RAGServiceTag
    const conversationService = yield* ConversationServiceTag
    const studentService = yield* StudentServiceTag

    const getOrCreateStudent = (
      userId: string,
      telegramChatId?: string
    ): Effect.Effect<Student, DatabaseError> =>
      Effect.gen(function* () {
        const existing = yield* studentService.getByUserId(userId)
        if (existing) {
          return existing
        }

        const input: { userId: string; telegramChatId?: string } = { userId }
        if (telegramChatId !== undefined) {
          input.telegramChatId = telegramChatId
        }

        return yield* studentService.create(input)
      })

    const chat = (request: ChatRequest): Effect.Effect<ChatResponse, ChatError> =>
      Effect.gen(function* () {
        const { userId, message, useRag = true } = request

        // Get or create student
        const student = yield* getOrCreateStudent(userId)

        // Get conversation history
        const history = yield* conversationService.getHistory(student.id, 10)

        // Add user message to history
        yield* conversationService.addMessage(
          student.id,
          "user",
          message,
          student.currentChapter
        )

        // Build RAG context if enabled
        let ragContext = ""
        let sources: ChatSource[] | undefined

        if (useRag) {
          const ragResult = yield* ragService.search({
            query: message,
            topK: 3,
            minScore: 0.4
          })

          if (ragResult.chunks.length > 0) {
            ragContext = ragResult.chunks
              .map(
                (chunk) =>
                  `[From Chapter ${chunk.chapter}: ${chunk.chapterTitle}]\n${chunk.textPreview}`
              )
              .join("\n\n---\n\n")

            sources = ragResult.chunks.map((chunk) => ({
              chapterId: chunk.id,
              chapterTitle: chunk.chapterTitle,
              score: chunk.score
            }))
          }
        }

        // Build system prompt with context
        const chapterInfo = `The student is currently studying Chapter ${student.currentChapter} and has completed ${student.totalLessonsCompleted} lessons with an average comprehension of ${(student.averageComprehensionScore * 100).toFixed(0)}%.`

        const systemPrompt = buildTutorPrompt(ragContext, chapterInfo)

        // Add current message to history for the AI call
        const messagesWithCurrent = [
          ...history,
          { role: "user" as const, content: message }
        ]

        // Generate response
        const result = yield* aiService.generate({
          system: systemPrompt,
          messages: messagesWithCurrent
        })

        // Store assistant response
        yield* conversationService.addMessage(
          student.id,
          "assistant",
          result.text,
          student.currentChapter
        )

        return {
          message: result.text,
          sources,
          usage: {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens
          }
        }
      })

    return {
      chat,
      getOrCreateStudent
    }
  })
)

export const ChatServiceLayer = ChatServiceLive
