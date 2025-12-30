import { Effect, Context, Layer } from "effect"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import type { CoreMessage } from "ai"
import { GoogleApiKey, AIError, ModelName } from "../lib/effect-runtime"

// AI generation options
export interface AIGenerateOptions {
  system: string
  messages: CoreMessage[]
  maxTokens?: number
  temperature?: number
}

// AI generation result
export interface AIGenerateResult {
  text: string
  finishReason: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// AIService interface
export interface AIService {
  readonly generate: (options: AIGenerateOptions) => Effect.Effect<AIGenerateResult, AIError>
  readonly generateSimple: (prompt: string, system?: string) => Effect.Effect<string, AIError>
}

// AIService Tag
export class AIServiceTag extends Context.Tag("AIService")<
  AIServiceTag,
  AIService
>() {}

// AIService implementation
export const AIServiceLive = Layer.effect(
  AIServiceTag,
  Effect.gen(function* () {
    const apiKey = yield* GoogleApiKey
    const modelName = yield* ModelName

    // Validate API key exists
    if (!apiKey) {
      yield* Effect.fail(new AIError("GEMINI_API_KEY not configured"))
    }

    // Initialize Google AI with API key
    const google = createGoogleGenerativeAI({ apiKey })

    // Full generation with conversation history
    const generate = (options: AIGenerateOptions): Effect.Effect<AIGenerateResult, AIError> =>
      Effect.tryPromise({
        try: async () => {
          const { system, messages, maxTokens = 2048, temperature = 0.7 } = options

          const response = await generateText({
            model: google(modelName),
            system,
            messages,
            maxTokens,
            temperature
          })

          return {
            text: response.text,
            finishReason: response.finishReason,
            usage: {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.promptTokens + response.usage.completionTokens
            }
          }
        },
        catch: (error) => new AIError("AI generation failed", error)
      })

    // Simple one-shot generation
    const generateSimple = (prompt: string, system?: string): Effect.Effect<string, AIError> =>
      Effect.gen(function* () {
        const result = yield* generate({
          system: system ?? "You are a helpful assistant.",
          messages: [{ role: "user", content: prompt }]
        })
        return result.text
      })

    return {
      generate,
      generateSimple
    }
  })
)

export const AIServiceLayer = AIServiceLive
