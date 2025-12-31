import { relations } from "drizzle-orm"
import { students } from "./students"
import { lessonHistory } from "./lessons"
import { conversations } from "./conversations"
import { struggleLog } from "./struggles"
import { feedback } from "./feedback"

// Student relations
export const studentsRelations = relations(students, ({ many }) => ({
  lessons: many(lessonHistory),
  conversations: many(conversations),
  struggles: many(struggleLog),
  feedback: many(feedback)
}))

// Lesson history relations
export const lessonHistoryRelations = relations(lessonHistory, ({ one }) => ({
  student: one(students, {
    fields: [lessonHistory.studentId],
    references: [students.id]
  })
}))

// Conversation relations
export const conversationsRelations = relations(conversations, ({ one }) => ({
  student: one(students, {
    fields: [conversations.studentId],
    references: [students.id]
  })
}))

// Struggle log relations
export const struggleLogRelations = relations(struggleLog, ({ one }) => ({
  student: one(students, {
    fields: [struggleLog.studentId],
    references: [students.id]
  })
}))

// Feedback relations
export const feedbackRelations = relations(feedback, ({ one }) => ({
  student: one(students, {
    fields: [feedback.studentId],
    references: [students.id]
  })
}))
