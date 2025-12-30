# Ralph Wiggum Loop: Refactor to Effect API Patterns with Drizzle & Turborepo

## Overview

Refactor the human-action-bot monorepo to follow modern Effect patterns inspired by [TeamWarp/effect-api-example](https://github.com/TeamWarp/effect-api-example). This includes migrating from raw SQL to Drizzle ORM, implementing schema-first branded types, adopting Turborepo for build orchestration, and restructuring the codebase for better separation of concerns.

## Current State

- **Database**: Raw SQL queries with D1 (Cloudflare Workers SQLite)
- **Types**: Ad-hoc type definitions scattered across services
- **Build**: Basic pnpm workspace without task orchestration
- **Services**: Effect services with manual row-to-model conversion
- **Schema**: SQL schema in `packages/worker/src/db/schema.sql`

## Target State

- **Database**: Drizzle ORM with typed schema definitions
- **Types**: Schema-first branded types in shared package
- **Build**: Turborepo with cached, parallel task execution
- **Services**: Clean service layer consuming Drizzle-typed queries
- **Schema**: Drizzle schema files with migrations

---

## Phase 1: Turborepo Setup

### Task 1.1: Install and Configure Turborepo

```bash
pnpm add -D turbo -w
```

Create `turbo.json` at repo root:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

### Task 1.2: Update package.json Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "check-types": "turbo check-types",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate"
  }
}
```

### Task 1.3: Add Package Scripts

Each package needs corresponding scripts for Turbo to orchestrate.

---

## Phase 2: Shared Types Package

### Task 2.1: Create Shared Package Structure

```
packages/shared/
├── src/
│   ├── index.ts           # Main exports
│   ├── schemas/
│   │   ├── student.ts     # Student branded types
│   │   ├── lesson.ts      # Lesson branded types
│   │   ├── conversation.ts # Conversation branded types
│   │   └── common.ts      # Shared primitives (Email, UserId, etc.)
│   └── errors/
│       └── index.ts       # Shared error types
├── package.json
└── tsconfig.json
```

### Task 2.2: Define Branded Types with Effect Schema

Create `packages/shared/src/schemas/common.ts`:

```typescript
import { Schema as S } from "@effect/schema"

// Branded ID types
export const StudentIdSchema = S.Number.pipe(
  S.int(),
  S.brand("StudentId"),
  S.annotations({ description: "Unique student identifier" })
)
export type StudentId = S.Schema.Type<typeof StudentIdSchema>

export const LessonIdSchema = S.Number.pipe(
  S.int(),
  S.brand("LessonId"),
  S.annotations({ description: "Unique lesson identifier" })
)
export type LessonId = S.Schema.Type<typeof LessonIdSchema>

export const ConversationIdSchema = S.Number.pipe(
  S.int(),
  S.brand("ConversationId")
)
export type ConversationId = S.Schema.Type<typeof ConversationIdSchema>

// Telegram ID (external system)
export const TelegramIdSchema = S.String.pipe(
  S.brand("TelegramId"),
  S.annotations({ description: "Telegram user ID" })
)
export type TelegramId = S.Schema.Type<typeof TelegramIdSchema>

// Learning progress types
export const ComprehensionScoreSchema = S.Number.pipe(
  S.greaterThanOrEqualTo(0),
  S.lessThanOrEqualTo(100),
  S.brand("ComprehensionScore")
)
export type ComprehensionScore = S.Schema.Type<typeof ComprehensionScoreSchema>

export const LessonTypeSchema = S.Literal(
  "foundational",
  "conceptual",
  "application",
  "synthesis",
  "review"
)
export type LessonType = S.Schema.Type<typeof LessonTypeSchema>
```

### Task 2.3: Define Domain Schemas

Create `packages/shared/src/schemas/student.ts`:

```typescript
import { Schema as S } from "@effect/schema"
import { StudentIdSchema, TelegramIdSchema, ComprehensionScoreSchema } from "./common"

