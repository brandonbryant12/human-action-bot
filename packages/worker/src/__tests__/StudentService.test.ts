import { describe, it, expect } from "vitest"
import { Effect, Layer } from "effect"
import { StudentServiceTag, StudentServiceLive } from "../services/StudentService"
import { DrizzleTag, type Database } from "../db/DrizzleLive"
import type { UserId, TelegramId, StudentId } from "@human-action-bot/shared"

// Mock Drizzle database for testing
const createMockDrizzle = () => {
  const studentsMap = new Map<string, Record<string, unknown>>()

  // Create a mock that mimics Drizzle's query builder interface
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          get: async () => {
            // Return first matching student
            const entries = Array.from(studentsMap.entries())
            if (entries.length === 0) return undefined
            const [userId, student] = entries[0]!
            return {
              id: 1 as StudentId,
              userId: userId as UserId,
              telegramChatId: (student.telegramChatId ?? null) as TelegramId | null,
              displayName: student.displayName ?? null,
              currentChapter: student.currentChapter ?? 1,
              currentChunk: student.currentChunk ?? 0,
              paceMultiplier: student.paceMultiplier ?? 1.0,
              totalLessonsCompleted: student.totalLessonsCompleted ?? 0,
              totalQuestionsAnswered: student.totalQuestionsAnswered ?? 0,
              averageComprehensionScore: student.averageComprehensionScore ?? 0.0,
              preferredLessonTime: student.preferredLessonTime ?? "08:00",
              timezone: student.timezone ?? "UTC",
              createdAt: student.createdAt ?? new Date().toISOString(),
              updatedAt: student.updatedAt ?? new Date().toISOString()
            }
          },
          all: async () => []
        })
      })
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        run: async () => {
          const userId = values.userId as string
          studentsMap.set(userId, {
            userId,
            telegramChatId: values.telegramChatId,
            displayName: values.displayName,
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
          return { changes: 1 }
        }
      })
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: async () => ({ changes: 1 })
        })
      })
    }),
    delete: () => ({
      where: () => ({
        run: async () => ({ changes: 1 })
      })
    })
  }
}

describe("StudentService", () => {
  const mockDrizzle = createMockDrizzle()
  const TestDrizzleLayer = Layer.succeed(DrizzleTag, mockDrizzle as unknown as Database)

  it("should create a new student", async () => {
    const program = Effect.gen(function* () {
      const service = yield* StudentServiceTag
      return yield* service.create({ userId: "test-user-1" })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(StudentServiceLive), Effect.provide(TestDrizzleLayer))
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
      program.pipe(Effect.provide(StudentServiceLive), Effect.provide(TestDrizzleLayer))
    )

    expect(result).not.toBeNull()
    expect(result?.userId).toBe("test-user-2")
  })
})
