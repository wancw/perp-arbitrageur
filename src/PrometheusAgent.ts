import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult, Context } from "aws-lambda"

import { Container, Service } from "typedi"
import * as prom from "prom-client"
import { ExchangeMonitor } from "./ExchangeMonitor"

import { Log } from "./Log"

@Service()
export class PrometheusAgent {
    private readonly log = Log.getLogger(PrometheusAgent.name)

    private readonly register: prom.Registry
    private readonly ftxPriceGauge: prom.Gauge<"name">
    private readonly perpPriceGauge: prom.Gauge<"name">

    constructor() {
        this.ftxPriceGauge = new prom.Gauge({
            name: "ftx_price",
            help: "FTX price",
            labelNames: ["name"] as const,
            async collect() {
                const monitor = Container.get(ExchangeMonitor)
                const coins = await monitor.getFTXStatus()
                for (const coin of coins) {
                    this.set({ name: coin.name }, +coin.price)
                }
            },
        })

        this.perpPriceGauge = new prom.Gauge({
            name: "perp_price",
            help: "Perp price",
            labelNames: ["name"] as const,
            async collect() {
                const monitor = Container.get(ExchangeMonitor)
                const coins = await monitor.getPerpStatus()
                for (const coin of coins) {
                    this.set({ name: coin.name }, +coin.price)
                }
            },
        })

        this.register = new prom.Registry()
        this.register.registerMetric(this.ftxPriceGauge)
        this.register.registerMetric(this.perpPriceGauge)
    }

    async getMetrics() {
        try {
            return await this.register.metrics()
        } catch (e) {
            this.log.jerror({
                event: "GetMetricsFailed",
                params: {
                    reason: e.toString(),
                    stackTrace: e.stack,
                },
            })
            return ""
        }
    }
}
