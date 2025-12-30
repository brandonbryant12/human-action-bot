import { Effect, Context, Layer } from "effect"

// Cloudflare environment bindings
export interface CloudflareEnv {
  readonly human_action_db: D1Database
  readonly VECTORIZE: VectorizeIndex
  readonly SESSIONS: KVNamespace
  readonly GEMINI_API_KEY: string
  readonly TELEGRAM_BOT_TOKEN: string
  readonly ENVIRONMENT: string
  readonly TUTOR_VERSION: string
  readonly MODEL_NAME: string
}

// Context tags for Cloudflare bindings
export class D1Database extends Context.Tag("D1Database")<
  D1Database,
  D1Database
>() {}

export class VectorizeIndex extends Context.Tag("VectorizeIndex")<
  VectorizeIndex,
  VectorizeIndex
>() {}

export class KVNamespace extends Context.Tag("KVNamespace")<
  KVNamespace,
  KVNamespace
>() {}

export class GoogleApiKey extends Context.Tag("GoogleApiKey")<
  GoogleApiKey,
  string
>() {}

export class TelegramBotToken extends Context.Tag("TelegramBotToken")<
  TelegramBotToken,
  string
>() {}

export class Environment extends Context.Tag("Environment")<
  Environment,
  string
>() {}

export class TutorVersion extends Context.Tag("TutorVersion")<
  TutorVersion,
  string
>() {}

export class ModelName extends Context.Tag("ModelName")<
  ModelName,
  string
>() {}

// Create a layer from Cloudflare environment
export const makeEnvLayer = (env: CloudflareEnv) =>
  Layer.mergeAll(
    Layer.succeed(D1Database, env.human_action_db as unknown as D1Database),
    Layer.succeed(VectorizeIndex, env.VECTORIZE as unknown as VectorizeIndex),
    Layer.succeed(KVNamespace, env.SESSIONS as unknown as KVNamespace),
    Layer.succeed(GoogleApiKey, env.GEMINI_API_KEY),
    Layer.succeed(TelegramBotToken, env.TELEGRAM_BOT_TOKEN ?? ""),
    Layer.succeed(Environment, env.ENVIRONMENT ?? "development"),
    Layer.succeed(TutorVersion, env.TUTOR_VERSION ?? "1.0.0"),
    Layer.succeed(ModelName, env.MODEL_NAME ?? "gemini-2.5-flash")
  )

// Helper to run an Effect with Cloudflare environment
export const runWithEnv = <A, E>(
  env: CloudflareEnv,
  effect: Effect.Effect<A, E, D1Database | VectorizeIndex | KVNamespace | GoogleApiKey | TelegramBotToken | Environment>
): Promise<A> => {
  const layer = makeEnvLayer(env)
  return Effect.runPromise(Effect.provide(effect, layer))
}

// Type-safe wrapper for running Effects that might fail
export const runWithEnvEither = <A, E>(
  env: CloudflareEnv,
  effect: Effect.Effect<A, E, D1Database | VectorizeIndex | KVNamespace | GoogleApiKey | TelegramBotToken | Environment>
): Promise<A> => {
  const layer = makeEnvLayer(env)
  return Effect.runPromise(Effect.provide(effect, layer))
}

// Error types
export class DatabaseError extends Error {
  readonly _tag = "DatabaseError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "DatabaseError"
  }
}

export class VectorizeError extends Error {
  readonly _tag = "VectorizeError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "VectorizeError"
  }
}

export class AIError extends Error {
  readonly _tag = "AIError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "AIError"
  }
}

export class TelegramError extends Error {
  readonly _tag = "TelegramError"
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "TelegramError"
  }
}
