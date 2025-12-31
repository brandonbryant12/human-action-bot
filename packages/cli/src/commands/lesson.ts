import { Effect } from "effect"
import * as readline from "node:readline"
import chalk from "chalk"
import { makeApiClient } from "../lib/api-client"
import type { ApiConfig, LessonStep } from "../lib/api-client"

export function lessonCommand(config: ApiConfig): Promise<void> {
  return new Promise(async (resolve) => {
    const client = makeApiClient(config)

    console.log(chalk.blue("\n📖 Starting your lesson...\n"))
    console.log(chalk.gray("Loading..."))

    let currentStep: LessonStep
    try {
      currentStep = await Effect.runPromise(client.startLessonSession())
    } catch (error) {
      console.error(chalk.red("\nError starting lesson: ") + String(error))
      console.log(chalk.gray("Make sure you have set your user ID with: pnpm cli:prod set-user <name>\n"))
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

    // Display the current step
    const displayStep = (step: LessonStep): void => {
      console.clear()
      console.log(chalk.bold.cyan(`\n📚 ${step.lessonTitle}`))
      console.log(chalk.gray(`Type: ${step.lessonType} | Progress: ${step.progress.current}/${step.progress.total}`))
      console.log(chalk.gray("─".repeat(60) + "\n"))

      if (step.phase === "comprehension" && step.question) {
        console.log(chalk.bold.yellow(`📝 Comprehension Check (Question ${step.question.index}/${step.question.total})\n`))
        console.log(chalk.yellow(step.question.text))
      } else if (step.action.type === "answer_question") {
        console.log(chalk.white(step.content))
        console.log()
        console.log(chalk.yellow(`\n💭 ${step.action.questionText}`))
      } else if (step.action.type === "rate") {
        console.log(chalk.bold.green("\n✅ Lesson Complete!\n"))
        console.log(chalk.white(step.content))
      } else if (step.action.type === "complete") {
        console.log(chalk.bold.green("\n🎉 Congratulations!\n"))
        console.log(chalk.white(step.content))
      } else {
        console.log(chalk.white(step.content))
      }
    }

    // Main lesson loop
    const runLessonLoop = async (): Promise<void> => {
      while (true) {
        displayStep(currentStep)

        switch (currentStep.action.type) {
          case "continue": {
            await askUser("\nPress Enter to continue...")
            console.log(chalk.gray("\nLoading..."))
            try {
              currentStep = await Effect.runPromise(client.continueLessonSession())
            } catch (error) {
              console.error(chalk.red("\nError: ") + String(error))
              await askUser("Press Enter to try again...")
            }
            break
          }

          case "answer_question": {
            console.log(chalk.gray("\n(Type 'skip' to skip this question)\n"))
            const answer = await askUser("Your answer: ")

            if (!answer || answer.toLowerCase() === "skip") {
              console.log(chalk.gray("\nSkipping..."))
              try {
                currentStep = await Effect.runPromise(client.skipLessonSection())
              } catch {
                currentStep = await Effect.runPromise(client.continueLessonSession())
              }
            } else {
              console.log(chalk.gray("\nThinking..."))
              try {
                const response = await Effect.runPromise(client.answerLessonQuestion(answer))
                console.log(chalk.cyan("\nTutor: ") + response.feedback)

                if (response.hasFollowUp) {
                  console.log(chalk.gray("\n(Type 'next' to move on, or respond to continue)\n"))
                  const followUp = await askUser("You: ")

                  if (!followUp || followUp.toLowerCase() === "next" || followUp.toLowerCase() === "skip") {
                    try {
                      currentStep = await Effect.runPromise(client.skipLessonSection())
                    } catch {
                      currentStep = response.nextStep
                    }
                  } else {
                    // Continue the discussion
                    console.log(chalk.gray("\nThinking..."))
                    const followUpResponse = await Effect.runPromise(client.answerLessonQuestion(followUp))
                    console.log(chalk.cyan("\nTutor: ") + followUpResponse.feedback)
                    await askUser("\nPress Enter to continue...")
                    currentStep = followUpResponse.nextStep
                  }
                } else {
                  await askUser("\nPress Enter to continue...")
                  currentStep = response.nextStep
                }
              } catch (error) {
                console.error(chalk.red("\nError: ") + String(error))
                await askUser("Press Enter to continue...")
              }
            }
            break
          }

          case "rate": {
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
                  const result = await Effect.runPromise(
                    client.submitSessionFeedback(rating, comment || undefined)
                  )
                  console.log(chalk.green(result.message))
                } catch {
                  console.log(chalk.yellow("Couldn't submit feedback, but thanks anyway!"))
                }
              } else {
                console.log(chalk.gray("Invalid rating, skipping feedback."))
              }
            } else {
              console.log(chalk.gray("Feedback skipped."))
            }

            // Move to complete
            try {
              currentStep = await Effect.runPromise(client.continueLessonSession())
            } catch {
              // Lesson is done
              console.log(chalk.blue("\nGreat work! Use 'progress' to see your learning journey.\n"))
              rl.close()
              resolve()
              return
            }
            break
          }

          case "complete": {
            console.log(chalk.blue("\n🎓 Great work on completing this lesson!"))
            console.log(chalk.gray("Use 'progress' to see your learning journey.\n"))
            rl.close()
            resolve()
            return
          }
        }
      }
    }

    await runLessonLoop()
  })
}
