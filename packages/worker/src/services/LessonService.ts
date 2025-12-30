import { Effect, Context, Layer } from "effect"
import { AIServiceTag } from "./AIService"
import { RAGServiceTag } from "./RAGService"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import { LESSON_INTRO_PROMPT, APPLICATION_PROMPT } from "../prompts/tutor"
import { AIError, VectorizeError, DatabaseError } from "../lib/effect-runtime"
import { D1Database as D1DatabaseTag } from "../lib/effect-runtime"

// Lesson types
export type LessonType = "intro" | "review" | "deep_dive" | "application"

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

// Lesson history row
interface LessonHistoryRow {
  id: number
  student_id: number
  chapter_number: number
  chunk_id: string
  lesson_type: string
  comprehension_score: number | null
  time_spent_seconds: number | null
  questions_asked: number
  completed_at: string
}

// D1 types
interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ success: boolean }>
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

// LessonService implementation
export const LessonServiceLive = Layer.effect(
  LessonServiceTag,
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag
    const ragService = yield* RAGServiceTag
    yield* StudentServiceTag // Ensure dependency is available
    const db = yield* D1DatabaseTag

    // Determine what type of lesson to give based on student progress
    const determineLessonType = (student: Student): Effect.Effect<LessonType, DatabaseError> =>
      Effect.gen(function* () {
        const d1 = db as unknown as D1Database

        // Get recent lessons for this student
        const recentResult = yield* Effect.tryPromise({
          try: async () => {
            const result = await d1
              .prepare(
                `SELECT * FROM lesson_history
                 WHERE student_id = ?
                 ORDER BY completed_at DESC
                 LIMIT 5`
              )
              .bind(student.id)
              .all<LessonHistoryRow>()
            return result.results
          },
          catch: (error) => new DatabaseError("Failed to get recent lessons", error)
        })

        // If no lessons yet, start with intro
        if (recentResult.length === 0) {
          return "intro" as LessonType
        }

        // Check if student has been struggling (low comprehension)
        const recentScores = recentResult
          .filter((l) => l.comprehension_score !== null)
          .map((l) => l.comprehension_score!)

        const avgRecentScore =
          recentScores.length > 0
            ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
            : 0.7

        // If struggling, do a review
        if (avgRecentScore < 0.5) {
          return "review" as LessonType
        }

        // Check lesson type rotation
        const lastLessonType = recentResult[0]?.lesson_type as LessonType | undefined

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
          yield* Effect.fail(new AIError("No content found for this chapter"))
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
          const d1 = db as unknown as D1Database
          await d1
            .prepare(
              `INSERT INTO lesson_history
               (student_id, chapter_number, chunk_id, lesson_type, comprehension_score, time_spent_seconds, questions_asked)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              studentId,
              lesson.chapter,
              lesson.chunkId,
              lesson.type,
              comprehensionScore,
              timeSpentSeconds,
              questionsAsked
            )
            .run()
        },
        catch: (error) => new DatabaseError("Failed to record lesson history", error)
      })

    // Get recent lessons for a student
    const getRecentLessons = (
      studentId: number,
      limit = 10
    ): Effect.Effect<LessonHistoryRow[], DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const d1 = db as unknown as D1Database
          const result = await d1
            .prepare(
              `SELECT * FROM lesson_history
               WHERE student_id = ?
               ORDER BY completed_at DESC
               LIMIT ?`
            )
            .bind(studentId, limit)
            .all<LessonHistoryRow>()
          return result.results
        },
        catch: (error) => new DatabaseError("Failed to get recent lessons", error)
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
