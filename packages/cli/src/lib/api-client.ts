import { Effect, Context, Layer } from "effect"

// API configuration
export interface ApiConfig {
  baseUrl: string
  userId: string
}

// API response types
export interface ChatResponse {
  message: string
  sources?: Array<{
    chapterId: string
    chapterTitle: string
    score: number
  }>
}

export interface LessonResponse {
  id: string
  type: string
  chapter: number
  title: string
  content: string
  questions: string[]
  estimatedMinutes: number
}

export interface ProgressResponse {
  student: {
    userId: string
    currentChapter: number
    totalLessonsCompleted: number
    averageComprehensionScore: number
    paceMultiplier: number
  }
  recentLessons: Array<{
    chapterNumber: number
    lessonType: string
    comprehensionScore: number | null
    completedAt: string
  }>
  pacing: {
    paceMultiplier: number
    shouldAdvance: boolean
    recommendedLessonType: string
    reasoning: string
  }
}

export interface VersionResponse {
  tutorVersion: string
  modelName: string
  environment: string
}

export interface FeedbackRequest {
  feedbackType: "lesson" | "chat" | "overall"
  rating: number
  comment?: string
  lessonId?: string
  chapterNumber?: number
  clientType?: string
}

export interface FeedbackResponse {
  success: boolean
  message: string
}

// API errors
export class ApiError extends Error {
  readonly _tag = "ApiError"
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ApiClient Tag
export class ApiClientTag extends Context.Tag("ApiClient")<
  ApiClientTag,
  ApiClient
>() {}

// ApiClient interface
export interface ApiClient {
  readonly chat: (message: string) => Effect.Effect<ChatResponse, ApiError>
  readonly getLesson: () => Effect.Effect<LessonResponse, ApiError>
  readonly getProgress: () => Effect.Effect<ProgressResponse, ApiError>
  readonly createStudent: (displayName?: string) => Effect.Effect<void, ApiError>
  readonly getVersion: () => Effect.Effect<VersionResponse, ApiError>
  readonly submitFeedback: (feedback: FeedbackRequest) => Effect.Effect<FeedbackResponse, ApiError>
}

// ApiClient implementation
export const makeApiClient = (config: ApiConfig): ApiClient => {
  const request = async <T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> => {
    const url = `${config.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new ApiError(
        `API request failed: ${response.status}`,
        response.status,
        error
      )
    }

    return response.json() as Promise<T>
  }

  return {
    chat: (message: string) =>
      Effect.tryPromise({
        try: () =>
          request<ChatResponse>("/chat", {
            method: "POST",
            body: JSON.stringify({
              userId: config.userId,
              message
            })
          }),
        catch: (error) =>
          error instanceof ApiError
            ? error
            : new ApiError("Chat request failed", undefined, error)
      }),

    getLesson: () =>
      Effect.tryPromise({
        try: () =>
          request<LessonResponse>(`/lesson?userId=${config.userId}`),
        catch: (error) =>
          error instanceof ApiError
            ? error
            : new ApiError("Lesson request failed", undefined, error)
      }),

    getProgress: () =>
      Effect.tryPromise({
        try: () =>
          request<ProgressResponse>(`/progress?userId=${config.userId}`),
        catch: (error) =>
          error instanceof ApiError
            ? error
            : new ApiError("Progress request failed", undefined, error)
      }),

    createStudent: (displayName?: string) =>
      Effect.tryPromise({
        try: async () => {
          await request("/progress", {
            method: "POST",
            body: JSON.stringify({
              userId: config.userId,
              displayName
            })
          })
        },
        catch: (error) =>
          error instanceof ApiError
            ? error
            : new ApiError("Create student failed", undefined, error)
      }),

    getVersion: () =>
      Effect.tryPromise({
        try: () => request<VersionResponse>("/version"),
        catch: (error) =>
          error instanceof ApiError
            ? error
            : new ApiError("Version request failed", undefined, error)
      }),

    submitFeedback: (feedback: FeedbackRequest) =>
      Effect.tryPromise({
        try: () =>
          request<FeedbackResponse>("/feedback", {
            method: "POST",
            body: JSON.stringify({
              userId: config.userId,
              ...feedback
            })
          }),
        catch: (error) =>
          error instanceof ApiError
            ? error
            : new ApiError("Feedback submission failed", undefined, error)
      })
  }
}

// Create ApiClient layer
export const ApiClientLive = (config: ApiConfig) =>
  Layer.succeed(ApiClientTag, makeApiClient(config))
