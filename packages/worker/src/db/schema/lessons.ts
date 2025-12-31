import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"
import type { LessonHistoryId, StudentId, ChapterNumber, LessonType } from "@human-action-bot/shared"
import { students } from "./students"

export const lessonHistory = sqliteTable("lesson_history", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<LessonHistoryId>(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }).$type<StudentId>(),
  chapterNumber: integer("chapter_number").notNull().$type<ChapterNumber>(),
  chunkId: text("chunk_id").notNull(),
  lessonType: text("lesson_type").notNull().$type<LessonType>(),
  comprehensionScore: real("comprehension_score"),
  timeSpentSeconds: integer("time_spent_seconds"),
  questionsAsked: integer("questions_asked").default(0),
  completedAt: text("completed_at").default("datetime('now')")
}, (table) => [
  index("idx_lesson_history_student_id").on(table.studentId),
  index("idx_lesson_history_chapter").on(table.chapterNumber)
])

export type LessonHistoryRow = typeof lessonHistory.$inferSelect
export type InsertLessonHistory = typeof lessonHistory.$inferInsert
