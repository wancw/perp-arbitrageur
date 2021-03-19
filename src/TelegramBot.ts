import "./init" // this import is required

import fetch from "node-fetch"
import { Log } from "./Log"
import { ServerProfile } from "./ServerProfile"
import Container, { Service } from "typedi"
import { StatusReporter } from "./StatusReporter"

interface TelegramUser {
    id: number
    is_bot?: boolean
    first_name?: string
    last_name?: string
    username?: string
    language_code?: string
}

interface TelegramChat {
    id: number
    type: "private" | "group" | "supergroup" | "channel"
}

interface TelegramMessage {
    message_id: number
    date: number
    chat: TelegramChat
    from?: TelegramUser
    text?: string
}

export interface TelegramUpdate {
    update_id: number
    message?: TelegramMessage
}

@Service()
export class TelegramBot {
    private readonly log = Log.getLogger(TelegramBot.name)

    private readonly adminUserId: number
    private readonly botToken: string

    constructor(readonly serverProfile: ServerProfile) {
        this.adminUserId = serverProfile.telegramAdminUserId
        this.botToken = serverProfile.telegramBotToken
    }

    async handleUpdate(update: TelegramUpdate): Promise<void> {
        const { message } = update

        if (!message) {
            this.log.jinfo({ event: "NotMessage" })
            return
        }
        const { chat, text: msgText } = message

        if (chat.type !== "private") {
            this.log.jinfo({ event: "NotPrivateChat" })
            return
        }

        if (chat.id !== this.adminUserId) {
            this.log.jinfo({ event: "NotAdmin" })
            return
        }

        if (!msgText) {
            this.log.jinfo({ event: "NotTextMessage" })
            return
        }

        switch (msgText.toLowerCase()) {
            case "pnl":
                const reporter = Container.get(StatusReporter)
                const values = await reporter.getAccountValues()

                const valStrs = [values.Perp, values.FTX, values.Perp.add(values.FTX)].map((b) => b.toFixed(20))
                const maxValLen = Math.max(...valStrs.map((s) => s.length))
                const fixedValStrs = valStrs.map((s) => s.padStart(maxValLen, " "))

                await this.sendText(
                    chat,
                    [
                        "```",
                        `Perp:  ${fixedValStrs[0]}`,
                        `FTX:   ${fixedValStrs[1]}`,
                        `Total: ${fixedValStrs[2]}`,
                        "```",
                    ].join("\n"),
                    true
                )

                // dirty hack: to release WebSocket connection
                setTimeout(() => process.exit(0), 500)

                break

            default:
                this.log.jinfo({ event: "UnrecognizedCommand", params: { text: msgText } })
        }
    }

    async notifyAdmin(text: string): Promise<void> {
        await this._sendMessage({
            chat_id: this.adminUserId,
            text,
            parse_mode: "MarkdownV2",
        })
    }

    private async sendText(chat: TelegramChat, text: string, disableNotification = false): Promise<void> {
        await this._sendMessage({
            chat_id: chat.id,
            text,
            parse_mode: "MarkdownV2",
            disable_notification: disableNotification,
        })
    }

    private async _sendMessage(req: TelegramSendMessageRequest): Promise<void> {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            method: "post",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
        })
        const { status } = response
        const errorDescription = (await response.json()).description
        this.log.jinfo({ event: "SendMessage", response: { status, errorDescription } })
    }
}

interface TelegramSendMessageRequest {
    chat_id: number
    text: string
    parse_mode?: "MarkdownV2" | "HTML"
    disable_notification?: boolean
}
