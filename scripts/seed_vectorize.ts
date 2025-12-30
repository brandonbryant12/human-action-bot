/**
 * Vectorize Seeding Script
 *
 * Reads embeddings from embeddings/chunks.json
 * Seeds Cloudflare Vectorize index via wrangler
 *
 * Usage:
 *   npx tsx scripts/seed_vectorize.ts
 *
 * Prerequisites:
 *   - Run embed_chunks.ts first to generate embeddings
 *   - Vectorize index created via: wrangler vectorize create human-action-embeddings --dimensions=768 --metric=cosine
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"

interface EmbeddedChunk {
  id: string
  text: string
  metadata: {
    id: string
    chapter: number
    chunkIndex: number
    partNumber: number | null
    partTitle: string | null
    chapterTitle: string | null
  }
  embedding: number[]
}

interface VectorizeVector {
  id: string
  values: number[]
  metadata: Record<string, string | number>
}

const EMBEDDINGS_FILE = path.join(__dirname, "../embeddings/chunks.json")
const VECTORIZE_INDEX = "human-action-embeddings"
const BATCH_SIZE = 100 // Vectorize accepts up to 1000 vectors per insert

async function seedVectorize(): Promise<void> {
  console.log("Reading embeddings from:", EMBEDDINGS_FILE)

  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.error("Embeddings file not found. Run embed_chunks.ts first.")
    process.exit(1)
  }

  const embeddedChunks: EmbeddedChunk[] = JSON.parse(
    fs.readFileSync(EMBEDDINGS_FILE, "utf-8")
  )

  console.log(`Found ${embeddedChunks.length} embedded chunks`)

  // Convert to Vectorize format with NDJSON
  // Vectorize metadata must be flat key-value pairs
  const vectors: VectorizeVector[] = embeddedChunks.map(chunk => ({
    id: chunk.id,
    values: chunk.embedding,
    metadata: {
      chapter: chunk.metadata.chapter,
      chunkIndex: chunk.metadata.chunkIndex,
      partNumber: chunk.metadata.partNumber ?? 0,
      partTitle: chunk.metadata.partTitle ?? "",
      chapterTitle: chunk.metadata.chapterTitle ?? "",
      // Store first 500 chars of text for retrieval context
      textPreview: chunk.text.slice(0, 500)
    }
  }))

  // Create NDJSON file for wrangler vectorize insert
  const ndjsonPath = path.join(__dirname, "../embeddings/vectors.ndjson")
  const ndjsonContent = vectors.map(v => JSON.stringify(v)).join("\n")
  fs.writeFileSync(ndjsonPath, ndjsonContent)

  console.log(`Wrote ${vectors.length} vectors to ${ndjsonPath}`)

  // Insert vectors in batches using wrangler
  console.log("\nInserting vectors into Vectorize...")
  console.log("Run the following command to seed the index:")
  console.log(`\n  npx wrangler vectorize insert ${VECTORIZE_INDEX} --file=${ndjsonPath}\n`)

  // Also provide instructions for batch insertion if needed
  console.log("Note: If the file is too large, you may need to split it into batches.")
  console.log(`Total vectors: ${vectors.length}`)
  console.log(`Embedding dimension: ${vectors[0]?.values.length ?? 0}`)
}

// Alternative: Direct API insertion (requires API token)
async function seedVectorizeViaAPI(): Promise<void> {
  console.log("This function would use the Cloudflare API directly.")
  console.log("For now, use the wrangler CLI method above.")
}

// Run if called directly
seedVectorize().catch(console.error)
