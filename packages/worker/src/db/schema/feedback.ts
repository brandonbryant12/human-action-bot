import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import type { FeedbackId, StudentId, ChapterNumber, FeedbackType } from "@human-action-bot/shared"
import { students } from "./students"

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<FeedbackId>(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }).$type<StudentId>(),
  feedbackType: text("feedback_type").notNull().$type<FeedbackType>(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  lessonId: text("lesson_id"),
  chapterNumber: integer("chapter_number").$type<ChapterNumber | null>(),
  tutorVersion: text("tutor_version").notNull(),
  modelName: text("model_name").notNull(),
  modelVersion: text("model_version"),
  clientType: text("client_type").default("cli"),
  createdAt: text("created_at").default("datetime('now')")
}, (table) => [
  index("idx_feedback_student_id").on(table.studentId),
  index("idx_feedback_tutor_version").on(table.tutorVersion),
  index("idx_feedback_rating").on(table.rating)
])

export type FeedbackRow = typeof feedback.$inferSelect
export type InsertFeedback = typeof feedback.$inferInsert
