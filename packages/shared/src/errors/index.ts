import { Data } from "effect"

// Database-related errors
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// AI/LLM-related errors
export class AIError extends Data.TaggedError("AIError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// Vectorize/embedding-related errors
export class VectorizeError extends Data.TaggedError("VectorizeError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// Telegram API-related errors
export class TelegramError extends Data.TaggedError("TelegramError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

// Validation errors
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly field?: string
  readonly cause?: unknown
}> {}

// Not found errors
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string
  readonly entity: string
  readonly id?: string | number
}> {}

// Union of all service errors
export type ServiceError =
  | DatabaseError
  | AIError
  | VectorizeError
  | TelegramError
  | ValidationError
  | NotFoundError