export const StudentSchema = S.Struct({
  id: StudentIdSchema,
  telegramId: TelegramIdSchema,
  currentChapter: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(1)),
  currentSection: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(1)),
  comprehensionScore: ComprehensionScoreSchema,
  lessonsCompleted: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
  createdAt: S.Date,
  updatedAt: S.Date
})

export type Student = S.Schema.Type<typeof StudentSchema>

export const CreateStudentSchema = S.Struct({
  telegramId: TelegramIdSchema
})

export type CreateStudent = S.Schema.Type<typeof CreateStudentSchema>
```

---

## Phase 3: Drizzle ORM Integration

### Task 3.1: Install Drizzle Dependencies

```bash
# In packages/worker
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

### Task 3.2: Create Drizzle Schema Files

Create `packages/worker/src/db/schema/students.ts`:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import type { StudentId, TelegramId } from "@human-action-bot/shared"

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<StudentId>(),
  telegramId: text("telegram_id").notNull().unique().$type<TelegramId>(),
  currentChapter: integer("current_chapter").notNull().default(1),
  currentSection: integer("current_section").notNull().default(1),
  comprehensionScore: integer("comprehension_score").notNull().default(0),
  lessonsCompleted: integer("lessons_completed").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString())
})

export type StudentRow = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert
```

Create `packages/worker/src/db/schema/lessons.ts`:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import type { LessonId, StudentId, LessonType } from "@human-action-bot/shared"

export const lessonHistory = sqliteTable("lesson_history", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<LessonId>(),
  studentId: integer("student_id").notNull().$type<StudentId>(),
  chapter: integer("chapter").notNull(),
  section: integer("section").notNull(),
  lessonType: text("lesson_type").notNull().$type<LessonType>(),
  score: integer("score"),
  completedAt: text("completed_at").notNull().$defaultFn(() => new Date().toISOString())
})

export type LessonHistoryRow = typeof lessonHistory.$inferSelect
export type NewLessonHistory = typeof lessonHistory.$inferInsert
```

Create `packages/worker/src/db/schema/index.ts`:

```typescript
export * from "./students"
export * from "./lessons"
export * from "./conversations"
export * from "./struggles"
export * from "./feedback"
```

### Task 3.3: Create Drizzle Service Layer

Create `packages/worker/src/db/DrizzleLive.ts`:

```typescript
import { Effect, Layer, Context } from "effect"
import { drizzle } from "drizzle-orm/d1"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import * as schema from "./schema"
import { D1DatabaseTag } from "../lib/effect-runtime"

export type Database = DrizzleD1Database<typeof schema>

export class DrizzleTag extends Context.Tag("Drizzle")<DrizzleTag, Database>() {}

export const DrizzleLive = Layer.effect(
  DrizzleTag,
  Effect.gen(function* () {
    const d1 = yield* D1DatabaseTag
    return drizzle(d1, { schema })
  })
)
```

### Task 3.4: Create Drizzle Config

Create `packages/worker/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http"
})
```

---

## Phase 4: Refactor Services to Use Drizzle

### Task 4.1: Refactor StudentService

Replace raw SQL with Drizzle queries:

