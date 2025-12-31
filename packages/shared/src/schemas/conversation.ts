import { Schema as S } from "@effect/schema"
import {
  ConversationIdSchema,
  StudentIdSchema,
  ChapterNumberSchema,
  MessageRoleSchema
} from "./brands"

// Conversation message schema
export const ConversationSchema = S.Struct({
  id: ConversationIdSchema,
  studentId: StudentIdSchema,
  role: MessageRoleSchema,
  content: S.String,
  chapterContext: S.NullOr(ChapterNumberSchema),
  createdAt: S.String
})

export type Conversation = S.Schema.Type<typeof ConversationSchema>

// Message input for adding to conversation
export const AddMessageInputSchema = S.Struct({
  studentId: StudentIdSchema,
  role: S.Literal("user", "assistant"),
  content: S.String,
  chapterContext: S.optional(ChapterNumberSchema)
})

export type AddMessageInput = S.Schema.Type<typeof AddMessageInputSchema>
