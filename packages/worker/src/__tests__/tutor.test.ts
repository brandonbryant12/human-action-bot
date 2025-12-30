import { describe, it, expect } from "vitest"
import { buildTutorPrompt, TUTOR_SYSTEM_PROMPT } from "../prompts/tutor"

describe("buildTutorPrompt", () => {
  it("should include the base system prompt", () => {
    const result = buildTutorPrompt("", undefined)
    expect(result).toContain(TUTOR_SYSTEM_PROMPT)
  })

  it("should include chapter info when provided", () => {
    const result = buildTutorPrompt("", "Chapter 1: Acting Man")
    expect(result).toContain("## Current Chapter")
    expect(result).toContain("Chapter 1: Acting Man")
  })

  it("should include context when provided", () => {
    const context = "Human action is purposeful behavior."
    const result = buildTutorPrompt(context, undefined)
    expect(result).toContain("## Relevant Passages from Human Action")
    expect(result).toContain(context)
  })

  it("should include both chapter info and context", () => {
    const context = "Human action is purposeful behavior."
    const chapterInfo = "Chapter 1: Acting Man"
    const result = buildTutorPrompt(context, chapterInfo)

    expect(result).toContain("## Current Chapter")
    expect(result).toContain(chapterInfo)
    expect(result).toContain("## Relevant Passages from Human Action")
    expect(result).toContain(context)
  })
})

describe("TUTOR_SYSTEM_PROMPT", () => {
  it("should contain key teaching concepts", () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain("Socratic")
    expect(TUTOR_SYSTEM_PROMPT).toContain("Praxeology")
    expect(TUTOR_SYSTEM_PROMPT).toContain("Austrian")
    expect(TUTOR_SYSTEM_PROMPT).toContain("Mises")
  })

  it("should contain key economic concepts", () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain("Subjective Value")
    expect(TUTOR_SYSTEM_PROMPT).toContain("Time Preference")
    expect(TUTOR_SYSTEM_PROMPT).toContain("Economic Calculation")
  })
})
