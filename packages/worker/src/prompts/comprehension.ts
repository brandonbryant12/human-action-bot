/**
 * Comprehension Assessment Prompts for Human Action Bot
 *
 * These prompts are used to assess student understanding
 * and provide targeted feedback
 */

export const COMPREHENSION_ASSESSMENT_PROMPT = `You are assessing a student's understanding of concepts from Ludwig von Mises' "Human Action."

Your task is to:
1. Carefully analyze the student's response
2. Identify what they understood correctly
3. Note any misconceptions or gaps
4. Provide a comprehension score from 0.0 to 1.0

## Scoring Guidelines

- 0.0-0.2: Fundamental misunderstanding or no relevant content
- 0.2-0.4: Some relevant points but significant gaps or errors
- 0.4-0.6: Partial understanding with room for improvement
- 0.6-0.8: Good understanding with minor gaps
- 0.8-1.0: Excellent understanding, demonstrates mastery

## Response Format

Provide your assessment in this exact format:

SCORE: [0.0-1.0]

STRENGTHS:
- [What the student understood well]

AREAS FOR IMPROVEMENT:
- [What concepts need more work]

FEEDBACK:
[2-3 sentences of encouraging, constructive feedback that builds on their understanding]

FOLLOW_UP_QUESTION:
[An optional follow-up question to deepen their understanding, or "none" if not needed]`

export const ANSWER_EVALUATION_PROMPT = `You are evaluating a student's answer to a comprehension question about "Human Action."

## Question Asked
{question}

## Expected Understanding
{expectedConcepts}

## Student's Answer
{studentAnswer}

Evaluate their response using the scoring guidelines and provide structured feedback.`

/**
 * Build a comprehension assessment prompt with context
 */
export function buildComprehensionAssessment(
  question: string,
  studentAnswer: string,
  chapterContext: string,
  expectedConcepts: string[]
): string {
  return `${COMPREHENSION_ASSESSMENT_PROMPT}

## Question Asked
${question}

## Chapter Context
${chapterContext}

## Key Concepts to Assess
${expectedConcepts.map((c) => `- ${c}`).join("\n")}

## Student's Answer
${studentAnswer}

Now provide your assessment following the exact format specified above.`
}

/**
 * Parse a comprehension assessment response
 */
export function parseComprehensionResponse(response: string): {
  score: number
  strengths: string[]
  areasForImprovement: string[]
  feedback: string
  followUpQuestion: string | null
} {
  // Extract score
  const scoreMatch = response.match(/SCORE:\s*([\d.]+)/i)
  const scoreStr = scoreMatch?.[1] ?? "0.5"
  const score = Math.min(1, Math.max(0, parseFloat(scoreStr)))

  // Extract strengths
  const strengthsMatch = response.match(/STRENGTHS:\n([\s\S]*?)(?=\n(?:AREAS|FEEDBACK|$))/i)
  const strengthsRaw = strengthsMatch?.[1] ?? ""
  const strengths = strengthsRaw
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .map((line) => line.replace(/^-\s*/, "").trim())

  // Extract areas for improvement
  const areasMatch = response.match(/AREAS FOR IMPROVEMENT:\n([\s\S]*?)(?=\n(?:FEEDBACK|$))/i)
  const areasRaw = areasMatch?.[1] ?? ""
  const areasForImprovement = areasRaw
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .map((line) => line.replace(/^-\s*/, "").trim())

  // Extract feedback
  const feedbackMatch = response.match(/FEEDBACK:\n([\s\S]*?)(?=\n(?:FOLLOW_UP|$))/i)
  const feedback = feedbackMatch?.[1]?.trim() ?? ""

  // Extract follow-up question
  const followUpMatch = response.match(/FOLLOW_UP_QUESTION:\n([\s\S]*?)$/i)
  const followUpRaw = followUpMatch?.[1]?.trim() ?? ""
  const followUpQuestion = followUpRaw.toLowerCase() === "none" ? null : followUpRaw || null

  return {
    score,
    strengths,
    areasForImprovement,
    feedback,
    followUpQuestion
  }
}
