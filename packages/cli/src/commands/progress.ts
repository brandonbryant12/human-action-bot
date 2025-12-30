import { Effect } from "effect"
import chalk from "chalk"
import { makeApiClient } from "../lib/api-client"
import type { ApiConfig } from "../lib/api-client"

export async function progressCommand(config: ApiConfig): Promise<void> {
  const client = makeApiClient(config)

  console.log(chalk.blue("\n📊 Fetching your progress...\n"))
  console.log(chalk.gray("Loading..."))

  try {
    const progress = await Effect.runPromise(client.getProgress())

    if (!progress.student) {
      console.log(chalk.yellow("No student profile found."))
      console.log(chalk.gray("Use the chat or lesson command to get started.\n"))
      return
    }

    const { student, recentLessons, pacing } = progress

    console.log(chalk.bold.cyan("📚 Your Learning Progress\n"))

    // Student stats
    console.log(chalk.white("Current Chapter: ") + chalk.green(student.currentChapter))
    console.log(chalk.white("Lessons Completed: ") + chalk.green(student.totalLessonsCompleted))
    console.log(
      chalk.white("Comprehension Score: ") +
        chalk.green(`${(student.averageComprehensionScore * 100).toFixed(0)}%`)
    )
    console.log(chalk.white("Learning Pace: ") + chalk.green(`${student.paceMultiplier}x`))

    // Pacing recommendation
    console.log(chalk.bold.cyan("\n📈 Pacing Analysis\n"))
    console.log(chalk.white("Recommendation: ") + chalk.yellow(pacing.reasoning))
    console.log(chalk.white("Suggested Next: ") + chalk.green(pacing.recommendedLessonType))

    // Recent lessons
    if (recentLessons.length > 0) {
      console.log(chalk.bold.cyan("\n📖 Recent Lessons\n"))
      for (const lesson of recentLessons.slice(0, 5)) {
        const score = lesson.comprehensionScore
          ? `${(lesson.comprehensionScore * 100).toFixed(0)}%`
          : "N/A"
        console.log(
          chalk.gray(`  Ch. ${lesson.chapterNumber} (${lesson.lessonType}) - Score: ${score}`)
        )
      }
    }

    console.log()
  } catch (error) {
    console.error(chalk.red("\nError fetching progress: ") + String(error))
    console.log()
  }
}
