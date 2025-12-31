import { Effect, Context, Layer } from "effect"
import { drizzle } from "drizzle-orm/d1"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { D1DatabaseTag } from "../lib/effect-runtime"
import * as schema from "./schema"

// Type for the Drizzle database with schema
export type Database = DrizzleD1Database<typeof schema>

// Drizzle service tag
export class DrizzleTag extends Context.Tag("Drizzle")<
  DrizzleTag,
  Database
>() {}

// Create Drizzle layer from D1Database
export const DrizzleLive = Layer.effect(
  DrizzleTag,
  Effect.gen(function* () {
    const d1 = yield* D1DatabaseTag
    return drizzle(d1, { schema })
  })
)
