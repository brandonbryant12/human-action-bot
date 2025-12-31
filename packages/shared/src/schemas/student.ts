import { Schema as S } from "@effect/schema"
import {
  StudentIdSchema,
  UserIdSchema,
  TelegramIdSchema,
  ChapterNumberSchema,
  ChunkIndexSchema,
  PaceMultiplierSchema
} from "./brands"

// Student schema matching the database structure
export const StudentSchema = S.Struct({
  id: StudentIdSchema,
  userId: UserIdSchema,
  telegramChatId: S.NullOr(TelegramIdSchema),
  displayName: S.NullOr(S.String),
  currentChapter: ChapterNumberSchema,
  currentChunk: ChunkIndexSchema,
  paceMultiplier: PaceMultiplierSchema,
  totalLessonsCompleted: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
  totalQuestionsAnswered: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
  averageComprehensionScore: S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)),
  preferredLessonTime: S.String,
  timezone: S.String,
  createdAt: S.String,
  updatedAt: S.String
})

export type Student = S.Schema.Type<typeof StudentSchema>

// Student creation input
export const CreateStudentInputSchema = S.Struct({
  userId: UserIdSchema,
  telegramChatId: S.optional(TelegramIdSchema),
  displayName: S.optional(S.String)
})

export type CreateStudentInput = S.Schema.Type<typeof CreateStudentInputSchema>

// Student update input
export const UpdateStudentInputSchema = S.Struct({
  currentChapter: S.optional(ChapterNumberSchema),
  currentChunk: S.optional(ChunkIndexSchema),
  paceMultiplier: S.optional(PaceMultiplierSchema),
  displayName: S.optional(S.String),
  preferredLessonTime: S.optional(S.String),
  timezone: S.optional(S.String)
})

export type UpdateStudentInput = S.Schema.Type<typeof UpdateStudentInputSchema>
