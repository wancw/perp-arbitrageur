import "./init" // this import is required

import fetch from "node-fetch"
import { Log } from "./Log"
import { ServerProfile } from "./ServerProfile"
import { Service } from "typedi"

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

        const { chat } = message
        if (chat.type !== "private") {
            this.log.jinfo({ event: "NotPrivateChat" })
            return
        }

        if (chat.id !== this.adminUserId) {
            this.log.jinfo({ event: "NotAdmin" })
            return
        }

        await this.replyTo(message, "Hi~ there", true)
    }

    private async replyTo(message: TelegramMessage, text: string, disableNotification = false): Promise<void> {
        await this._sendMessage({
            chat_id: message.chat.id,
            reply_to_message_id: message.message_id,
            text,
            disable_notification: disableNotification,
        })
    }

    private async sendText(chatId: number, text: string): Promise<void> {
        await this._sendMessage({ chat_id: chatId, text })
    }

    private async _sendMessage(req: TelegramSendMessageRequest): Promise<void> {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            method: "post",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req),
        })
        this.log.jinfo({ event: "SendMessage", response })
    }
}

interface TelegramSendMessageRequest {
    chat_id: number
    text: string
    disable_notification?: boolean
    reply_to_message_id?: number
}
