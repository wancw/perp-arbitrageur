import "./init" // this import is required

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from "aws-lambda"
import { Container } from "typedi"

import { TelegramBot, TelegramUpdate } from "./TelegramBot"
import { Log } from "./Log"

export const telegramHandler: APIGatewayProxyHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    const log = Log.getLogger("telegramHandler")

    log.jinfo({
        event: "IncomingUpdate",
        params: {
            event,
            context,
        },
    })

    if (event.body) {
        const bot = Container.get(TelegramBot)
        await bot.handleUpdate(JSON.parse(event.body) as TelegramUpdate)
    } else {
        log.jinfo({ event: "EmptyBody" })
    }

    return { statusCode: 200, body: "OK" }
}
