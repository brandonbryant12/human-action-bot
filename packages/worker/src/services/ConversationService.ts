import { Effect, Context, Layer } from "effect"
import type { CoreMessage } from "ai"
import { D1Database as D1DatabaseTag, DatabaseError } from "../lib/effect-runtime"

// Conversation message from database
interface ConversationRow {
  id: number
  student_id: number
  role: "user" | "assistant" | "system"
  content: string
  chapter_context: number | null
  created_at: string
}

// D1 types
interface D1Result<T> {
  results: T[]
  success: boolean
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1Result<T>>
  run(): Promise<{ success: boolean }>
}

// ConversationService interface
export interface ConversationService {
  readonly getHistory: (
    studentId: number,
    limit?: number
  ) => Effect.Effect<CoreMessage[], DatabaseError>
  readonly addMessage: (
    studentId: number,
    role: "user" | "assistant",
    content: string,
    chapterContext?: number
  ) => Effect.Effect<void, DatabaseError>
  readonly clearHistory: (studentId: number) => Effect.Effect<void, DatabaseError>
  readonly getRecentContext: (
    studentId: number,
    limit?: number
  ) => Effect.Effect<string, DatabaseError>
}

// ConversationService Tag
export class ConversationServiceTag extends Context.Tag("ConversationService")<
  ConversationServiceTag,
  ConversationService
>() {}

// ConversationService implementation
export const ConversationServiceLive = Layer.effect(
  ConversationServiceTag,
  Effect.gen(function* () {
    const db = yield* D1DatabaseTag

    const getHistory = (
      studentId: number,
      limit = 20
    ): Effect.Effect<CoreMessage[], DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          const result = await d1
            .prepare(
              `SELECT role, content FROM conversations
               WHERE student_id = ?
               ORDER BY created_at DESC
               LIMIT ?`
            )
            .bind(studentId, limit)
            .all<ConversationRow>()

          // Reverse to get chronological order
          const messages: CoreMessage[] = result.results
            .reverse()
            .map((row) => ({
              role: row.role as "user" | "assistant",
              content: row.content
            }))

          return messages
        },
        catch: (error) => new DatabaseError("Failed to get conversation history", error)
      })

    const addMessage = (
      studentId: number,
      role: "user" | "assistant",
      content: string,
      chapterContext?: number
    ): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          await d1
            .prepare(
              `INSERT INTO conversations (student_id, role, content, chapter_context)
               VALUES (?, ?, ?, ?)`
            )
            .bind(studentId, role, content, chapterContext ?? null)
            .run()
        },
        catch: (error) => new DatabaseError("Failed to add message", error)
      })

    const clearHistory = (studentId: number): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          await d1
            .prepare("DELETE FROM conversations WHERE student_id = ?")
            .bind(studentId)
            .run()
        },
        catch: (error) => new DatabaseError("Failed to clear history", error)
      })

    const getRecentContext = (
      studentId: number,
      limit = 5
    ): Effect.Effect<string, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          const result = await d1
            .prepare(
              `SELECT role, content FROM conversations
               WHERE student_id = ?
               ORDER BY created_at DESC
               LIMIT ?`
            )
            .bind(studentId, limit)
            .all<ConversationRow>()

          // Format as context string
          const context = result.results
            .reverse()
            .map((row) => `${row.role}: ${row.content}`)
            .join("\n")

          return context
        },
        catch: (error) => new DatabaseError("Failed to get recent context", error)
      })

    return {
      getHistory,
      addMessage,
      clearHistory,
      getRecentContext
    }
  })
)

export const ConversationServiceLayer = ConversationServiceLive
