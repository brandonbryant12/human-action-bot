import { Effect } from "effect"
import chalk from "chalk"
import ora from "ora"
import { makeApiClient } from "../lib/api-client"
import type { ApiConfig } from "../lib/api-client"

export async function lessonCommand(config: ApiConfig): Promise<void> {
  const client = makeApiClient(config)

  console.log(chalk.blue("\n📖 Fetching your lesson...\n"))

  const spinner = ora("Generating lesson...").start()

  try {
    const lesson = await Effect.runPromise(client.getLesson())
    spinner.stop()

    console.log(chalk.bold.cyan(`\n${lesson.title}`))
    console.log(chalk.gray(`Type: ${lesson.type} | Estimated time: ${lesson.estimatedMinutes} minutes\n`))
    console.log(lesson.content)

    if (lesson.questions.length > 0) {
      console.log(chalk.yellow("\n📝 Comprehension Questions:"))
      for (let i = 0; i < lesson.questions.length; i++) {
        console.log(chalk.yellow(`  ${i + 1}. ${lesson.questions[i]}`))
      }
    }

    console.log()
  } catch (error) {
    spinner.stop()
    console.error(chalk.red("\nError fetching lesson: ") + String(error))
    console.log(chalk.gray("Make sure you have registered with the bot first.\n"))
  }
}
