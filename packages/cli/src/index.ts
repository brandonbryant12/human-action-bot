#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import { chatCommand } from "./commands/chat"
import { lessonCommand } from "./commands/lesson"
import { progressCommand } from "./commands/progress"
import type { ApiConfig } from "./lib/api-client"

const program = new Command()

// Get config from environment or defaults
const getConfig = (): ApiConfig => ({
  baseUrl: process.env.HUMAN_ACTION_API_URL ?? "http://localhost:8787",
  userId: process.env.HUMAN_ACTION_USER_ID ?? `cli_${Date.now()}`
})

program
  .name("human-action")
  .description("CLI for the Human Action Bot - AI tutor for Austrian economics")
  .version("1.0.0")

program
  .command("chat")
  .description("Start an interactive chat session about Human Action")
  .action(async () => {
    await chatCommand(getConfig())
  })

program
  .command("lesson")
  .description("Get your next lesson from Human Action")
  .action(async () => {
    await lessonCommand(getConfig())
  })

program
  .command("progress")
  .description("View your learning progress")
  .action(async () => {
    await progressCommand(getConfig())
  })

program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    const config = getConfig()
    console.log(chalk.blue("\n📋 Current Configuration\n"))
    console.log(chalk.white("API URL: ") + chalk.green(config.baseUrl))
    console.log(chalk.white("User ID: ") + chalk.green(config.userId))
    console.log(chalk.gray("\nSet HUMAN_ACTION_API_URL and HUMAN_ACTION_USER_ID environment variables to customize.\n"))
  })

// Show help by default if no command provided
if (process.argv.length <= 2) {
  console.log(chalk.blue(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   📚 Human Action Bot CLI                     ║
║   AI Tutor for Austrian Economics             ║
║                                               ║
╚═══════════════════════════════════════════════╝
  `))
  program.help()
}

program.parse()
