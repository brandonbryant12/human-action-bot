// Re-export all branded types
export {
  // ID types
  StudentIdSchema,
  type StudentId,
  LessonIdSchema,
  type LessonId,
  ConversationIdSchema,
  type ConversationId,
  LessonHistoryIdSchema,
  type LessonHistoryId,
  FeedbackIdSchema,
  type FeedbackId,
  StruggleLogIdSchema,
  type StruggleLogId,
  // String branded types
  TelegramIdSchema,
  type TelegramId,
  UserIdSchema,
  type UserId,
  // Bounded number types
  ComprehensionScoreSchema,
  type ComprehensionScore,
  PaceMultiplierSchema,
  type PaceMultiplier,
  ChapterNumberSchema,
  type ChapterNumber,
  ChunkIndexSchema,
  type ChunkIndex,
  // Literal unions
  LessonTypeSchema,
  type LessonType,
  FeedbackTypeSchema,
  type FeedbackType,
  MessageRoleSchema,
  type MessageRole
} from "./brands"

// Re-export domain schemas
export {
  StudentSchema,
  type Student,
  CreateStudentInputSchema,
  type CreateStudentInput,
  UpdateStudentInputSchema,
  type UpdateStudentInput
} from "./student"

export {
  LessonSchema,
  type Lesson,
  LessonHistorySchema,
  type LessonHistory
} from "./lesson"

export {
  ConversationSchema,
  type Conversation,
  AddMessageInputSchema,
  type AddMessageInput
} from "./conversation"
