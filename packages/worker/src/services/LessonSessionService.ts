import { Effect, Context, Layer } from "effect"
import { KVNamespaceTag } from "../lib/effect-runtime"
import { LessonServiceTag, type Lesson } from "./LessonService"
import { StudentServiceTag, type Student } from "./StudentService"
import { ChatServiceTag } from "./ChatService"
import { DatabaseError, AIError, VectorizeError } from "@human-action-bot/shared"

// Session state for interactive lessons
export interface LessonSession {
  lessonId: string
  lessonData: Lesson
  userId: string
  currentPhase: LessonPhase
  currentSectionIndex: number
  sectionsTotal: number
  currentQuestionIndex: number
  questionsAnswered: number
  questionsCorrect: number
  startedAt: string
  lastActivityAt: string
}

export type LessonPhase =
  | "intro"
  | "body"
  | "comprehension"
  | "summary"
  | "feedback"
  | "completed"

// What the client should display/do next
export interface LessonStep {
  phase: LessonPhase
  content: string
  action: LessonAction
  lessonTitle: string
  lessonType: string
  progress: {
    current: number
    total: number
  }
  question?: {
    index: number
    total: number
    text: string
  }
}

export type LessonAction =
  | { type: "continue" }
  | { type: "answer_question"; questionText: string }
  | { type: "rate"; min: number; max: number }
  | { type: "complete" }

// Response after answering a question
export interface AnswerResponse {
  feedback: string
  isCorrect: boolean
  hasFollowUp: boolean
  followUpQuestion?: string
  nextStep: LessonStep
}

// Error types
export type LessonSessionError = DatabaseError | AIError | VectorizeError

