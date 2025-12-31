import { Schema as S } from "@effect/schema"
import {
  LessonHistoryIdSchema,
  StudentIdSchema,
  ChapterNumberSchema,
  LessonTypeSchema
} from "./brands"

// Lesson content (generated, not stored in DB)
export const LessonSchema = S.Struct({
  id: S.String,
  type: LessonTypeSchema,
  chapter: ChapterNumberSchema,
  chunkId: S.String,
  title: S.String,
  content: S.String,
  questions: S.Array(S.String),
  estimatedMinutes: S.Number.pipe(S.int(), S.positive())
})

export type Lesson = S.Schema.Type<typeof LessonSchema>

// Lesson history row (stored in DB)
export const LessonHistorySchema = S.Struct({
  id: LessonHistoryIdSchema,
  studentId: StudentIdSchema,
  chapterNumber: ChapterNumberSchema,
  chunkId: S.String,
  lessonType: LessonTypeSchema,
  comprehensionScore: S.NullOr(S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1))),
  timeSpentSeconds: S.NullOr(S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0))),
  questionsAsked: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
  completedAt: S.String
})

export type LessonHistory = S.Schema.Type<typeof LessonHistorySchema>
