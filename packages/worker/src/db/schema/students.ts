import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"
import type { StudentId, UserId, TelegramId, ChapterNumber, ChunkIndex, PaceMultiplier } from "@human-action-bot/shared"

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<StudentId>(),
  userId: text("user_id").notNull().unique().$type<UserId>(),
  telegramChatId: text("telegram_chat_id").$type<TelegramId | null>(),
  displayName: text("display_name"),
  currentChapter: integer("current_chapter").default(1).$type<ChapterNumber>(),
  currentChunk: integer("current_chunk").default(0).$type<ChunkIndex>(),
  paceMultiplier: real("pace_multiplier").default(1.0).$type<PaceMultiplier>(),
  totalLessonsCompleted: integer("total_lessons_completed").default(0),
  totalQuestionsAnswered: integer("total_questions_answered").default(0),
  averageComprehensionScore: real("average_comprehension_score").default(0.0),
  preferredLessonTime: text("preferred_lesson_time").default("08:00"),
  timezone: text("timezone").default("UTC"),
  createdAt: text("created_at").default("datetime('now')"),
  updatedAt: text("updated_at").default("datetime('now')")
}, (table) => [
  index("idx_students_user_id").on(table.userId),
  index("idx_students_telegram_chat_id").on(table.telegramChatId)
])

export type StudentRow = typeof students.$inferSelect
export type InsertStudent = typeof students.$inferInsert
