import { Effect, Context, Layer } from "effect"
import { AIServiceTag } from "./AIService"
import { RAGServiceTag } from "./RAGService"
import { StudentServiceTag } from "./StudentService"
import type { Student } from "./StudentService"
import { buildNewsAnalysisPrompt } from "../prompts/currentEvents"
import { AIError, VectorizeError, DatabaseError } from "../lib/effect-runtime"

// News analysis request
export interface NewsAnalysisRequest {
  content: string
  source: string | undefined
  url: string | undefined
}

// News analysis result
export interface NewsAnalysisResult {
  summary: string
  analysis: string
  keyConcept: string
  relevantQuote: string | null
  discussionQuestion: string
  relatedChunks: Array<{
    id: string
    chapterTitle: string
    score: number
  }>
}

// NewsService error type
export type NewsError = AIError | VectorizeError | DatabaseError

// NewsService interface
export interface NewsService {
  readonly analyzeNews: (
    student: Student,
    request: NewsAnalysisRequest
  ) => Effect.Effect<NewsAnalysisResult, NewsError>
  readonly discussTopic: (
    student: Student,
    topic: string,
    question: string
  ) => Effect.Effect<string, NewsError>
}

// NewsService Tag
export class NewsServiceTag extends Context.Tag("NewsService")<
  NewsServiceTag,
  NewsService
>() {}

// NewsService implementation
export const NewsServiceLive = Layer.effect(
  NewsServiceTag,
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag
    const ragService = yield* RAGServiceTag
    yield* StudentServiceTag // Ensure dependency is available

    // Analyze a news item through Austrian economics lens
    const analyzeNews = (
      student: Student,
      request: NewsAnalysisRequest
    ): Effect.Effect<NewsAnalysisResult, NewsError> =>
      Effect.gen(function* () {
        // Get relevant context from RAG
        const ragResult = yield* ragService.search({
          query: `economic analysis ${request.content}`,
          topK: 3,
          minScore: 0.3
        })

        const ragContext =
          ragResult.chunks.length > 0
            ? ragResult.chunks
                .map((chunk) => `[${chunk.chapterTitle}]\n${chunk.textPreview}`)
                .join("\n\n---\n\n")
            : undefined

        // Build system prompt
        const systemPrompt = buildNewsAnalysisPrompt(
          request.content,
          student.currentChapter,
          ragResult.chunks[0]?.chapterTitle ?? "Introduction",
          ragContext
        )

        // Generate analysis
        const result = yield* aiService.generate({
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Please analyze this news item: ${request.content}`
            }
          ]
        })

        // Parse the response
        const text = result.text
        const summaryMatch = text.match(/### Summary\n([\s\S]*?)(?=\n###|$)/i)
        const analysisMatch = text.match(/### Austrian Analysis\n([\s\S]*?)(?=\n###|$)/i)
        const conceptMatch = text.match(/### Key Concept\n([\s\S]*?)(?=\n###|$)/i)
        const quoteMatch = text.match(/### Relevant Quote\n([\s\S]*?)(?=\n###|$)/i)
        const questionMatch = text.match(/### Discussion Question\n([\s\S]*?)$/i)

        return {
          summary: summaryMatch?.[1]?.trim() ?? "",
          analysis: analysisMatch?.[1]?.trim() ?? text,
          keyConcept: conceptMatch?.[1]?.trim() ?? "Praxeology",
          relevantQuote: quoteMatch?.[1]?.trim() || null,
          discussionQuestion: questionMatch?.[1]?.trim() ?? "What do you think?",
          relatedChunks: ragResult.chunks.map((chunk) => ({
            id: chunk.id,
            chapterTitle: chunk.chapterTitle,
            score: chunk.score
          }))
        }
      })

    // Have a discussion about a current events topic
    const discussTopic = (
      student: Student,
      topic: string,
      question: string
    ): Effect.Effect<string, NewsError> =>
      Effect.gen(function* () {
        // Get relevant context from RAG
        const ragResult = yield* ragService.search({
          query: `${topic} ${question}`,
          topK: 3,
          minScore: 0.3
        })

        const context =
          ragResult.chunks.length > 0
            ? ragResult.chunks
                .map((chunk) => `[${chunk.chapterTitle}]\n${chunk.textPreview}`)
                .join("\n\n---\n\n")
            : "No specific passages found, but general Austrian economic principles apply."

        const result = yield* aiService.generate({
          system: `You are an expert in Austrian economics helping a student understand current events through the lens of Human Action. The student is studying Chapter ${student.currentChapter}. Use the Socratic method when appropriate.`,
          messages: [
            {
              role: "user",
              content: `Topic: ${topic}\n\nMy question: ${question}\n\nRelevant context from Human Action:\n${context}`
            }
          ]
        })

        return result.text
      })

    return {
      analyzeNews,
      discussTopic
    }
  })
)

export const NewsServiceLayer = NewsServiceLive
