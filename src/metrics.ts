import "./init" // this import is required

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from "aws-lambda"
import { Container } from "typedi"
import { PrometheusAgent } from "./PrometheusAgent"
import { Log } from "./Log"

export const prometheusHandler: APIGatewayProxyHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    const log = Log.getLogger("prometheusHandler")

    log.jinfo({
        event: "IncomingUpdate",
        params: {
            event,
            context,
        },
    })
    const agent = Container.get(PrometheusAgent)
    return { statusCode: 200, body: await agent.getMetrics() }
}