// Parse lesson content into sections
function parseLessonSections(content: string): { intro: string; body: string[]; conclusion: string } {
  const sections = content.split(/##\s+/g).filter(Boolean)

  let intro = ""
  let body: string[] = []
  let conclusion = ""

  for (const section of sections) {
    const lines = section.trim()
    if (lines.toLowerCase().startsWith("introduction")) {
      intro = lines.replace(/^introduction\s*/i, "").trim()
    } else if (lines.toLowerCase().startsWith("lesson")) {
      const bodyContent = lines.replace(/^lesson\s*/i, "").trim()
      body = bodyContent.split(/\n\n+/).filter(p => p.trim().length > 50)
    } else if (lines.toLowerCase().startsWith("questions")) {
      // Skip - handled separately
    } else if (lines.toLowerCase().startsWith("conclusion") || lines.toLowerCase().startsWith("summary")) {
      conclusion = lines.replace(/^(conclusion|summary)\s*/i, "").trim()
    }
  }

  // If parsing failed, treat whole content as body
  if (body.length === 0) {
    body = content.split(/\n\n+/).filter(p => p.trim().length > 50)
  }

  return { intro, body, conclusion }
}

// LessonSessionService interface
export interface LessonSessionService {
  // Start a new lesson session
  readonly startLesson: (userId: string) => Effect.Effect<LessonStep, LessonSessionError>

  // Continue to next section
  readonly continueLesson: (userId: string) => Effect.Effect<LessonStep, LessonSessionError>

  // Answer a question (comprehension or mid-lesson)
  readonly answerQuestion: (
    userId: string,
    answer: string
  ) => Effect.Effect<AnswerResponse, LessonSessionError>

  // Submit feedback and complete
  readonly submitFeedback: (
    userId: string,
    rating: number,
    comment?: string
  ) => Effect.Effect<{ success: boolean; message: string }, LessonSessionError>

  // Get current session state
  readonly getSession: (userId: string) => Effect.Effect<LessonSession | null, LessonSessionError>

  // Skip current section/question
  readonly skip: (userId: string) => Effect.Effect<LessonStep, LessonSessionError>
}

// LessonSessionService Tag
export class LessonSessionServiceTag extends Context.Tag("LessonSessionService")<
  LessonSessionServiceTag,
  LessonSessionService
>() {}

// Session key helper
const sessionKey = (userId: string) => `lesson_session:${userId}`

// LessonSessionService implementation
export const LessonSessionServiceLive = Layer.effect(
  LessonSessionServiceTag,
  Effect.gen(function* () {
    const kv = yield* KVNamespaceTag
    const lessonService = yield* LessonServiceTag
    const studentService = yield* StudentServiceTag
    const chatService = yield* ChatServiceTag

    // Helper to get session from KV
    const getSessionFromKV = (userId: string): Effect.Effect<LessonSession | null, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          const data = await kv.get(sessionKey(userId), "json")
          return data as LessonSession | null
        },
        catch: (error) => new DatabaseError({ message: "Failed to get session", cause: error })
      })

    // Helper to save session to KV
    const saveSession = (session: LessonSession): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          await kv.put(sessionKey(session.userId), JSON.stringify(session), {
            expirationTtl: 86400 // 24 hours
          })
        },
        catch: (error) => new DatabaseError({ message: "Failed to save session", cause: error })
      })

    // Helper to delete session
    const deleteSession = (userId: string): Effect.Effect<void, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          await kv.delete(sessionKey(userId))
        },
        catch: (error) => new DatabaseError({ message: "Failed to delete session", cause: error })
      })

    // Build a LessonStep from session state
    const buildStep = (session: LessonSession): LessonStep => {
      const sections = parseLessonSections(session.lessonData.content)
      const bodyLength = sections.body.length
      const questionsLength = session.lessonData.questions.length

      const baseStep = {
        lessonTitle: session.lessonData.title,
        lessonType: session.lessonData.type,
        phase: session.currentPhase,
      }

      switch (session.currentPhase) {
        case "intro":
          return {
            ...baseStep,
            content: sections.intro || "Welcome to your lesson!",
            action: { type: "continue" },
            progress: { current: 0, total: bodyLength + questionsLength + 2 }
          }

        case "body":
          const bodyContent = sections.body[session.currentSectionIndex] || ""
          const shouldAskMidQuestion = (session.currentSectionIndex + 1) % 2 === 0 &&
                                        session.currentSectionIndex < bodyLength - 1
          return {
            ...baseStep,
            content: bodyContent,
            action: shouldAskMidQuestion
              ? { type: "answer_question", questionText: "Based on what you just read, what do you think is the key insight here?" }
              : { type: "continue" },
            progress: { current: session.currentSectionIndex + 1, total: bodyLength + questionsLength + 2 }
          }

        case "comprehension":
          const question = session.lessonData.questions[session.currentQuestionIndex]
          return {
            ...baseStep,
            content: `📝 Comprehension Check (Question ${session.currentQuestionIndex + 1}/${questionsLength})`,
            action: { type: "answer_question", questionText: question || "" },
            progress: { current: bodyLength + session.currentQuestionIndex + 1, total: bodyLength + questionsLength + 2 },
            question: {
              index: session.currentQuestionIndex + 1,
              total: questionsLength,
              text: question || ""
            }
          }

        case "summary":
          return {
            ...baseStep,
            content: sections.conclusion || "Great job completing this lesson!",
            action: { type: "continue" },
            progress: { current: bodyLength + questionsLength + 1, total: bodyLength + questionsLength + 2 }
          }

        case "feedback":
          return {
            ...baseStep,
            content: "How would you rate this lesson?",
            action: { type: "rate", min: 1, max: 5 },
            progress: { current: bodyLength + questionsLength + 2, total: bodyLength + questionsLength + 2 }
          }

        case "completed":
          return {
            ...baseStep,
            content: "✅ Lesson Complete! Great work on your learning journey.",
            action: { type: "complete" },
            progress: { current: bodyLength + questionsLength + 2, total: bodyLength + questionsLength + 2 }
          }
      }
    }

    // Start a new lesson
    const startLesson = (userId: string): Effect.Effect<LessonStep, LessonSessionError> =>
      Effect.gen(function* () {
        // Get or create student
        let student = yield* studentService.getByUserId(userId)
        if (!student) {
          student = yield* studentService.create({ userId })
        }

        // Generate lesson
        const lesson = yield* lessonService.generateLesson(student)
        const sections = parseLessonSections(lesson.content)

        // Create session
        const session: LessonSession = {
          lessonId: lesson.id,
          lessonData: lesson,
          userId,
          currentPhase: "intro",
          currentSectionIndex: 0,
          sectionsTotal: sections.body.length,
          currentQuestionIndex: 0,
          questionsAnswered: 0,
          questionsCorrect: 0,
          startedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString()
        }

        yield* saveSession(session)
        return buildStep(session)
      })

    // Continue to next section
    const continueLesson = (userId: string): Effect.Effect<LessonStep, LessonSessionError> =>
      Effect.gen(function* () {
        const session = yield* getSessionFromKV(userId)
        if (!session) {
          // No session - start a new lesson
          return yield* startLesson(userId)
        }

        const sections = parseLessonSections(session.lessonData.content)
        const bodyLength = sections.body.length
        const questionsLength = session.lessonData.questions.length

        // Update session based on current phase
        let updatedSession = { ...session, lastActivityAt: new Date().toISOString() }

        switch (session.currentPhase) {
          case "intro":
            updatedSession.currentPhase = "body"
            updatedSession.currentSectionIndex = 0
            break

          case "body":
            if (session.currentSectionIndex < bodyLength - 1) {
              updatedSession.currentSectionIndex++
            } else if (questionsLength > 0) {
              updatedSession.currentPhase = "comprehension"
              updatedSession.currentQuestionIndex = 0
            } else {
              updatedSession.currentPhase = "summary"
            }
            break

          case "comprehension":
            if (session.currentQuestionIndex < questionsLength - 1) {
              updatedSession.currentQuestionIndex++
            } else {
              updatedSession.currentPhase = "summary"
            }
            break

          case "summary":
            updatedSession.currentPhase = "feedback"
            break

          case "feedback":
            updatedSession.currentPhase = "completed"
            // Record lesson completion
            yield* lessonService.recordLessonHistory(
              (yield* studentService.getByUserId(userId))!.id,
              session.lessonData,
              session.questionsCorrect / Math.max(1, session.questionsAnswered),
              Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
              session.questionsAnswered
            )
            yield* studentService.recordLessonComplete(
              userId,
              session.questionsCorrect / Math.max(1, session.questionsAnswered)
            )
            yield* deleteSession(userId)
            break

          case "completed":
            // Already completed - restart
            return yield* startLesson(userId)
        }

        if (updatedSession.currentPhase !== "completed") {
          yield* saveSession(updatedSession)
        }

        return buildStep(updatedSession)
      })

    // Answer a question
    const answerQuestion = (userId: string, answer: string): Effect.Effect<AnswerResponse, LessonSessionError> =>
      Effect.gen(function* () {
        const session = yield* getSessionFromKV(userId)
        if (!session) {
          const step = yield* startLesson(userId)
          return {
            feedback: "Starting a new lesson for you...",
            isCorrect: false,
            hasFollowUp: false,
            nextStep: step
          }
        }

        // Get current question
        let questionText = ""
        if (session.currentPhase === "comprehension") {
          questionText = session.lessonData.questions[session.currentQuestionIndex] || ""
        } else if (session.currentPhase === "body") {
          questionText = "Based on what you just read, what do you think is the key insight here?"
        }

        // Evaluate answer using chat service
        const response = yield* chatService.chat({
          userId,
          message: `Question: "${questionText}"
Student's answer: "${answer}"

IMPORTANT INSTRUCTIONS:
- If the student's answer demonstrates good understanding of the key concept, say "That's right!" or similar, briefly affirm what they got correct, and DO NOT ask a follow-up question.
- Only ask a follow-up question if their answer is incorrect, incomplete, or shows a misconception.
- Keep responses brief (2-4 sentences max).
- We are studying "${session.lessonData.title}".`
        })

        // Determine if answer was correct (simple heuristic)
        const isCorrect = response.message.toLowerCase().includes("right") ||
                         response.message.toLowerCase().includes("correct") ||
                         response.message.toLowerCase().includes("exactly") ||
                         response.message.toLowerCase().includes("good")

        const hasFollowUp = response.message.includes("?")

        // Update session
        const updatedSession = {
          ...session,
          questionsAnswered: session.questionsAnswered + 1,
          questionsCorrect: session.questionsCorrect + (isCorrect ? 1 : 0),
          lastActivityAt: new Date().toISOString()
        }

        // If no follow-up, advance to next section
        if (!hasFollowUp) {
          if (session.currentPhase === "comprehension") {
            if (session.currentQuestionIndex < session.lessonData.questions.length - 1) {
              updatedSession.currentQuestionIndex++
            } else {
              updatedSession.currentPhase = "summary"
            }
          } else if (session.currentPhase === "body") {
            const sections = parseLessonSections(session.lessonData.content)
            if (session.currentSectionIndex < sections.body.length - 1) {
              updatedSession.currentSectionIndex++
            } else if (session.lessonData.questions.length > 0) {
              updatedSession.currentPhase = "comprehension"
              updatedSession.currentQuestionIndex = 0
            } else {
              updatedSession.currentPhase = "summary"
            }
          }
        }

        yield* saveSession(updatedSession)

        return {
          feedback: response.message,
          isCorrect,
          hasFollowUp,
          followUpQuestion: hasFollowUp ? response.message : undefined,
          nextStep: buildStep(updatedSession)
        }
      })

    // Submit feedback
    const submitFeedback = (
      userId: string,
      rating: number,
      comment?: string
    ): Effect.Effect<{ success: boolean; message: string }, LessonSessionError> =>
      Effect.gen(function* () {
        const session = yield* getSessionFromKV(userId)
        if (!session) {
          return { success: false, message: "No active lesson session" }
        }

        // Record lesson completion with feedback
        const student = yield* studentService.getByUserId(userId)
        if (student) {
          const comprehensionScore = session.questionsCorrect / Math.max(1, session.questionsAnswered)
          const timeSpent = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)

          yield* lessonService.recordLessonHistory(
            student.id,
            session.lessonData,
            comprehensionScore,
            timeSpent,
            session.questionsAnswered
          )
          yield* studentService.recordLessonComplete(userId, comprehensionScore)
        }

        // Clean up session
        yield* deleteSession(userId)

        return {
          success: true,
          message: `Thank you for your feedback! Rating: ${rating}/5${comment ? ` - "${comment}"` : ""}`
        }
      })

    // Get current session
    const getSession = (userId: string): Effect.Effect<LessonSession | null, LessonSessionError> =>
      getSessionFromKV(userId)

    // Skip current section
    const skip = (userId: string): Effect.Effect<LessonStep, LessonSessionError> =>
      continueLesson(userId)

    return {
      startLesson,
      continueLesson,
      answerQuestion,
      submitFeedback,
      getSession,
      skip
    }
  })
)

export const LessonSessionServiceLayer = LessonSessionServiceLive
