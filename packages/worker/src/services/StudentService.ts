import { Effect, Context, Layer } from "effect"
import { eq } from "drizzle-orm"
import { DatabaseError } from "@human-action-bot/shared"
import { DrizzleTag } from "../db/DrizzleLive"
import { students, type StudentRow } from "../db/schema"
import type { UserId, TelegramId, ChapterNumber, ChunkIndex, PaceMultiplier } from "@human-action-bot/shared"

// Student type for application use (matches the Drizzle row but with camelCase)
export interface Student {
  id: number
  userId: string
  telegramChatId: string | null
  displayName: string | null
  currentChapter: number
  currentChunk: number
  paceMultiplier: number
  totalLessonsCompleted: number
  totalQuestionsAnswered: number
  averageComprehensionScore: number
  preferredLessonTime: string
  timezone: string
  createdAt: string
  updatedAt: string
}

// Student creation input
export interface CreateStudentInput {
  userId: string
  telegramChatId?: string
  displayName?: string
}

// Student update input
export interface UpdateStudentInput {
  currentChapter?: number
  currentChunk?: number
  paceMultiplier?: number
  displayName?: string
  preferredLessonTime?: string
  timezone?: string
}

// Convert database row to Student
const rowToStudent = (row: StudentRow): Student => ({
  id: row.id as number,
  userId: row.userId as string,
  telegramChatId: row.telegramChatId as string | null,
  displayName: row.displayName,
  currentChapter: (row.currentChapter ?? 1) as number,
  currentChunk: (row.currentChunk ?? 0) as number,
  paceMultiplier: (row.paceMultiplier ?? 1.0) as number,
  totalLessonsCompleted: row.totalLessonsCompleted ?? 0,
  totalQuestionsAnswered: row.totalQuestionsAnswered ?? 0,
  averageComprehensionScore: row.averageComprehensionScore ?? 0.0,
  preferredLessonTime: row.preferredLessonTime ?? "08:00",
  timezone: row.timezone ?? "UTC",
  createdAt: row.createdAt ?? new Date().toISOString(),
  updatedAt: row.updatedAt ?? new Date().toISOString()
})

// StudentService interface
export interface StudentService {
  readonly getByUserId: (userId: string) => Effect.Effect<Student | null, DatabaseError>
  readonly getByTelegramChatId: (chatId: string) => Effect.Effect<Student | null, DatabaseError>
  readonly create: (input: CreateStudentInput) => Effect.Effect<Student, DatabaseError>
  readonly update: (userId: string, input: UpdateStudentInput) => Effect.Effect<Student, DatabaseError>
  readonly recordLessonComplete: (
    userId: string,
    comprehensionScore: number
  ) => Effect.Effect<Student, DatabaseError>
  readonly advanceProgress: (userId: string) => Effect.Effect<Student, DatabaseError>
}

// StudentService Tag
export class StudentServiceTag extends Context.Tag("StudentService")<
  StudentServiceTag,
  StudentService
>() {}

