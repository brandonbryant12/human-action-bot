import { Effect, Context, Layer } from "effect"
import { TelegramBotToken, TelegramError } from "../lib/effect-runtime"

// Telegram message types
export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id: number
  type: "private" | "group" | "supergroup" | "channel"
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  entities?: Array<{
    type: string
    offset: number
    length: number
  }>
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
  }
}

// Parsed command
export interface TelegramCommand {
  command: string
  args: string
  chatId: number
  userId: number
  username: string | undefined
  firstName: string
}

// TelegramService interface
export interface TelegramService {
  readonly sendMessage: (
    chatId: number,
    text: string,
    options?: {
      parseMode?: "HTML" | "Markdown" | "MarkdownV2"
      replyToMessageId?: number
    }
  ) => Effect.Effect<void, TelegramError>
  readonly parseCommand: (
    message: TelegramMessage
  ) => TelegramCommand | null
  readonly sendTypingAction: (chatId: number) => Effect.Effect<void, TelegramError>
}

// TelegramService Tag
export class TelegramServiceTag extends Context.Tag("TelegramService")<
  TelegramServiceTag,
  TelegramService
>() {}

// TelegramService implementation
export const TelegramServiceLive = Layer.effect(
  TelegramServiceTag,
  Effect.gen(function* () {
    const botToken = yield* TelegramBotToken

    const apiUrl = `https://api.telegram.org/bot${botToken}`

    // Send a message
    const sendMessage = (
      chatId: number,
      text: string,
      options?: {
        parseMode?: "HTML" | "Markdown" | "MarkdownV2"
        replyToMessageId?: number
      }
    ): Effect.Effect<void, TelegramError> =>
      Effect.tryPromise({
        try: async () => {
          const body: Record<string, unknown> = {
            chat_id: chatId,
            text
          }

          if (options?.parseMode) {
            body.parse_mode = options.parseMode
          }

          if (options?.replyToMessageId) {
            body.reply_to_message_id = options.replyToMessageId
          }

          const response = await fetch(`${apiUrl}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })

          if (!response.ok) {
            throw new Error(`Telegram API error: ${response.status}`)
          }
        },
        catch: (error) => new TelegramError("Failed to send message", error)
      })

    // Parse a command from a message
    const parseCommand = (message: TelegramMessage): TelegramCommand | null => {
      if (!message.text || !message.from) {
        return null
      }

      const text = message.text.trim()

      // Check if it starts with a command
      if (!text.startsWith("/")) {
        return null
      }

      // Parse command and arguments
      const parts = text.split(/\s+/)
      const commandPart = parts[0]
      const args = parts.slice(1).join(" ")

      // Remove the @ mention if present (e.g., /start@botname)
      const command = (commandPart?.split("@")[0] ?? "/").slice(1)

      return {
        command,
        args,
        chatId: message.chat.id,
        userId: message.from.id,
        username: message.from.username,
        firstName: message.from.first_name
      }
    }

    // Send typing indicator
    const sendTypingAction = (chatId: number): Effect.Effect<void, TelegramError> =>
      Effect.tryPromise({
        try: async () => {
          await fetch(`${apiUrl}/sendChatAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              action: "typing"
            })
          })
        },
        catch: (error) => new TelegramError("Failed to send typing action", error)
      })

    return {
      sendMessage,
      parseCommand,
      sendTypingAction
    }
  })
)

export const TelegramServiceLayer = TelegramServiceLive
