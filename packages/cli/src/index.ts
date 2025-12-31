#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { chatCommand } from "./commands/chat"
import { lessonCommand } from "./commands/lesson"
import { progressCommand } from "./commands/progress"
import type { ApiConfig } from "./lib/api-client"

const program = new Command()

// Config file path
const CONFIG_DIR = path.join(os.homedir(), ".human-action-bot")
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json")

// Get persisted userId or return null
const getPersistedUserId = (): string | null => {
  // Check environment first
  if (process.env.HUMAN_ACTION_USER_ID) {
    return process.env.HUMAN_ACTION_USER_ID
  }

  // Try to read from config file
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
      if (config.userId) {
        return config.userId
      }
    }
  } catch {
    // Ignore read errors
  }

  return null
}

// Set userId in config file
const setUserId = (userId: string): void => {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ userId }, null, 2))
    console.log(chalk.green(`\n✓ User ID set to: ${userId}`))
    console.log(chalk.gray(`  Saved to: ${CONFIG_FILE}\n`))
  } catch (error) {
    console.error(chalk.red(`Failed to save config: ${error}`))
    process.exit(1)
  }
}

// Require userId to be set
const requireUserId = (): string => {
  const userId = getPersistedUserId()
  if (!userId) {
    console.error(chalk.red("\n✗ No user ID configured!\n"))
    console.log(chalk.white("Set your user ID with:"))
    console.log(chalk.cyan("  pnpm cli:prod set-user <your-name>\n"))
    console.log(chalk.white("Or set the environment variable:"))
    console.log(chalk.cyan("  export HUMAN_ACTION_USER_ID=<your-name>\n"))
    process.exit(1)
  }
  return userId
}

// Get config from environment or defaults (requires userId)
const getConfig = (): ApiConfig => ({
  baseUrl: process.env.HUMAN_ACTION_API_URL ?? "http://localhost:8787",
  userId: requireUserId()
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
  .command("set-user <userId>")
  .description("Set your user ID for tracking progress")
  .action((userId: string) => {
    setUserId(userId)
  })

program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    const userId = getPersistedUserId()
    const baseUrl = process.env.HUMAN_ACTION_API_URL ?? "http://localhost:8787"
    console.log(chalk.blue("\n📋 Current Configuration\n"))
    console.log(chalk.white("API URL: ") + chalk.green(baseUrl))
    if (userId) {
      console.log(chalk.white("User ID: ") + chalk.green(userId))
    } else {
      console.log(chalk.white("User ID: ") + chalk.red("Not set"))
    }
    console.log(chalk.white("Config File: ") + chalk.gray(CONFIG_FILE))
    console.log(chalk.gray("\nSet user ID with: pnpm cli:prod set-user <name>"))
    console.log(chalk.gray("Override with HUMAN_ACTION_USER_ID environment variable.\n"))
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
