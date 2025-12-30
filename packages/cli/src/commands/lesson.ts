import { Effect } from "effect"
import * as readline from "node:readline"
import chalk from "chalk"
import { makeApiClient } from "../lib/api-client"
import type { ApiConfig, LessonResponse } from "../lib/api-client"

// Parse lesson content into sections
function parseLessonSections(content: string): { intro: string; body: string[]; conclusion: string } {
  const sections = content.split(/##\s+/g).filter(Boolean)

  let intro = ""
  let body: string[] = []
  let conclusion = ""

  for (const section of sections) {
    const lines = section.trim()
    if (lines.toLowerCase().startsWith("introduction")) {
      intro = lines.replace(/^introduction\s*/i, "").trim()
    } else if (lines.toLowerCase().startsWith("lesson")) {
      // Split body into paragraphs for chunked delivery
      const bodyContent = lines.replace(/^lesson\s*/i, "").trim()
      body = bodyContent.split(/\n\n+/).filter(p => p.trim().length > 50)
    } else if (lines.toLowerCase().startsWith("questions")) {
      // Skip - we handle questions separately
    } else if (lines.toLowerCase().startsWith("conclusion") || lines.toLowerCase().startsWith("summary")) {
      conclusion = lines.replace(/^(conclusion|summary)\s*/i, "").trim()
    }
  }

  // If parsing failed, treat whole content as body
  if (body.length === 0) {
    body = content.split(/\n\n+/).filter(p => p.trim().length > 50)
  }

  return { intro, body, conclusion }
}

export function lessonCommand(config: ApiConfig): Promise<void> {
  return new Promise(async (resolve) => {
    const client = makeApiClient(config)

    console.log(chalk.blue("\n📖 Fetching your lesson...\n"))
    console.log(chalk.gray("Loading..."))

    let lesson: LessonResponse
    try {
      lesson = await Effect.runPromise(client.getLesson())
    } catch (error) {
      console.error(chalk.red("\nError fetching lesson: ") + String(error))
      console.log(chalk.gray("Make sure you have registered with the bot first.\n"))
      resolve()
      return
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const askUser = (prompt: string): Promise<string> => {
      return new Promise((res) => {
        rl.question(chalk.green(prompt), (answer) => res(answer.trim()))
      })
    }

    const discussAnswer = async (question: string, initialAnswer: string): Promise<void> => {
      let context = `Question: "${question}"\nStudent's answer: "${initialAnswer}"`
      let continueDiscussion = true
      let roundCount = 0

      while (continueDiscussion) {
        console.log(chalk.gray("\nThinking..."))
        roundCount++

        try {
          const response = await Effect.runPromise(
            client.chat(`${context}

IMPORTANT INSTRUCTIONS:
- If the student's answer demonstrates good understanding of the key concept, say "That's right!" or similar, briefly affirm what they got correct, and DO NOT ask a follow-up question. Just end with a period.
- Only ask a follow-up question if their answer is incorrect, incomplete, or shows a misconception that needs correcting.
- Keep responses brief (2-4 sentences max).
- We are studying "${lesson.title}".`)
          )
          console.log(chalk.cyan("\nTutor: ") + response.message)

          // Check if this seems like a concluding response (no question asked)
          const hasQuestion = response.message.includes("?")

          if (hasQuestion && roundCount < 5) {
            console.log(chalk.gray("\n(Type 'next' to move on, or respond to continue)\n"))
            const followUp = await askUser("You: ")

            if (!followUp || followUp.toLowerCase() === "next" || followUp.toLowerCase() === "skip") {
              // User wants to move on - get the answer they were looking for
              console.log(chalk.gray("\nThinking..."))
              try {
                const answerResponse = await Effect.runPromise(
                  client.chat(`The student wants to move on from this question: "${question}". Give them the key answer in 1-2 sentences. Be direct and concise. No questions.`)
                )
                console.log(chalk.cyan("\nTutor: ") + answerResponse.message + "\n")
              } catch {
                // Silently continue if this fails
              }
              continueDiscussion = false
            } else {
              // Add the follow-up to context for continued discussion
              context = `Original question: "${question}"\nStudent's latest response: "${followUp}"`
            }
          } else {
            // Tutor didn't ask a question OR we've had enough rounds - move on
            continueDiscussion = false
            console.log()
          }
        } catch {
          console.log(chalk.yellow("\nLet's continue with the lesson.\n"))
          continueDiscussion = false
        }
      }
    }

    // Start the interactive lesson
    console.clear()
    console.log(chalk.bold.cyan(`\n📚 ${lesson.title}`))
    console.log(chalk.gray(`Type: ${lesson.type} | Estimated time: ${lesson.estimatedMinutes} minutes`))
    console.log(chalk.gray("─".repeat(60) + "\n"))

    const sections = parseLessonSections(lesson.content)

    // Introduction
    if (sections.intro) {
      console.log(chalk.white(sections.intro))
      console.log()
      await askUser("Press Enter to continue...")
    }

    // Body - deliver in chunks with Socratic questions
    for (let i = 0; i < sections.body.length; i++) {
      console.log(chalk.white(sections.body[i]))
      console.log()

      // Every 2 paragraphs, ask a reflective question
      if ((i + 1) % 2 === 0 && i < sections.body.length - 1) {
        const checkQuestion = `Based on what you just read, what do you think is the key insight here?`
        console.log(chalk.yellow(`\n💭 ${checkQuestion}`))
        const answer = await askUser("Your thoughts: ")

        if (answer && answer.toLowerCase() !== "skip") {
          await discussAnswer(checkQuestion, answer)
        }
      } else {
        await askUser("Press Enter to continue...")
      }
    }

    // Comprehension questions
    if (lesson.questions.length > 0) {
      console.log(chalk.bold.yellow("\n📝 Comprehension Check\n"))
      console.log(chalk.gray("Let's test your understanding with a few questions.\n"))

      for (let i = 0; i < lesson.questions.length; i++) {
        const question = lesson.questions[i]
        if (!question) continue
        console.log(chalk.yellow(`Question ${i + 1}: ${question}`))
        const answer = await askUser("Your answer: ")

        if (answer && answer.toLowerCase() !== "skip") {
          await discussAnswer(question, answer)
        } else {
          console.log()
        }
      }
    }

    // Conclusion
    if (sections.conclusion) {
      console.log(chalk.bold.cyan("\n📌 Summary\n"))
      console.log(chalk.white(sections.conclusion))
    }

    // Final reflection
    console.log(chalk.bold.green("\n✅ Lesson Complete!\n"))
    const finalThought = await askUser("What's one thing from this lesson you'd like to explore further? (or press Enter to finish): ")

    if (finalThought) {
      await discussAnswer("What would you like to explore further from this lesson?", finalThought)
    }

    // Feedback collection
    console.log(chalk.gray("\n─".repeat(60)))
    console.log(chalk.bold.yellow("\n📊 Quick Feedback\n"))
    console.log(chalk.gray("Help us improve! Rate this lesson from 1-5 (or press Enter to skip):\n"))
    console.log(chalk.gray("  1 = Poor  |  2 = Fair  |  3 = Good  |  4 = Great  |  5 = Excellent\n"))

    const ratingInput = await askUser("Your rating (1-5): ")

    if (ratingInput) {
      const rating = parseInt(ratingInput, 10)
      if (rating >= 1 && rating <= 5) {
        const comment = await askUser("Any comments? (optional, press Enter to skip): ")

        console.log(chalk.gray("\nSubmitting feedback..."))
        try {
          await Effect.runPromise(
            client.submitFeedback({
              feedbackType: "lesson",
              rating,
              comment: comment || undefined,
              chapterNumber: lesson.chapter,
              clientType: "cli"
            })
          )
          console.log(chalk.green("Thank you for your feedback! 🙏"))
        } catch {
          console.log(chalk.yellow("Couldn't submit feedback, but thanks anyway!"))
        }
      } else {
        console.log(chalk.gray("Invalid rating, skipping feedback."))
      }
    } else {
      console.log(chalk.gray("Feedback skipped."))
    }

    console.log(chalk.blue("\nGreat work! Use 'pnpm dev progress' to see your learning journey.\n"))
    rl.close()
    resolve()
  })
}
