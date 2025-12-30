# Human Action Bot - Implementation Prompt

You are building an adaptive AI tutor for Ludwig von Mises' "Human Action" book.

## Context

- Book content exists at: `content/books/human-action/` (326 chunks, 42 chapters, index.json)
- Stack: Effect TS + Cloudflare Workers + AI SDK (Google Gemini) + Hono + Telegram
- Monorepo structure with `packages/worker` and `packages/cli`

## Current Task

Check the implementation status and continue building. On each iteration:

1. **Assess Progress**: Read `STATUS.md` (create if missing) to see what's done
2. **Pick Next Task**: Choose the next uncompleted task from the checklist below
3. **Implement**: Write working code with proper Effect TS patterns
4. **Test**: Verify the code works (run type checks, basic tests)
5. **Update Status**: Mark completed tasks in `STATUS.md`
6. **Commit**: Commit your changes with a descriptive message

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create monorepo structure (pnpm-workspace.yaml, package.json, tsconfig.base.json)
- [ ] Set up worker package (wrangler.toml, package.json with effect + hono + ai-sdk deps)
- [ ] Create D1 schema (packages/worker/src/db/schema.sql) with students, lesson_history, conversations, struggle_log tables
- [ ] Set up Effect runtime for Cloudflare Workers (packages/worker/src/lib/effect-runtime.ts)
- [ ] Create Hono app entry point (packages/worker/src/index.ts)

### Phase 2: RAG Pipeline
- [ ] Create embedding script (scripts/embed_chunks.ts) - reads chunks, generates embeddings
- [ ] Create Vectorize seeding script (scripts/seed_vectorize.ts)
- [ ] Build RAGService with Effect (packages/worker/src/services/RAGService.ts)
- [ ] Test RAG with sample queries

### Phase 3: Core Services
- [ ] Create AIService wrapper for AI SDK (packages/worker/src/services/AIService.ts)
- [ ] Build StudentService (packages/worker/src/services/StudentService.ts) - profile CRUD
- [ ] Build ConversationService (packages/worker/src/services/ConversationService.ts) - memory
- [ ] Create tutor system prompt (packages/worker/src/prompts/tutor.ts)
- [ ] Build ChatService (packages/worker/src/services/ChatService.ts) - RAG + conversation

### Phase 4: Lesson System
- [ ] Build LessonService (packages/worker/src/services/LessonService.ts) - progression logic
- [ ] Create comprehension assessment prompt (packages/worker/src/prompts/comprehension.ts)
- [ ] Build ComprehensionService (packages/worker/src/services/ComprehensionService.ts)
- [ ] Build AdaptivePacingService (packages/worker/src/services/AdaptivePacingService.ts)
- [ ] Set up Cron Trigger for daily lessons in wrangler.toml

### Phase 5: Current Events
- [ ] Create currentEvents prompt (packages/worker/src/prompts/currentEvents.ts)
- [ ] Build NewsService (packages/worker/src/services/NewsService.ts) - optional RSS fetch
- [ ] Add /news route for current events analysis

### Phase 6: Routes & API
- [ ] Create /chat route (packages/worker/src/routes/chat.ts)
- [ ] Create /lesson route (packages/worker/src/routes/lessons.ts)
- [ ] Create /progress route for student progress
- [ ] Add health check route

### Phase 7: Telegram Integration
- [ ] Build TelegramService (packages/worker/src/services/TelegramService.ts)
- [ ] Create Telegram webhook route (packages/worker/src/routes/telegram.ts)
- [ ] Implement commands: /start, /lesson, /chat, /progress, /news, /help
- [ ] Handle inline message conversations

### Phase 8: CLI Client
- [ ] Set up cli package (packages/cli/package.json)
- [ ] Create API client (packages/cli/src/lib/api-client.ts)
- [ ] Build chat command (packages/cli/src/commands/chat.ts)
- [ ] Build lesson command (packages/cli/src/commands/lesson.ts)
- [ ] Build progress command (packages/cli/src/commands/progress.ts)
- [ ] Create CLI entry point with commander/ink

### Phase 9: Testing
- [ ] Set up Vitest for worker package (packages/worker/vitest.config.ts)
- [ ] Write unit tests for StudentService
- [ ] Write unit tests for LessonService
- [ ] Write unit tests for RAGService
- [ ] Write unit tests for ChatService
- [ ] Write unit tests for ComprehensionService
- [ ] Write integration tests for API routes
- [ ] All tests passing (`pnpm test` exits with code 0)

