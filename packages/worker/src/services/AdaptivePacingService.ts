import { Effect, Context, Layer } from "effect"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import { LessonServiceTag } from "./LessonService"
import { DatabaseError } from "@human-action-bot/shared"

// Pacing recommendation
export interface PacingRecommendation {
  paceMultiplier: number
  shouldAdvance: boolean
  recommendedLessonType: "intro" | "review" | "deep_dive" | "application"
  reasoning: string
}

// AdaptivePacingService interface
export interface AdaptivePacingService {
  readonly calculatePacing: (student: Student) => Effect.Effect<PacingRecommendation, DatabaseError>
  readonly applyPacingUpdate: (student: Student) => Effect.Effect<Student, DatabaseError>
  readonly shouldSendDailyLesson: (student: Student) => Effect.Effect<boolean, DatabaseError>
}

// AdaptivePacingService Tag
export class AdaptivePacingServiceTag extends Context.Tag("AdaptivePacingService")<
  AdaptivePacingServiceTag,
  AdaptivePacingService
>() {}

// AdaptivePacingService implementation
export const AdaptivePacingServiceLive = Layer.effect(
  AdaptivePacingServiceTag,
  Effect.gen(function* () {
    const studentService = yield* StudentServiceTag
    const lessonService = yield* LessonServiceTag

    // Calculate optimal pacing for a student
    const calculatePacing = (
      student: Student
    ): Effect.Effect<PacingRecommendation, DatabaseError> =>
      Effect.gen(function* () {
        // Get recent lesson history
        const recentLessons = yield* lessonService.getRecentLessons(student.id, 10)

        // Calculate average comprehension from recent lessons
        const recentScores = recentLessons
          .filter((l) => l.comprehensionScore !== null)
          .map((l) => l.comprehensionScore!)

        const avgRecentScore =
          recentScores.length > 0
            ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
            : student.averageComprehensionScore

        // Calculate trend (improving or declining)
        let trend = 0
        if (recentScores.length >= 3) {
          const recent3 = recentScores.slice(0, 3)
          const older3 = recentScores.slice(3, 6)
          if (older3.length > 0) {
            const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length
            const olderAvg = older3.reduce((a, b) => a + b, 0) / older3.length
            trend = recentAvg - olderAvg
          }
        }

        // Determine pacing based on performance
        let paceMultiplier = student.paceMultiplier
        let shouldAdvance = false
        let recommendedLessonType: "intro" | "review" | "deep_dive" | "application" = "intro"
        let reasoning = ""

        if (avgRecentScore >= 0.8) {
          // Excellent performance - speed up
          paceMultiplier = Math.min(2.0, student.paceMultiplier * 1.1)
          shouldAdvance = true
          recommendedLessonType = "deep_dive"
          reasoning = "Excellent comprehension! Ready for more challenging material."
        } else if (avgRecentScore >= 0.6) {
          // Good performance - maintain pace
          paceMultiplier = student.paceMultiplier
          shouldAdvance = trend > 0.1
          recommendedLessonType = trend > 0 ? "application" : "intro"
          reasoning = "Good progress. Continuing at current pace."
        } else if (avgRecentScore >= 0.4) {
          // Struggling - slow down
          paceMultiplier = Math.max(0.5, student.paceMultiplier * 0.9)
          shouldAdvance = false
          recommendedLessonType = "review"
          reasoning = "Some concepts need reinforcement. Let's review."
        } else {
          // Significant struggles - major slowdown
          paceMultiplier = Math.max(0.5, student.paceMultiplier * 0.7)
          shouldAdvance = false
          recommendedLessonType = "review"
          reasoning = "Focusing on foundational concepts before moving forward."
        }

        return {
          paceMultiplier: Math.round(paceMultiplier * 100) / 100,
          shouldAdvance,
          recommendedLessonType,
          reasoning
        }
      })

    // Apply pacing update to student
    const applyPacingUpdate = (student: Student): Effect.Effect<Student, DatabaseError> =>
      Effect.gen(function* () {
        const recommendation = yield* calculatePacing(student)

        const updatedStudent = yield* studentService.update(student.userId, {
          paceMultiplier: recommendation.paceMultiplier
        })

        // Advance progress if recommended
        if (recommendation.shouldAdvance) {
          return yield* studentService.advanceProgress(student.userId)
        }

        return updatedStudent
      })

    // Determine if student should receive daily lesson
    const shouldSendDailyLesson = (
      student: Student
    ): Effect.Effect<boolean, DatabaseError> =>
      Effect.gen(function* () {
        // Get today's lessons
        const recentLessons = yield* lessonService.getRecentLessons(student.id, 5)

        if (recentLessons.length === 0) {
          return true // Always send if no lessons yet
        }

        // Check if student already had a lesson today
        const today = new Date().toISOString().split("T")[0]
        const lastLessonDate = recentLessons[0]?.completedAt?.split("T")[0]

        if (lastLessonDate === today) {
          return false // Already had a lesson today
        }

        // Check student's pace multiplier
        // Higher pace = more lessons
        if (student.paceMultiplier >= 1.5) {
          return true // Fast learners get daily lessons
        }

        if (student.paceMultiplier <= 0.7) {
          // Slower learners might skip some days
          // Simple heuristic: send every other day
          const dayOfYear = Math.floor(
            (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          return dayOfYear % 2 === 0
        }

        return true // Default: send daily
      })

    return {
      calculatePacing,
      applyPacingUpdate,
      shouldSendDailyLesson
    }
  })
)

export const AdaptivePacingServiceLayer = AdaptivePacingServiceLive
