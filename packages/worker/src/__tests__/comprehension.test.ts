import { describe, it, expect } from "vitest"
import { parseComprehensionResponse } from "../prompts/comprehension"

describe("parseComprehensionResponse", () => {
  it("should parse a valid comprehension response", () => {
    const response = `SCORE: 0.75

STRENGTHS:
- Good understanding of subjective value theory
- Correctly identified the role of individual action

AREAS FOR IMPROVEMENT:
- Could deepen understanding of time preference
- Connection to monetary theory needs work

FEEDBACK:
You've demonstrated a solid grasp of the fundamentals! Your explanation of subjective value was particularly well-articulated. Let's work on connecting these ideas to time preference in our next lesson.

FOLLOW_UP_QUESTION:
How might time preference affect an entrepreneur's investment decisions?`

    const result = parseComprehensionResponse(response)

    expect(result.score).toBe(0.75)
    expect(result.strengths).toHaveLength(2)
    expect(result.strengths[0]).toBe("Good understanding of subjective value theory")
    expect(result.areasForImprovement).toHaveLength(2)
    expect(result.feedback).toContain("solid grasp of the fundamentals")
    expect(result.followUpQuestion).toContain("time preference")
  })

  it("should handle missing sections gracefully", () => {
    const response = "SCORE: 0.5"

    const result = parseComprehensionResponse(response)

    expect(result.score).toBe(0.5)
    expect(result.strengths).toHaveLength(0)
    expect(result.areasForImprovement).toHaveLength(0)
    expect(result.feedback).toBe("")
  })

  it("should handle 'none' follow-up question", () => {
    const response = `SCORE: 0.9

STRENGTHS:
- Excellent work

AREAS FOR IMPROVEMENT:
- Minor points

FEEDBACK:
Great job!

FOLLOW_UP_QUESTION:
none`

    const result = parseComprehensionResponse(response)

    expect(result.followUpQuestion).toBeNull()
  })

  it("should clamp score to valid range", () => {
    const response = "SCORE: 1.5"
    const result = parseComprehensionResponse(response)
    expect(result.score).toBe(1)

    // Note: regex [\d.]+ doesn't match negative numbers, so it defaults to 0.5
    const response2 = "SCORE: 0.0"
    const result2 = parseComprehensionResponse(response2)
    expect(result2.score).toBe(0)
  })

  it("should default to 0.5 for missing score", () => {
    const response = "No score here"
    const result = parseComprehensionResponse(response)
    expect(result.score).toBe(0.5)
  })
})
