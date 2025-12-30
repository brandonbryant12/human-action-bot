# Human Action Bot

AI tutor for Ludwig von Mises' "Human Action: A Treatise on Economics"

An adaptive learning platform that uses RAG (Retrieval-Augmented Generation) and AI to guide students through one of the most important economics texts ever written.

## Features

- **Socratic Tutoring**: Engages students with questions that guide them to discover economic principles
- **RAG-Powered Context**: Retrieves relevant passages from Human Action to ground responses
- **Adaptive Pacing**: Adjusts lesson difficulty based on comprehension scores
- **Progress Tracking**: Monitors student advancement through chapters and concepts
- **Current Events Analysis**: Applies Austrian economics to contemporary news
- **Multi-Platform**: Available via Telegram bot, CLI, and REST API

## Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account (for deployment)
- Google AI API key (for Gemini model)
- Telegram Bot Token (optional, for Telegram integration)

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/human-action-bot.git
cd human-action-bot
pnpm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Locally

```bash
# Start the worker in development mode
pnpm dev

# In another terminal, use the CLI
cd packages/cli
pnpm dev chat
```

## External Services Setup

### Cloudflare

1. **Create Account**
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Install Wrangler: `pnpm add -g wrangler`

2. **Login to Wrangler**
   ```bash
   wrangler login
   ```

3. **Create D1 Database**
   ```bash
   wrangler d1 create human-action-db
   ```
   Update `wrangler.toml` with the database ID from the output.

4. **Run D1 Migrations**
   ```bash
   wrangler d1 execute human-action-db --file=packages/worker/src/db/schema.sql
   ```

5. **Create Vectorize Index**
   ```bash
   wrangler vectorize create human-action-embeddings --dimensions=768 --metric=cosine
   ```
   Update `wrangler.toml` with the index name.

6. **Create KV Namespace**
   ```bash
   wrangler kv namespace create SESSIONS
   ```
   Update `wrangler.toml` with the namespace ID.

### Google AI (Gemini)

1. Go to [ai.google.dev](https://ai.google.dev)
2. Create an API key
3. Set as secret:
   ```bash
   wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
   ```

### Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token
4. Set as secret:
   ```bash
   wrangler secret put TELEGRAM_BOT_TOKEN
   ```
5. After deployment, set the webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-worker.workers.dev/telegram/webhook"
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI API key for Gemini | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather | For Telegram |
| `ENVIRONMENT` | `development` or `production` | No (defaults to development) |

For local development, create a `.dev.vars` file:
```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
TELEGRAM_BOT_TOKEN=your-token-here
```

## Project Structure

```
human-action-bot/
├── books/
│   └── human-action/
│       ├── chapters/          # Full chapter markdown files
│       ├── chunks/            # Text chunks for RAG
│       └── index.json         # Book metadata
├── packages/
│   ├── worker/                # Cloudflare Worker
│   │   ├── src/
│   │   │   ├── db/           # D1 schema
│   │   │   ├── lib/          # Effect runtime
│   │   │   ├── prompts/      # AI prompts
│   │   │   ├── routes/       # Hono routes
│   │   │   └── services/     # Business logic
│   │   └── wrangler.toml
│   └── cli/                   # Command-line interface
│       └── src/
│           ├── commands/      # CLI commands
│           └── lib/           # API client
├── scripts/
│   ├── embed_chunks.ts        # Generate embeddings
│   └── seed_vectorize.ts      # Seed Vectorize index
└── package.json
```

## Development

### Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Build for production
pnpm build
```

### Generating Embeddings

Before the RAG system can work, you need to generate embeddings:

```bash
# Generate embeddings (requires GOOGLE_GENERATIVE_AI_API_KEY)
npx tsx scripts/embed_chunks.ts

# Seed Vectorize index
wrangler vectorize insert human-action-embeddings --file=embeddings/vectors.ndjson
```

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and endpoints |
| `/health` | GET | Health check |
| `/chat` | POST | Chat with the tutor |
| `/lesson` | GET | Get next lesson |
| `/lesson/comprehension` | POST | Submit comprehension answer |
| `/progress` | GET | Get student progress |
| `/progress` | POST | Create/update student |
| `/news` | POST | Analyze news through Austrian lens |
| `/telegram/webhook` | POST | Telegram bot webhook |

### Example Requests

**Chat:**
```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "message": "What is praxeology?"}'
```

**Get Lesson:**
```bash
curl "http://localhost:8787/lesson?userId=user123"
```

**Check Progress:**
```bash
curl "http://localhost:8787/progress?userId=user123"
```

## CLI Usage

```bash
# Interactive chat
human-action chat

# Get a lesson
human-action lesson

# View progress
human-action progress

# Show configuration
human-action config
```

Set these environment variables for the CLI:
```bash
export HUMAN_ACTION_API_URL="https://your-worker.workers.dev"
export HUMAN_ACTION_USER_ID="your-unique-id"
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Begin learning journey |
| `/lesson` | Get today's lesson |
| `/chat` | Start a conversation |
| `/progress` | View learning progress |
| `/news <topic>` | Analyze news event |
| `/help` | Show help message |

## Architecture

- **Effect TS**: Type-safe functional programming
- **Hono**: Lightweight web framework
- **AI SDK**: Unified interface for AI models
- **Cloudflare Workers**: Serverless edge compute
- **D1**: SQLite database for student data
- **Vectorize**: Vector database for RAG
- **KV**: Key-value store for sessions

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter @human-action-bot/worker test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and type checking
5. Submit a pull request

## License

MIT

## Acknowledgments

- Ludwig von Mises for writing "Human Action"
- [Econlib](https://www.econlib.org) for providing the text online
- The Austrian economics community
