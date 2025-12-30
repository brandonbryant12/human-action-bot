import { Effect, Context, Layer, Schema } from "effect"
import { D1Database as D1DatabaseTag, DatabaseError } from "../lib/effect-runtime"

// Student schema
export const StudentSchema = Schema.Struct({
  id: Schema.Number,
  userId: Schema.String,
  telegramChatId: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
  currentChapter: Schema.Number,
  currentChunk: Schema.Number,
  paceMultiplier: Schema.Number,
  totalLessonsCompleted: Schema.Number,
  totalQuestionsAnswered: Schema.Number,
  averageComprehensionScore: Schema.Number,
  preferredLessonTime: Schema.String,
  timezone: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export type Student = Schema.Schema.Type<typeof StudentSchema>

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

// D1 query result types
interface D1Result<T> {
  results: T[]
  success: boolean
  error?: string
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1Result<T>>
  run(): Promise<{ success: boolean }>
}

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

// Row type from database
interface StudentRow {
  id: number
  user_id: string
  telegram_chat_id: string | null
  display_name: string | null
  current_chapter: number
  current_chunk: number
  pace_multiplier: number
  total_lessons_completed: number
  total_questions_answered: number
  average_comprehension_score: number
  preferred_lesson_time: string
  timezone: string
  created_at: string
  updated_at: string
}

// Convert database row to Student
const rowToStudent = (row: StudentRow): Student => ({
  id: row.id,
  userId: row.user_id,
  telegramChatId: row.telegram_chat_id,
  displayName: row.display_name,
  currentChapter: row.current_chapter,
  currentChunk: row.current_chunk,
  paceMultiplier: row.pace_multiplier,
  totalLessonsCompleted: row.total_lessons_completed,
  totalQuestionsAnswered: row.total_questions_answered,
  averageComprehensionScore: row.average_comprehension_score,
  preferredLessonTime: row.preferred_lesson_time,
  timezone: row.timezone,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

// StudentService implementation
export const StudentServiceLive = Layer.effect(
  StudentServiceTag,
  Effect.gen(function* () {
    const db = yield* D1DatabaseTag

    const getByUserId = (userId: string): Effect.Effect<Student | null, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          const row = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(userId)
            .first<StudentRow>()
          return row ? rowToStudent(row) : null
        },
        catch: (error) => new DatabaseError("Failed to get student by userId", error)
      })

    const getByTelegramChatId = (chatId: string): Effect.Effect<Student | null, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          const row = await d1
            .prepare("SELECT * FROM students WHERE telegram_chat_id = ?")
            .bind(chatId)
            .first<StudentRow>()
          return row ? rowToStudent(row) : null
        },
        catch: (error) => new DatabaseError("Failed to get student by telegramChatId", error)
      })

    const create = (input: CreateStudentInput): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          await d1
            .prepare(`
              INSERT INTO students (user_id, telegram_chat_id, display_name)
              VALUES (?, ?, ?)
            `)
            .bind(input.userId, input.telegramChatId ?? null, input.displayName ?? null)
            .run()

          const row = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(input.userId)
            .first<StudentRow>()

          if (!row) {
            throw new Error("Failed to create student")
          }

          return rowToStudent(row)
        },
        catch: (error) => new DatabaseError("Failed to create student", error)
      })

    const update = (userId: string, input: UpdateStudentInput): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          const updates: string[] = []
          const values: unknown[] = []

          if (input.currentChapter !== undefined) {
            updates.push("current_chapter = ?")
            values.push(input.currentChapter)
          }
          if (input.currentChunk !== undefined) {
            updates.push("current_chunk = ?")
            values.push(input.currentChunk)
          }
          if (input.paceMultiplier !== undefined) {
            updates.push("pace_multiplier = ?")
            values.push(input.paceMultiplier)
          }
          if (input.displayName !== undefined) {
            updates.push("display_name = ?")
            values.push(input.displayName)
          }
          if (input.preferredLessonTime !== undefined) {
            updates.push("preferred_lesson_time = ?")
            values.push(input.preferredLessonTime)
          }
          if (input.timezone !== undefined) {
            updates.push("timezone = ?")
            values.push(input.timezone)
          }

          updates.push("updated_at = datetime('now')")
          values.push(userId)

          await d1
            .prepare(`UPDATE students SET ${updates.join(", ")} WHERE user_id = ?`)
            .bind(...values)
            .run()

          const row = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(userId)
            .first<StudentRow>()

          if (!row) {
            throw new Error("Student not found")
          }

          return rowToStudent(row)
        },
        catch: (error) => new DatabaseError("Failed to update student", error)
      })

    const recordLessonComplete = (
      userId: string,
      comprehensionScore: number
    ): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database

          // Get current student to calculate new average
          const current = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(userId)
            .first<StudentRow>()

          if (!current) {
            throw new Error("Student not found")
          }

          // Calculate new average
          const totalLessons = current.total_lessons_completed + 1
          const newAverage =
            (current.average_comprehension_score * current.total_lessons_completed +
              comprehensionScore) /
            totalLessons

          await d1
            .prepare(`
              UPDATE students
              SET total_lessons_completed = ?,
                  average_comprehension_score = ?,
                  updated_at = datetime('now')
              WHERE user_id = ?
            `)
            .bind(totalLessons, newAverage, userId)
            .run()

          const row = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(userId)
            .first<StudentRow>()

          return rowToStudent(row!)
        },
        catch: (error) => new DatabaseError("Failed to record lesson completion", error)
      })

    const advanceProgress = (userId: string): Effect.Effect<Student, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database

          const current = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(userId)
            .first<StudentRow>()

          if (!current) {
            throw new Error("Student not found")
          }

          // TODO: Get actual chunk count for chapter
          const chunksPerChapter = 10 // Approximate, should be loaded from index
          const nextChunk = current.current_chunk + 1
          const shouldAdvanceChapter = nextChunk >= chunksPerChapter

          const newChapter = shouldAdvanceChapter
            ? current.current_chapter + 1
            : current.current_chapter
          const newChunk = shouldAdvanceChapter ? 0 : nextChunk

          await d1
            .prepare(`
              UPDATE students
              SET current_chapter = ?,
                  current_chunk = ?,
                  updated_at = datetime('now')
              WHERE user_id = ?
            `)
            .bind(newChapter, newChunk, userId)
            .run()

          const row = await d1
            .prepare("SELECT * FROM students WHERE user_id = ?")
            .bind(userId)
            .first<StudentRow>()

          return rowToStudent(row!)
        },
        catch: (error) => new DatabaseError("Failed to advance progress", error)
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
