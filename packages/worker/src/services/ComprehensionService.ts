import { Effect, Context, Layer } from "effect"
import { eq, and, desc } from "drizzle-orm"
import { AIServiceTag } from "./AIService"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import {
  buildComprehensionAssessment,
  parseComprehensionResponse
} from "../prompts/comprehension"
import { AIError, DatabaseError } from "@human-action-bot/shared"
import { DrizzleTag } from "../db/DrizzleLive"
import { struggleLog } from "../db/schema"
import type { StudentId, ChapterNumber } from "@human-action-bot/shared"

// Comprehension assessment result
export interface ComprehensionResult {
  score: number
  strengths: string[]
  areasForImprovement: string[]
  feedback: string
  followUpQuestion: string | null
}

// Struggle entry
export interface StruggleEntry {
  concept: string
  count: number
  lastOccurred: string
}

// ComprehensionService error type
export type ComprehensionError = AIError | DatabaseError

// ComprehensionService interface
export interface ComprehensionService {
  readonly assessAnswer: (
    student: Student,
    question: string,
    answer: string,
    chapterContext: string,
    expectedConcepts: string[]
  ) => Effect.Effect<ComprehensionResult, ComprehensionError>
  readonly recordStruggle: (
    studentId: number,
    chapter: number,
    concept: string
  ) => Effect.Effect<void, DatabaseError>
  readonly getStudentStruggles: (
    studentId: number
  ) => Effect.Effect<StruggleEntry[], DatabaseError>
  readonly updateStudentProgress: (
    student: Student,
    score: number
  ) => Effect.Effect<Student, DatabaseError>
}

// ComprehensionService Tag
export class ComprehensionServiceTag extends Context.Tag("ComprehensionService")<
  ComprehensionServiceTag,
  ComprehensionService
>() {}

// ComprehensionService implementation
export const ComprehensionServiceLive = Layer.effect(
  ComprehensionServiceTag,
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag
    const studentService = yield* StudentServiceTag
    const db = yield* DrizzleTag

    // Assess a student's answer
    const assessAnswer = (
      student: Student,
      question: string,
      answer: string,
      chapterContext: string,
      expectedConcepts: string[]
    ): Effect.Effect<ComprehensionResult, ComprehensionError> =>
      Effect.gen(function* () {
        const prompt = buildComprehensionAssessment(
          question,
          answer,
          chapterContext,
          expectedConcepts
        )

        const result = yield* aiService.generate({
          system:
            "You are an expert at assessing student understanding of Austrian economics.",
          messages: [{ role: "user", content: prompt }]
        })

        const assessment = parseComprehensionResponse(result.text)

        // Record any struggles if score is low
        if (assessment.score < 0.5 && assessment.areasForImprovement.length > 0) {
          for (const area of assessment.areasForImprovement) {
            yield* recordStruggle(student.id, student.currentChapter, area)
          }
        }

        return assessment
      })

    // Record a concept the student is struggling with
    const recordStruggle = (
      studentId: number,
      chapter: number,
      concept: string
    ): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          // Check if there's an existing struggle for this concept
          const existing = await db
            .select()
            .from(struggleLog)
            .where(
              and(
                eq(struggleLog.studentId, studentId as StudentId),
                eq(struggleLog.concept, concept)
              )
            )
            .get()

          if (existing) {
            // Update existing struggle
            await db
              .update(struggleLog)
              .set({
                struggleCount: (existing.struggleCount ?? 1) + 1,
                lastStruggledAt: new Date().toISOString(),
                resolved: false
              })
              .where(eq(struggleLog.id, existing.id))
              .run()
          } else {
            // Insert new struggle
            await db
              .insert(struggleLog)
              .values({
                studentId: studentId as StudentId,
                chapterNumber: chapter as ChapterNumber,
                concept,
                struggleCount: 1,
                lastStruggledAt: new Date().toISOString(),
                resolved: false
              })
              .run()
          }
        },
        catch: (error) => new DatabaseError({ message: "Failed to record struggle", cause: error })
      })

    // Get all struggles for a student
    const getStudentStruggles = (
      studentId: number
    ): Effect.Effect<StruggleEntry[], DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              concept: struggleLog.concept,
              count: struggleLog.struggleCount,
              lastOccurred: struggleLog.lastStruggledAt
            })
            .from(struggleLog)
            .where(
              and(
                eq(struggleLog.studentId, studentId as StudentId),
                eq(struggleLog.resolved, false)
              )
            )
            .orderBy(desc(struggleLog.lastStruggledAt))
            .all()

          return rows.map((row) => ({
            concept: row.concept,
            count: row.count ?? 1,
            lastOccurred: row.lastOccurred ?? new Date().toISOString()
          }))
        },
        catch: (error) => new DatabaseError({ message: "Failed to get student struggles", cause: error })
      })

    // Update student progress after comprehension check
    const updateStudentProgress = (
      student: Student,
      score: number
    ): Effect.Effect<Student, DatabaseError> =>
      studentService.recordLessonComplete(student.userId, score)

    return {
      assessAnswer,
      recordStruggle,
      getStudentStruggles,
      updateStudentProgress
    }
  })
)

export const ComprehensionServiceLayer = ComprehensionServiceLive
