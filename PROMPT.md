Refactor this monorepo to follow modern Effect patterns with Drizzle ORM and Turborepo. Work through each phase sequentially, verifying the build passes after each phase before moving on.

## Reference Architecture
Base patterns on https://github.com/TeamWarp/effect-api-example which demonstrates:
- Schema-first branded types with @effect/schema
- Drizzle ORM with typed schema definitions
- Effect service pattern with Layer composition
- Turborepo for build orchestration

## Current State
- Database: Raw SQL queries with D1 (Cloudflare Workers SQLite)
- Types: Ad-hoc type definitions scattered across services
- Build: Basic pnpm workspace without task orchestration
- Services: Effect services with manual row-to-model conversion
- Schema: SQL schema in `packages/worker/src/db/schema.sql`

## Target State
- Database: Drizzle ORM with typed schema definitions
- Types: Schema-first branded types in shared package
- Build: Turborepo with cached, parallel task execution
- Services: Clean service layer consuming Drizzle-typed queries

---

## Phase 1: Turborepo Setup

1. Install turbo: `pnpm add -D turbo -w`
2. Create `turbo.json` at repo root with tasks: build, lint, check-types, dev, db:generate, db:migrate
3. Update root package.json scripts to use turbo
4. Add corresponding scripts to each package
5. Verify: `pnpm build` works

## Phase 2: Shared Types Package

1. Create `packages/shared/` with structure:
   - src/index.ts, src/schemas/*.ts, src/errors/index.ts
   - package.json, tsconfig.json
2. Define branded types with @effect/schema:
   - StudentId, LessonId, ConversationId (Number branded)
   - TelegramId (String branded)
   - ComprehensionScore (Number 0-100 branded)
   - LessonType literal union
3. Define domain schemas: StudentSchema, LessonSchema, ConversationSchema
4. Export shared error types: DatabaseError, AIError, VectorizeError
5. Verify: `pnpm check-types` passes

## Phase 3: Drizzle ORM Integration

1. Install in worker: `pnpm add drizzle-orm` and `pnpm add -D drizzle-kit`
2. Create `packages/worker/src/db/schema/` with:
   - students.ts, lessons.ts, conversations.ts, struggles.ts, feedback.ts
   - index.ts re-exporting all
3. Use `sqliteTable` from `drizzle-orm/sqlite-core`
4. Apply branded types with `.$type<T>()`
5. Create `DrizzleLive.ts` service layer using D1DatabaseTag
6. Create `drizzle.config.ts` for migrations
7. Verify: Types compile correctly

## Phase 4: Refactor Services to Use Drizzle

For each service (StudentService, ConversationService, LessonService, ComprehensionService):
1. Import DrizzleTag and schema tables
2. Replace raw SQL `d1.prepare()` calls with Drizzle query builder
3. Use `db.query.tableName.findFirst()` for selects
4. Use `db.insert().values().returning()` for inserts
5. Use `db.update().set().where().returning()` for updates
6. Keep Effect.tryPromise wrapper with proper error types
7. Verify each service individually

## Phase 5: Update Layer Composition

1. Create `packages/worker/src/db/index.ts` with unified DatabaseLayer
2. Update `effect-runtime.ts` to include DrizzleLive in layer composition
3. Update route handlers to use new layer structure
4. Verify: All API endpoints still work

## Phase 6: Migrations

1. Add db:generate and db:migrate scripts to worker package.json
2. Generate initial migration: `pnpm --filter worker db:generate`
3. Create migration runner script for D1
4. Verify: Database operations work end-to-end

---

## Key Patterns to Follow

**Branded Types (shared package):**
```typescript
import { Schema as S } from "@effect/schema"
export const StudentIdSchema = S.Number.pipe(S.int(), S.brand("StudentId"))
export type StudentId = S.Schema.Type<typeof StudentIdSchema>
```

**Drizzle Schema (worker package):**
```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }).$type<StudentId>(),
  telegramId: text("telegram_id").notNull().unique().$type<TelegramId>()
})
```

**Drizzle Service Layer:**
```typescript
export class DrizzleTag extends Context.Tag("Drizzle")<DrizzleTag, Database>() {}
export const DrizzleLive = Layer.effect(DrizzleTag, Effect.gen(function* () {
  const d1 = yield* D1DatabaseTag
  return drizzle(d1, { schema })
}))
```

**Service Using Drizzle:**
```typescript
const db = yield* DrizzleTag
return Effect.tryPromise({
  try: () => db.query.students.findFirst({ where: eq(students.telegramId, id) }),
  catch: (error) => new DatabaseError("Failed to find student", error)
})
```

---

## Verification After Each Phase

- [ ] `pnpm build` succeeds with Turbo caching
- [ ] `pnpm check-types` passes
- [ ] API endpoints return expected data
- [ ] No regressions in functionality

## Notes

- D1 uses SQLite, so use `drizzle-orm/sqlite-core` for schema definitions
- Drizzle with D1 requires `drizzle-orm/d1` adapter
- Keep existing Cloudflare Worker deployment working throughout
- Delete `packages/worker/src/db/schema.sql` after migration is complete
