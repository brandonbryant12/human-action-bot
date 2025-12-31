import { Effect, Context, Layer } from "effect"

// Re-export Cloudflare types with aliases to avoid shadowing
type CFD1Database = D1Database
type CFVectorizeIndex = VectorizeIndex
type CFKVNamespace = KVNamespace

// Cloudflare environment bindings
export interface CloudflareEnv {
  readonly human_action_db: CFD1Database
  readonly VECTORIZE: CFVectorizeIndex
  readonly SESSIONS: CFKVNamespace
  readonly GEMINI_API_KEY: string
  readonly TELEGRAM_BOT_TOKEN: string
  readonly ENVIRONMENT: string
  readonly TUTOR_VERSION: string
  readonly MODEL_NAME: string
}

// Context tags for Cloudflare bindings
export class D1DatabaseTag extends Context.Tag("D1Database")<
  D1DatabaseTag,
  CFD1Database
>() {}

export class VectorizeIndexTag extends Context.Tag("VectorizeIndex")<
  VectorizeIndexTag,
  CFVectorizeIndex
>() {}

export class KVNamespaceTag extends Context.Tag("KVNamespace")<
  KVNamespaceTag,
  CFKVNamespace
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
    Layer.succeed(D1DatabaseTag, env.human_action_db),
    Layer.succeed(VectorizeIndexTag, env.VECTORIZE),
    Layer.succeed(KVNamespaceTag, env.SESSIONS),
    Layer.succeed(GoogleApiKey, env.GEMINI_API_KEY),
    Layer.succeed(TelegramBotToken, env.TELEGRAM_BOT_TOKEN ?? ""),
    Layer.succeed(Environment, env.ENVIRONMENT ?? "development"),
    Layer.succeed(TutorVersion, env.TUTOR_VERSION ?? "1.0.0"),
    Layer.succeed(ModelName, env.MODEL_NAME ?? "gemini-2.5-flash")
  )

// Helper to run an Effect with Cloudflare environment
export const runWithEnv = <A, E>(
  env: CloudflareEnv,
  effect: Effect.Effect<A, E, D1DatabaseTag | VectorizeIndexTag | KVNamespaceTag | GoogleApiKey | TelegramBotToken | Environment>
): Promise<A> => {
  const layer = makeEnvLayer(env)
  return Effect.runPromise(Effect.provide(effect, layer))
}

// Type-safe wrapper for running Effects that might fail
export const runWithEnvEither = <A, E>(
  env: CloudflareEnv,
  effect: Effect.Effect<A, E, D1DatabaseTag | VectorizeIndexTag | KVNamespaceTag | GoogleApiKey | TelegramBotToken | Environment>
): Promise<A> => {
  const layer = makeEnvLayer(env)
  return Effect.runPromise(Effect.provide(effect, layer))
}

// Error types are now re-exported from @human-action-bot/shared
export {
  DatabaseError,
  AIError,
  VectorizeError,
  TelegramError
} from "@human-action-bot/shared"
