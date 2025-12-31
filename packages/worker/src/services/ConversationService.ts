import { Effect, Context, Layer } from "effect"
import { eq, desc } from "drizzle-orm"
import type { CoreMessage } from "ai"
import { DatabaseError } from "@human-action-bot/shared"
import { DrizzleTag } from "../db/DrizzleLive"
import { conversations } from "../db/schema"
import type { StudentId, ChapterNumber, MessageRole } from "@human-action-bot/shared"

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

// ConversationService implementation using Drizzle
export const ConversationServiceLive = Layer.effect(
  ConversationServiceTag,
  Effect.gen(function* () {
    const db = yield* DrizzleTag

    const getHistory = (
      studentId: number,
      limit = 20
    ): Effect.Effect<CoreMessage[], DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ role: conversations.role, content: conversations.content })
            .from(conversations)
            .where(eq(conversations.studentId, studentId as StudentId))
            .orderBy(desc(conversations.createdAt))
            .limit(limit)
            .all()

          // Reverse to get chronological order
          const messages: CoreMessage[] = rows
            .reverse()
            .map((row) => ({
              role: row.role as "user" | "assistant",
              content: row.content
            }))

          return messages
        },
        catch: (error) => new DatabaseError({ message: "Failed to get conversation history", cause: error })
      })

    const addMessage = (
      studentId: number,
      role: "user" | "assistant",
      content: string,
      chapterContext?: number
    ): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          await db
            .insert(conversations)
            .values({
              studentId: studentId as StudentId,
              role: role as MessageRole,
              content,
              chapterContext: chapterContext !== undefined ? chapterContext as ChapterNumber : null
            })
            .run()
        },
        catch: (error) => new DatabaseError({ message: "Failed to add message", cause: error })
      })

    const clearHistory = (studentId: number): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          await db
            .delete(conversations)
            .where(eq(conversations.studentId, studentId as StudentId))
            .run()
        },
        catch: (error) => new DatabaseError({ message: "Failed to clear history", cause: error })
      })

    const getRecentContext = (
      studentId: number,
      limit = 5
    ): Effect.Effect<string, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ role: conversations.role, content: conversations.content })
            .from(conversations)
            .where(eq(conversations.studentId, studentId as StudentId))
            .orderBy(desc(conversations.createdAt))
            .limit(limit)
            .all()

          // Format as context string
          const context = rows
            .reverse()
            .map((row) => `${row.role}: ${row.content}`)
            .join("\n")

          return context
        },
        catch: (error) => new DatabaseError({ message: "Failed to get recent context", cause: error })
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
