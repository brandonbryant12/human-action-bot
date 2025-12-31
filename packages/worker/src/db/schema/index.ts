// Re-export all schema tables
export { students, type StudentRow, type InsertStudent } from "./students"
export { lessonHistory, type LessonHistoryRow, type InsertLessonHistory } from "./lessons"
export { conversations, type ConversationRow, type InsertConversation } from "./conversations"
export { struggleLog, type StruggleLogRow, type InsertStruggleLog } from "./struggles"
export { feedback, type FeedbackRow, type InsertFeedback } from "./feedback"

// Export relations for relational query API
export {
  studentsRelations,
  lessonHistoryRelations,
  conversationsRelations,
  struggleLogRelations,
  feedbackRelations
} from "./relations"

// Combined schema export for Drizzle relational queries
import { students } from "./students"
import { lessonHistory } from "./lessons"
import { conversations } from "./conversations"
import { struggleLog } from "./struggles"
import { feedback } from "./feedback"
import {
  studentsRelations,
  lessonHistoryRelations,
  conversationsRelations,
  struggleLogRelations,
  feedbackRelations
} from "./relations"

export const schema = {
  students,
  lessonHistory,
  conversations,
  struggleLog,
  feedback,
  studentsRelations,
  lessonHistoryRelations,
  conversationsRelations,
  struggleLogRelations,
  feedbackRelations
}