```typescript
import { Effect, Layer } from "effect"
import { eq } from "drizzle-orm"
import { DrizzleTag } from "../db/DrizzleLive"
import { students } from "../db/schema"
import type { Student, CreateStudent } from "@human-action-bot/shared"
import { DatabaseError } from "@human-action-bot/shared/errors"

export interface StudentService {
  findByTelegramId: (telegramId: string) => Effect.Effect<Student | null, DatabaseError>
  create: (data: CreateStudent) => Effect.Effect<Student, DatabaseError>
  updateProgress: (id: number, chapter: number, section: number) => Effect.Effect<Student, DatabaseError>
}

export class StudentServiceTag extends Context.Tag("StudentService")<StudentServiceTag, StudentService>() {}

export const StudentServiceLive = Layer.effect(
  StudentServiceTag,
  Effect.gen(function* () {
    const db = yield* DrizzleTag

    return {
      findByTelegramId: (telegramId) =>
        Effect.tryPromise({
          try: async () => {
            const result = await db.query.students.findFirst({
              where: eq(students.telegramId, telegramId)
            })
            return result ?? null
          },
          catch: (error) => new DatabaseError("Failed to find student", error)
        }),

      create: (data) =>
        Effect.tryPromise({
          try: async () => {
            const [result] = await db.insert(students)
              .values({ telegramId: data.telegramId })
              .returning()
            return result
          },
          catch: (error) => new DatabaseError("Failed to create student", error)
        }),

      updateProgress: (id, chapter, section) =>
        Effect.tryPromise({
          try: async () => {
            const [result] = await db.update(students)
              .set({
                currentChapter: chapter,
                currentSection: section,
                updatedAt: new Date().toISOString()
              })
              .where(eq(students.id, id))
              .returning()
            return result
          },
          catch: (error) => new DatabaseError("Failed to update progress", error)
        })
    }
  })
)
```

### Task 4.2: Refactor Remaining Services

Apply the same pattern to:
- `ConversationService` - use `conversations` table schema
- `LessonService` - use `lessonHistory` table schema
- `ComprehensionService` - use `struggleLog` table schema

---

## Phase 5: Update Layer Composition

### Task 5.1: Create Unified Database Layer

Create `packages/worker/src/db/index.ts`:

```typescript
import { Layer } from "effect"
import { DrizzleLive } from "./DrizzleLive"
import { StudentServiceLive } from "../services/StudentService"
import { ConversationServiceLive } from "../services/ConversationService"
import { LessonServiceLive } from "../services/LessonService"

export const DatabaseLayer = Layer.mergeAll(
  DrizzleLive,
  StudentServiceLive,
  ConversationServiceLive,
  LessonServiceLive
)
```

### Task 5.2: Update Route Handlers

Update effect-runtime.ts to include Drizzle layer in composition.

---

## Phase 6: Migrations

### Task 6.1: Generate Initial Migration

```bash
pnpm --filter worker db:generate
```

### Task 6.2: Create Migration Script

Create script to run migrations against D1:

```typescript
// scripts/migrate.ts
import { drizzle } from "drizzle-orm/d1"
import { migrate } from "drizzle-orm/d1/migrator"

export async function runMigrations(d1: D1Database) {
  const db = drizzle(d1)
  await migrate(db, { migrationsFolder: "./src/db/migrations" })
}
```

---

## Verification Checklist

After each phase, verify:

- [ ] `pnpm build` succeeds with Turbo caching
- [ ] `pnpm check-types` passes
- [ ] All existing tests still pass
- [ ] API endpoints return expected data
- [ ] Database queries execute correctly

---

## File Changes Summary

### New Files
- `turbo.json`
- `packages/shared/` (entire package)
- `packages/worker/src/db/schema/*.ts`
- `packages/worker/src/db/DrizzleLive.ts`
- `packages/worker/src/db/migrations/`
- `packages/worker/drizzle.config.ts`

### Modified Files
- Root `package.json` (turbo scripts)
- `packages/worker/package.json` (drizzle deps, scripts)
- `packages/worker/src/services/*.ts` (all services)
- `packages/worker/src/lib/effect-runtime.ts` (layer composition)
- `packages/worker/src/index.ts` (route handlers)

### Removed Files
- `packages/worker/src/db/schema.sql` (replaced by Drizzle schema)

---

## Notes

- D1 uses SQLite, so use `drizzle-orm/sqlite-core` for schema definitions
- Drizzle with D1 requires `drizzle-orm/d1` adapter
- Keep existing Cloudflare Worker deployment working throughout
- Branded types provide compile-time safety without runtime overhead
- Turborepo caches based on file inputs - commit `turbo.json` to repo
