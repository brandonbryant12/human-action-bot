/**
 * Embedding Script for Human Action Book Chunks
 *
 * Reads all text chunks from books/human-action/chunks/
 * Generates embeddings using Google's embedding model
 * Outputs to embeddings/chunks.json
 */

import { google } from "@ai-sdk/google"
import { embedMany } from "ai"
import * as fs from "node:fs"
import * as path from "node:path"

interface ChunkMetadata {
  id: string
  chapter: number
  chunkIndex: number
  partNumber: number | null
  partTitle: string | null
  chapterTitle: string | null
}

interface EmbeddedChunk {
  id: string
  text: string
  metadata: ChunkMetadata
  embedding: number[]
}

const CHUNKS_DIR = path.join(__dirname, "../books/human-action/chunks")
const OUTPUT_DIR = path.join(__dirname, "../embeddings")
const OUTPUT_FILE = path.join(OUTPUT_DIR, "chunks.json")
const INDEX_FILE = path.join(__dirname, "../books/human-action/index.json")

// Batch size for embedding API calls
const BATCH_SIZE = 20

function parseChunkFile(filename: string, content: string): { text: string; metadata: ChunkMetadata } {
  const lines = content.split("\n")

  // Parse the chunk ID from filename (e.g., ch01_chunk000.txt)
  const match = filename.match(/ch(\d+)_chunk(\d+)\.txt/)
  if (!match) {
    throw new Error(`Invalid chunk filename: ${filename}`)
  }

  const chapter = parseInt(match[1], 10)
  const chunkIndex = parseInt(match[2], 10)
  const id = `ch${String(chapter).padStart(2, "0")}_chunk${String(chunkIndex).padStart(3, "0")}`

  // Parse header lines for metadata
  let partNumber: number | null = null
  let partTitle: string | null = null
  let chapterTitle: string | null = null

  for (const line of lines.slice(0, 3)) {
    const chapterMatch = line.match(/\[Chapter (\d+): (.+?)\]/)
    if (chapterMatch) {
      chapterTitle = chapterMatch[2]
    }

    const partMatch = line.match(/\[Part (\d+): (.+?)\]/)
    if (partMatch) {
      partNumber = parseInt(partMatch[1], 10)
      partTitle = partMatch[2]
    }
  }

  // Get the text content (skip header lines, join rest)
  const textStart = lines.findIndex(line => line.trim() && !line.startsWith("["))
  const text = lines.slice(textStart).join("\n").trim()

  return {
    text,
    metadata: {
      id,
      chapter,
      chunkIndex,
      partNumber,
      partTitle,
      chapterTitle
    }
  }
}

async function embedChunks(): Promise<void> {
  console.log("Reading chunks from:", CHUNKS_DIR)

  // Read all chunk files
  const files = fs.readdirSync(CHUNKS_DIR)
    .filter(f => f.endsWith(".txt"))
    .sort()

  console.log(`Found ${files.length} chunk files`)

  // Parse all chunks
  const chunks: { text: string; metadata: ChunkMetadata }[] = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(CHUNKS_DIR, file), "utf-8")
    chunks.push(parseChunkFile(file, content))
  }

  console.log(`Parsed ${chunks.length} chunks`)

  // Generate embeddings in batches
  const embeddedChunks: EmbeddedChunk[] = []

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const batchTexts = batch.map(c => c.text)

    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`)

    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel("text-embedding-004"),
      values: batchTexts
    })

    for (let j = 0; j < batch.length; j++) {
      embeddedChunks.push({
        id: batch[j].metadata.id,
        text: batch[j].text,
        metadata: batch[j].metadata,
        embedding: embeddings[j]
      })
    }

    // Small delay to avoid rate limiting
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Write embeddings to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(embeddedChunks, null, 2))
  console.log(`Wrote ${embeddedChunks.length} embedded chunks to ${OUTPUT_FILE}`)

  // Also output a summary
  const summary = {
    totalChunks: embeddedChunks.length,
    embeddingDimension: embeddedChunks[0]?.embedding.length ?? 0,
    chapters: [...new Set(embeddedChunks.map(c => c.metadata.chapter))].length,
    generatedAt: new Date().toISOString()
  }

  console.log("\nSummary:", summary)
}

// Run if called directly
embedChunks().catch(console.error)
