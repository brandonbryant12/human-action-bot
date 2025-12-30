import { Effect, Context, Layer, Schema } from "effect"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { embed } from "ai"
import { VectorizeIndex, VectorizeError, GoogleApiKey } from "../lib/effect-runtime"

// Vectorize query result types (from Cloudflare Workers types)
interface VectorizeMatch {
  id: string
  score: number
  metadata?: Record<string, string | number | boolean | null>
}

interface VectorizeQueryResult {
  matches: VectorizeMatch[]
  count: number
}

interface VectorizeIndexType {
  query(
    vector: number[],
    options?: {
      topK?: number
      filter?: Record<string, unknown>
      returnMetadata?: "all" | "indexed" | "none"
    }
  ): Promise<VectorizeQueryResult>
}

// Schema for retrieved chunks
export const RetrievedChunkSchema = Schema.Struct({
  id: Schema.String,
  score: Schema.Number,
  chapter: Schema.Number,
  chunkIndex: Schema.Number,
  partNumber: Schema.Number,
  partTitle: Schema.String,
  chapterTitle: Schema.String,
  textPreview: Schema.String
})

export type RetrievedChunk = Schema.Schema.Type<typeof RetrievedChunkSchema>

// RAG search options
export interface RAGSearchOptions {
  query: string
  topK?: number
  chapterFilter?: number
  minScore?: number
}

// RAG search result
export interface RAGSearchResult {
  chunks: RetrievedChunk[]
  query: string
  embeddingTime: number
  searchTime: number
}

// RAGService interface
export interface RAGService {
  readonly search: (options: RAGSearchOptions) => Effect.Effect<RAGSearchResult, VectorizeError>
  readonly getChunksByChapter: (chapter: number, limit?: number) => Effect.Effect<RetrievedChunk[], VectorizeError>
}

// RAGService Tag
export class RAGServiceTag extends Context.Tag("RAGService")<
  RAGServiceTag,
  RAGService
>() {}

// RAGService implementation
export const RAGServiceLive = Layer.effect(
  RAGServiceTag,
  Effect.gen(function* () {
    const vectorize = yield* VectorizeIndex
    const apiKey = yield* GoogleApiKey

    // Initialize Google AI with API key
    const google = createGoogleGenerativeAI({ apiKey })

    // Helper to generate embedding for a query
    const getQueryEmbedding = (query: string): Effect.Effect<{ embedding: number[]; time: number }, VectorizeError> =>
      Effect.tryPromise({
        try: async () => {
          const start = Date.now()
          const { embedding } = await embed({
            model: google.textEmbeddingModel("text-embedding-004"),
            value: query
          })
          return {
            embedding,
            time: Date.now() - start
          }
        },
        catch: (error) => new VectorizeError("Failed to generate embedding", error)
      })

    // Search for relevant chunks
    const search = (options: RAGSearchOptions): Effect.Effect<RAGSearchResult, VectorizeError> =>
      Effect.gen(function* () {
        const { query, topK = 5, chapterFilter, minScore = 0.5 } = options

        // Generate query embedding
        const { embedding, time: embeddingTime } = yield* getQueryEmbedding(query)

        // Search Vectorize
        const searchStart = Date.now()
        const results = yield* Effect.tryPromise({
          try: async () => {
            const index = vectorize as unknown as VectorizeIndexType
            const options: {
              topK: number
              filter?: Record<string, unknown>
              returnMetadata: "all"
            } = {
              topK,
              returnMetadata: "all"
            }
            // Add filter only if chapter specified
            if (chapterFilter !== undefined) {
              options.filter = { chapter: chapterFilter }
            }
            const queryResult = await index.query(embedding, options)
            return queryResult
          },
          catch: (error) => new VectorizeError("Vectorize query failed", error)
        })

        const searchTime = Date.now() - searchStart

        // Parse and filter results
        const chunks: RetrievedChunk[] = results.matches
          .filter((match: VectorizeMatch) => match.score >= minScore)
          .map((match: VectorizeMatch) => ({
            id: match.id,
            score: match.score,
            chapter: (match.metadata?.chapter as number) ?? 0,
            chunkIndex: (match.metadata?.chunkIndex as number) ?? 0,
            partNumber: (match.metadata?.partNumber as number) ?? 0,
            partTitle: (match.metadata?.partTitle as string) ?? "",
            chapterTitle: (match.metadata?.chapterTitle as string) ?? "",
            textPreview: (match.metadata?.textPreview as string) ?? ""
          }))

        return {
          chunks,
          query,
          embeddingTime,
          searchTime
        }
      })

    // Get chunks by chapter (useful for lesson content)
    const getChunksByChapter = (chapter: number, limit = 10): Effect.Effect<RetrievedChunk[], VectorizeError> =>
      Effect.gen(function* () {
        // For chapter-specific retrieval, we use a semantic query
        // and filter results by chapter number post-query
        const result = yield* search({
          query: `Chapter ${chapter} main concepts core ideas key principles`,
          topK: limit * 3, // Get more results to filter
          minScore: 0.3 // Lower threshold for chapter-specific queries
        })

        // Filter by chapter number
        const chapterChunks = result.chunks.filter(c => c.chapter === chapter)

        // If no exact chapter match, return closest results
        return chapterChunks.length > 0 ? chapterChunks.slice(0, limit) : result.chunks.slice(0, limit)
      })

    return {
      search,
      getChunksByChapter
    }
  })
)

// Convenience function to provide RAGService with dependencies
export const RAGServiceLayer = RAGServiceLive
