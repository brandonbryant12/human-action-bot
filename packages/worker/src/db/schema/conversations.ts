import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import type { ConversationId, StudentId, ChapterNumber, MessageRole } from "@human-action-bot/shared"
import { students } from "./students"

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<ConversationId>(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }).$type<StudentId>(),
  role: text("role").notNull().$type<MessageRole>(),
  content: text("content").notNull(),
  chapterContext: integer("chapter_context").$type<ChapterNumber | null>(),
  createdAt: text("created_at").default("datetime('now')")
}, (table) => [
  index("idx_conversations_student_id").on(table.studentId),
  index("idx_conversations_created_at").on(table.createdAt)
])

export type ConversationRow = typeof conversations.$inferSelect
export type InsertConversation = typeof conversations.$inferInsert