// StudentService implementation using Drizzle
export const StudentServiceLive = Layer.effect(
  StudentServiceTag,
  Effect.gen(function* () {
    const db = yield* DrizzleTag

    const getByUserId = (userId: string): Effect.Effect<Student | null, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const row = await db.query.students.findFirst({
            where: eq(students.userId, userId as UserId)
          })
          return row ? rowToStudent(row) : null
        },
        catch: (error) => new DatabaseError({ message: "Failed to get student by userId", cause: error })
      })

    const getByTelegramChatId = (chatId: string): Effect.Effect<Student | null, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const row = await db.query.students.findFirst({
            where: eq(students.telegramChatId, chatId as TelegramId)
          })
          return row ? rowToStudent(row) : null
        },
        catch: (error) => new DatabaseError({ message: "Failed to get student by telegramChatId", cause: error })
      })

    const create = (input: CreateStudentInput): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          await db
            .insert(students)
            .values({
              userId: input.userId as UserId,
              telegramChatId: (input.telegramChatId as TelegramId) ?? null,
              displayName: input.displayName ?? null
            })
            .run()

          const row = await db
            .select()
            .from(students)
            .where(eq(students.userId, input.userId as UserId))
            .get()

          if (!row) {
            throw new Error("Failed to create student")
          }

          return rowToStudent(row)
        },
        catch: (error) => new DatabaseError({ message: "Failed to create student", cause: error })
      })

    const update = (userId: string, input: UpdateStudentInput): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const updateValues: Partial<{
            currentChapter: ChapterNumber
            currentChunk: ChunkIndex
            paceMultiplier: PaceMultiplier
            displayName: string
            preferredLessonTime: string
            timezone: string
            updatedAt: string
          }> = {}

          if (input.currentChapter !== undefined) {
            updateValues.currentChapter = input.currentChapter as ChapterNumber
          }
          if (input.currentChunk !== undefined) {
            updateValues.currentChunk = input.currentChunk as ChunkIndex
          }
          if (input.paceMultiplier !== undefined) {
            updateValues.paceMultiplier = input.paceMultiplier as PaceMultiplier
          }
          if (input.displayName !== undefined) {
            updateValues.displayName = input.displayName
          }
          if (input.preferredLessonTime !== undefined) {
            updateValues.preferredLessonTime = input.preferredLessonTime
          }
          if (input.timezone !== undefined) {
            updateValues.timezone = input.timezone
          }
          updateValues.updatedAt = new Date().toISOString()

          await db
            .update(students)
            .set(updateValues)
            .where(eq(students.userId, userId as UserId))
            .run()

          const row = await db
            .select()
            .from(students)
            .where(eq(students.userId, userId as UserId))
            .get()

          if (!row) {
            throw new Error("Student not found")
          }

          return rowToStudent(row)
        },
        catch: (error) => new DatabaseError({ message: "Failed to update student", cause: error })
      })

    const recordLessonComplete = (
      userId: string,
      comprehensionScore: number
    ): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const current = await db
            .select()
            .from(students)
            .where(eq(students.userId, userId as UserId))
            .get()

          if (!current) {
            throw new Error("Student not found")
          }

          const totalLessons = (current.totalLessonsCompleted ?? 0) + 1
          const currentAvg = current.averageComprehensionScore ?? 0
          const currentTotal = current.totalLessonsCompleted ?? 0
          const newAverage = (currentAvg * currentTotal + comprehensionScore) / totalLessons

          await db
            .update(students)
            .set({
              totalLessonsCompleted: totalLessons,
              averageComprehensionScore: newAverage,
              updatedAt: new Date().toISOString()
            })
            .where(eq(students.userId, userId as UserId))
            .run()

          const row = await db
            .select()
            .from(students)
            .where(eq(students.userId, userId as UserId))
            .get()

          return rowToStudent(row!)
        },
        catch: (error) => new DatabaseError({ message: "Failed to record lesson completion", cause: error })
      })

    const advanceProgress = (userId: string): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const current = await db
            .select()
            .from(students)
            .where(eq(students.userId, userId as UserId))
            .get()

          if (!current) {
            throw new Error("Student not found")
          }

          // TODO: Get actual chunk count for chapter
          const chunksPerChapter = 10
          const currentChunk = current.currentChunk ?? 0
          const currentChapter = current.currentChapter ?? 1
          const nextChunk = currentChunk + 1
          const shouldAdvanceChapter = nextChunk >= chunksPerChapter

          const newChapter = shouldAdvanceChapter ? currentChapter + 1 : currentChapter
          const newChunk = shouldAdvanceChapter ? 0 : nextChunk

          await db
            .update(students)
            .set({
              currentChapter: newChapter as ChapterNumber,
              currentChunk: newChunk as ChunkIndex,
              updatedAt: new Date().toISOString()
            })
            .where(eq(students.userId, userId as UserId))
            .run()

          const row = await db
            .select()
            .from(students)
            .where(eq(students.userId, userId as UserId))
            .get()

          return rowToStudent(row!)
        },
        catch: (error) => new DatabaseError({ message: "Failed to advance progress", cause: error })
      })

    return {
      getByUserId,
      getByTelegramChatId,
      create,
      update,
      recordLessonComplete,
      advanceProgress
    }
  })
)

export const StudentServiceLayer = StudentServiceLive
