import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import type { StruggleLogId, StudentId, ChapterNumber } from "@human-action-bot/shared"
import { students } from "./students"

export const struggleLog = sqliteTable("struggle_log", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<StruggleLogId>(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }).$type<StudentId>(),
  chapterNumber: integer("chapter_number").notNull().$type<ChapterNumber>(),
  concept: text("concept").notNull(),
  struggleCount: integer("struggle_count").default(1),
  lastStruggledAt: text("last_struggled_at").default("datetime('now')"),
  resolved: integer("resolved", { mode: "boolean" }).default(false),
  resolutionNotes: text("resolution_notes")
}, (table) => [
  index("idx_struggle_log_student_id").on(table.studentId),
  index("idx_struggle_log_concept").on(table.concept)
])

export type StruggleLogRow = typeof struggleLog.$inferSelect
export type InsertStruggleLog = typeof struggleLog.$inferInsert
