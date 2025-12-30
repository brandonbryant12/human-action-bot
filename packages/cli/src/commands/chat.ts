import { Effect } from "effect"
import * as readline from "node:readline"
import chalk from "chalk"
import ora from "ora"
import { makeApiClient } from "../lib/api-client"
import type { ApiConfig } from "../lib/api-client"

export async function chatCommand(config: ApiConfig): Promise<void> {
  const client = makeApiClient(config)

  console.log(chalk.blue("\n📚 Human Action Bot - Chat Mode"))
  console.log(chalk.gray("Type your questions about Austrian economics."))
  console.log(chalk.gray("Type 'exit' or 'quit' to leave.\n"))

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const askQuestion = (): void => {
    rl.question(chalk.green("You: "), async (input) => {
      const message = input.trim()

      if (!message) {
        askQuestion()
        return
      }

      if (message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {
        console.log(chalk.blue("\nGoodbye! Keep studying Human Action! 📖\n"))
        rl.close()
        return
      }

      const spinner = ora("Thinking...").start()

      try {
        const response = await Effect.runPromise(client.chat(message))
        spinner.stop()

        console.log(chalk.cyan("\nTutor: ") + response.message)

        if (response.sources && response.sources.length > 0) {
          console.log(chalk.gray("\nSources:"))
          for (const source of response.sources) {
            console.log(
              chalk.gray(`  - ${source.chapterTitle} (relevance: ${(source.score * 100).toFixed(0)}%)`)
            )
          }
        }

        console.log()
        askQuestion()
      } catch (error) {
        spinner.stop()
        console.error(chalk.red("\nError: ") + String(error))
        console.log()
        askQuestion()
      }
    })
  }

  askQuestion()
}
