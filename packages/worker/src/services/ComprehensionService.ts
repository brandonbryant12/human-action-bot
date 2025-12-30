import { Effect, Context, Layer } from "effect"
import { AIServiceTag } from "./AIService"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import {
  buildComprehensionAssessment,
  parseComprehensionResponse
} from "../prompts/comprehension"
import { AIError, DatabaseError } from "../lib/effect-runtime"

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
      _studentId: number,
      _chapter: number,
      _concept: string
    ): Effect.Effect<void, DatabaseError> =>
      Effect.succeed(undefined) // Simplified - would insert into struggle_log table

    // Get all struggles for a student
    const getStudentStruggles = (
      _studentId: number
    ): Effect.Effect<StruggleEntry[], DatabaseError> =>
      Effect.succeed([]) // Simplified - would query struggle_log table

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
