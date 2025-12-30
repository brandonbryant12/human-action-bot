import { describe, it, expect } from "vitest"
import { Effect, Layer } from "effect"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { D1Database as D1DatabaseTag } from "../lib/effect-runtime"

// Mock D1 database
const createMockD1 = () => {
  const students = new Map<string, Record<string, unknown>>()

  return {
    prepare: (query: string) => ({
      bind: (...values: unknown[]) => ({
        first: async <T>(): Promise<T | null> => {
          const userId = values[0] as string
          const student = students.get(userId)
          if (!student) return null
          return {
            id: 1,
            user_id: student.userId,
            telegram_chat_id: student.telegramChatId ?? null,
            display_name: student.displayName ?? null,
            current_chapter: student.currentChapter ?? 1,
            current_chunk: student.currentChunk ?? 0,
            pace_multiplier: student.paceMultiplier ?? 1.0,
            total_lessons_completed: student.totalLessonsCompleted ?? 0,
            total_questions_answered: student.totalQuestionsAnswered ?? 0,
            average_comprehension_score: student.averageComprehensionScore ?? 0.0,
            preferred_lesson_time: student.preferredLessonTime ?? "08:00",
            timezone: student.timezone ?? "UTC",
            created_at: student.createdAt ?? new Date().toISOString(),
            updated_at: student.updatedAt ?? new Date().toISOString()
          } as T
        },
        all: async <T>(): Promise<{ results: T[] }> => {
          return { results: [] }
        },
        run: async () => {
          if (query.includes("INSERT INTO students")) {
            const userId = values[0] as string
            students.set(userId, {
              userId,
              telegramChatId: values[1],
              displayName: values[2],
              currentChapter: 1,
              currentChunk: 0,
              paceMultiplier: 1.0,
              totalLessonsCompleted: 0,
              totalQuestionsAnswered: 0,
              averageComprehensionScore: 0.0,
              preferredLessonTime: "08:00",
              timezone: "UTC",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          }
          return { success: true }
        }
      })
    })
  }
}

describe("StudentService", () => {
  const mockD1 = createMockD1()
  const TestD1Layer = Layer.succeed(D1DatabaseTag, mockD1 as unknown as typeof D1DatabaseTag.Service)

  it("should create a new student", async () => {
    const program = Effect.gen(function* () {
      const service = yield* StudentServiceTag
      return yield* service.create({ userId: "test-user-1" })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(StudentServiceLive), Effect.provide(TestD1Layer))
    )

    expect(result.userId).toBe("test-user-1")
    expect(result.currentChapter).toBe(1)
    expect(result.paceMultiplier).toBe(1.0)
  })

  it("should get student by userId", async () => {
    const program = Effect.gen(function* () {
      const service = yield* StudentServiceTag
      yield* service.create({ userId: "test-user-2" })
      return yield* service.getByUserId("test-user-2")
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(StudentServiceLive), Effect.provide(TestD1Layer))
    )

    expect(result).not.toBeNull()
    expect(result?.userId).toBe("test-user-2")
  })

  it("should return null for non-existent student", async () => {
    const program = Effect.gen(function* () {
      const service = yield* StudentServiceTag
      return yield* service.getByUserId("non-existent-user")
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(StudentServiceLive), Effect.provide(TestD1Layer))
    )

    expect(result).toBeNull()
  })
})
