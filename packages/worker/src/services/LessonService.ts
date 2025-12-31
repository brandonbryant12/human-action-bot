import { Effect, Context, Layer } from "effect"
import { eq, desc } from "drizzle-orm"
import { AIServiceTag } from "./AIService"
import { RAGServiceTag } from "./RAGService"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import { LESSON_INTRO_PROMPT, APPLICATION_PROMPT } from "../prompts/tutor"
import { AIError, VectorizeError, DatabaseError } from "@human-action-bot/shared"
import { DrizzleTag } from "../db/DrizzleLive"
import { lessonHistory, type LessonHistoryRow } from "../db/schema"
import type { StudentId, ChapterNumber, LessonType } from "@human-action-bot/shared"

// Re-export LessonType for convenience
export type { LessonType } from "@human-action-bot/shared"

// Lesson content
export interface Lesson {
  id: string
  type: LessonType
  chapter: number
  chunkId: string
  title: string
  content: string
  questions: string[]
  estimatedMinutes: number
}

// LessonService error type
export type LessonError = AIError | VectorizeError | DatabaseError

// LessonService interface
export interface LessonService {
  readonly generateLesson: (student: Student) => Effect.Effect<Lesson, LessonError>
  readonly recordLessonHistory: (
    studentId: number,
    lesson: Lesson,
    comprehensionScore: number,
    timeSpentSeconds: number,
    questionsAsked: number
  ) => Effect.Effect<void, DatabaseError>
  readonly getRecentLessons: (
    studentId: number,
    limit?: number
  ) => Effect.Effect<LessonHistoryRow[], DatabaseError>
  readonly determineLessonType: (student: Student) => Effect.Effect<LessonType, DatabaseError>
}

// LessonService Tag
export class LessonServiceTag extends Context.Tag("LessonService")<
  LessonServiceTag,
  LessonService
>() {}

// LessonService implementation using Drizzle
export const LessonServiceLive = Layer.effect(
  LessonServiceTag,
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag
    const ragService = yield* RAGServiceTag
    yield* StudentServiceTag // Ensure dependency is available
    const db = yield* DrizzleTag

    // Determine what type of lesson to give based on student progress
    const determineLessonType = (student: Student): Effect.Effect<LessonType, DatabaseError> =>
      Effect.gen(function* () {
        // Get recent lessons for this student
        const recentResult = yield* Effect.tryPromise({
          try: async () => {
            return await db
              .select()
              .from(lessonHistory)
              .where(eq(lessonHistory.studentId, student.id as StudentId))
              .orderBy(desc(lessonHistory.completedAt))
              .limit(5)
              .all()
          },
          catch: (error) => new DatabaseError({ message: "Failed to get recent lessons", cause: error })
        })

        // If no lessons yet, start with intro
        if (recentResult.length === 0) {
          return "intro" as LessonType
        }

        // Check if student has been struggling (low comprehension)
        const recentScores = recentResult
          .filter((l) => l.comprehensionScore !== null)
          .map((l) => l.comprehensionScore!)

        const avgRecentScore =
          recentScores.length > 0
            ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
            : 0.7

        // If struggling, do a review
        if (avgRecentScore < 0.5) {
          return "review" as LessonType
        }

        // Check lesson type rotation
        const lastLessonType = recentResult[0]?.lessonType as LessonType | undefined

        // Rotate through lesson types
        switch (lastLessonType) {
          case "intro":
            return "deep_dive" as LessonType
          case "deep_dive":
            return "application" as LessonType
          case "application":
            return "intro" as LessonType
          case "review":
            return "intro" as LessonType
          default:
            return "intro" as LessonType
        }
      })

    // Generate a lesson for the student
    const generateLesson = (student: Student): Effect.Effect<Lesson, LessonError> =>
      Effect.gen(function* () {
        const lessonType = yield* determineLessonType(student)

        // Get relevant content from RAG
        const ragResult = yield* ragService.getChunksByChapter(
          student.currentChapter,
          3
        )

        if (ragResult.length === 0) {
          yield* Effect.fail(new AIError({ message: "No content found for this chapter" }))
        }

        const contentContext = ragResult
          .map((chunk) => chunk.textPreview)
          .join("\n\n---\n\n")

        // Select prompt based on lesson type
        const basePrompt =
          lessonType === "application" ? APPLICATION_PROMPT : LESSON_INTRO_PROMPT

        const systemPrompt = `${basePrompt}

## Chapter Context
Chapter ${student.currentChapter}: ${ragResult[0]?.chapterTitle ?? "Unknown"}

## Source Material
${contentContext}

## Student Context
- Lessons completed: ${student.totalLessonsCompleted}
- Average comprehension: ${(student.averageComprehensionScore * 100).toFixed(0)}%
- Learning pace: ${student.paceMultiplier}x

Generate a ${lessonType} lesson. Include:
1. A brief, engaging introduction (2-3 sentences)
2. The main lesson content (3-5 paragraphs)
3. 2-3 comprehension questions to check understanding

Format your response as:
## Introduction
[introduction]

## Lesson
[main content]

## Questions
1. [question 1]
2. [question 2]
3. [question 3]`

        const result = yield* aiService.generate({
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Please create a ${lessonType} lesson for Chapter ${student.currentChapter}.`
            }
          ]
        })

        // Parse the response to extract questions
        const content = result.text
        const questionsMatch = content.match(/## Questions\n([\s\S]+)$/i)
        const questionsRaw = questionsMatch?.[1] ?? ""
        const questions = questionsRaw
          .split("\n")
          .filter((line) => line.match(/^\d+\./))
          .map((q) => q.replace(/^\d+\.\s*/, "").trim())

        return {
          id: `lesson_${student.id}_${Date.now()}`,
          type: lessonType,
          chapter: student.currentChapter,
          chunkId: ragResult[0]?.id ?? `ch${student.currentChapter}_chunk000`,
          title: `Chapter ${student.currentChapter}: ${ragResult[0]?.chapterTitle ?? "Unknown"}`,
          content,
          questions,
          estimatedMinutes: lessonType === "deep_dive" ? 15 : 10
        }
      })

    // Record lesson completion in history
    const recordLessonHistory = (
      studentId: number,
      lesson: Lesson,
      comprehensionScore: number,
      timeSpentSeconds: number,
      questionsAsked: number
    ): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          await db
            .insert(lessonHistory)
            .values({
              studentId: studentId as StudentId,
              chapterNumber: lesson.chapter as ChapterNumber,
              chunkId: lesson.chunkId,
              lessonType: lesson.type,
              comprehensionScore,
              timeSpentSeconds,
              questionsAsked
            })
            .run()
        },
        catch: (error) => new DatabaseError({ message: "Failed to record lesson history", cause: error })
      })

    // Get recent lessons for a student
    const getRecentLessons = (
      studentId: number,
      limit = 10
    ): Effect.Effect<LessonHistoryRow[], DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(lessonHistory)
            .where(eq(lessonHistory.studentId, studentId as StudentId))
            .orderBy(desc(lessonHistory.completedAt))
            .limit(limit)
            .all()
        },
        catch: (error) => new DatabaseError({ message: "Failed to get recent lessons", cause: error })
      })

    return {
      generateLesson,
      recordLessonHistory,
      getRecentLessons,
      determineLessonType
    }
  })
)

export const LessonServiceLayer = LessonServiceLive