### Phase 10: Documentation
- [ ] Create root README.md with project overview
- [ ] Document Cloudflare setup (D1, Vectorize, KV, Workers)
- [ ] Document Telegram Bot setup (BotFather, webhook URL)
- [ ] Document Google AI API setup (API key, model selection)
- [ ] Document environment variables (.env.example)
- [ ] Document local development workflow
- [ ] Document deployment instructions

## Effect TS Patterns to Use

```typescript
// Service definition
class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function* () {
    const dep = yield* SomeDependency
    return {
      myMethod: (arg: string) => Effect.gen(function* () {
        // implementation
      })
    }
  }),
  dependencies: [SomeDependency]
}) {}

// Schema for validation
const StudentSchema = Schema.Struct({
  userId: Schema.String,
  currentChapter: Schema.Number,
  paceMultiplier: Schema.Number
})

// Parallel operations
const [context, history] = yield* Effect.all([
  ragService.search(query),
  conversationService.getHistory(userId)
])
```

## AI SDK Pattern

```typescript
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

const response = await generateText({
  model: google('gemini-2.0-flash-exp'),
  system: TUTOR_SYSTEM_PROMPT,
  messages: conversationHistory
})
```

## Key Files Reference

- Book index: `content/books/human-action/index.json`
- Chunks: `content/books/human-action/chunks/ch{01-39}_chunk{000-XXX}.txt`
- Chapters: `content/books/human-action/chapters/*.md`

## Success Criteria

All phases complete when:
1. Worker deploys successfully to Cloudflare
2. RAG retrieves relevant Human Action passages
3. Telegram bot responds to /lesson and /chat commands
4. CLI can start a chat session
5. Student progress is tracked in D1
6. Comprehension assessment adjusts pacing
7. **All tests pass** (`pnpm test` exits with code 0)
8. **README.md exists** with complete setup instructions for:
   - Cloudflare account & wrangler CLI setup
   - Creating D1 database and running migrations
   - Creating Vectorize index
   - Setting up Telegram bot via BotFather
   - Getting Google AI API key
   - Environment variables configuration
   - Local development commands
   - Deployment steps

When ALL checklist items are complete, tests pass, and documentation is written, output:
<promise>HUMAN ACTION BOT COMPLETE</promise>

## Notes

- Use pnpm as package manager
- Prefer @effect/platform for HTTP client in CLI
- Keep services small and composable
- Write code that compiles (run tsc --noEmit to verify)
- Don't skip steps - each iteration should make measurable progress

## Testing Guidelines

- Use Vitest as test runner
- Use @cloudflare/vitest-pool-workers for Worker testing
- Mock external services (AI SDK, Telegram API) in unit tests
- Test Effect services by providing test layers
- Run `pnpm test` after each phase to catch regressions
- Aim for >80% coverage on core services

```typescript
// Example test pattern for Effect services
import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'

describe('StudentService', () => {
  const TestD1 = Layer.succeed(D1Database, mockD1)

  it('creates a new student', async () => {
    const program = Effect.gen(function* () {
      const service = yield* StudentService
      return yield* service.createStudent('user-123')
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestD1))
    )
    expect(result.userId).toBe('user-123')
  })
})
```

## README Structure

The README.md should include:

```markdown
# Human Action Bot

AI tutor for Ludwig von Mises' "Human Action"

## Prerequisites
- Node.js 20+
- pnpm 9+
- Cloudflare account
- Telegram account
- Google AI API key

## Quick Start
1. Clone & install
2. Set up environment
3. Run locally

## External Services Setup

### Cloudflare
- Create account at cloudflare.com
- Install wrangler: `pnpm add -g wrangler`
- Login: `wrangler login`
- Create D1: `wrangler d1 create human-action-db`
- Create Vectorize: `wrangler vectorize create human-action-embeddings`
- Create KV: `wrangler kv namespace create SESSIONS`

### Telegram Bot
- Message @BotFather on Telegram
- Send /newbot, follow prompts
- Copy the bot token
- Set webhook after deployment

### Google AI
- Go to ai.google.dev
- Create API key
- Add to .env

## Environment Variables
(list all required vars)

## Development
- `pnpm dev` - Start local worker
- `pnpm test` - Run tests
- `pnpm build` - Build for production

## Deployment
- `pnpm deploy` - Deploy to Cloudflare
```
