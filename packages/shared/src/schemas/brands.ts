import { Schema as S } from "@effect/schema"

// Branded ID types
export const StudentIdSchema = S.Number.pipe(S.int(), S.positive(), S.brand("StudentId"))
export type StudentId = S.Schema.Type<typeof StudentIdSchema>

export const LessonIdSchema = S.Number.pipe(S.int(), S.positive(), S.brand("LessonId"))
export type LessonId = S.Schema.Type<typeof LessonIdSchema>

export const ConversationIdSchema = S.Number.pipe(S.int(), S.positive(), S.brand("ConversationId"))
export type ConversationId = S.Schema.Type<typeof ConversationIdSchema>

export const LessonHistoryIdSchema = S.Number.pipe(S.int(), S.positive(), S.brand("LessonHistoryId"))
export type LessonHistoryId = S.Schema.Type<typeof LessonHistoryIdSchema>

export const FeedbackIdSchema = S.Number.pipe(S.int(), S.positive(), S.brand("FeedbackId"))
export type FeedbackId = S.Schema.Type<typeof FeedbackIdSchema>

export const StruggleLogIdSchema = S.Number.pipe(S.int(), S.positive(), S.brand("StruggleLogId"))
export type StruggleLogId = S.Schema.Type<typeof StruggleLogIdSchema>

// Branded string types
export const TelegramIdSchema = S.String.pipe(S.nonEmptyString(), S.brand("TelegramId"))
export type TelegramId = S.Schema.Type<typeof TelegramIdSchema>

export const UserIdSchema = S.String.pipe(S.nonEmptyString(), S.brand("UserId"))
export type UserId = S.Schema.Type<typeof UserIdSchema>

// Bounded number types
export const ComprehensionScoreSchema = S.Number.pipe(
  S.greaterThanOrEqualTo(0),
  S.lessThanOrEqualTo(100),
  S.brand("ComprehensionScore")
)
export type ComprehensionScore = S.Schema.Type<typeof ComprehensionScoreSchema>

export const PaceMultiplierSchema = S.Number.pipe(
  S.greaterThan(0),
  S.lessThanOrEqualTo(3),
  S.brand("PaceMultiplier")
)
export type PaceMultiplier = S.Schema.Type<typeof PaceMultiplierSchema>

export const ChapterNumberSchema = S.Number.pipe(
  S.int(),
  S.greaterThanOrEqualTo(0),
  S.brand("ChapterNumber")
)
export type ChapterNumber = S.Schema.Type<typeof ChapterNumberSchema>

export const ChunkIndexSchema = S.Number.pipe(
  S.int(),
  S.greaterThanOrEqualTo(0),
  S.brand("ChunkIndex")
)
export type ChunkIndex = S.Schema.Type<typeof ChunkIndexSchema>

// Lesson type literal union
export const LessonTypeSchema = S.Literal("intro", "review", "deep_dive", "application")
export type LessonType = S.Schema.Type<typeof LessonTypeSchema>

// Feedback type literal union
export const FeedbackTypeSchema = S.Literal("lesson", "chat", "overall")
export type FeedbackType = S.Schema.Type<typeof FeedbackTypeSchema>

// Message role literal union
export const MessageRoleSchema = S.Literal("user", "assistant", "system")
export type MessageRole = S.Schema.Type<typeof MessageRoleSchema>
