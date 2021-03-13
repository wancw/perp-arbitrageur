import "./init" // this import is required
import { Service } from "typedi"
import { FtxService } from "./FtxService"
import { PerpService } from "./PerpService"
import Big from "big.js"

export interface Coin {
    name: string,
    price: Big
}

@Service()
export class ExchangeMonitor {
    constructor(
        readonly perpService: PerpService,
        readonly ftxService: FtxService,
    ) { }

    async getPerpStatus(): Promise<Coin[]> {
        const amms = await this.perpService.getAllOpenAmms()
        const promises = amms.map(async amm => {
            const ammState = await this.perpService.getAmmStates(amm.address)
            const ammPrice = ammState.quoteAssetReserve.div(
                ammState.baseAssetReserve,
            )
            const ammPair = `${ammState.baseAssetSymbol}-${ammState.quoteAssetSymbol}`
            return {
                name: ammPair,
                price: Big(ammPrice.toFixed()),
            } as Coin
        })
        return await Promise.all(promises)
    }

    async getFTXStatus(): Promise<Coin[]> {
        const target_markets = ["BTC-PERP", "ETH-PERP", "YFI-PERP", "DOT-PERP", "SNX-PERP", "LINK-PERP", "AAVE-PERP", "SUSHI-PERP"]
        const promises = target_markets.map(async market => {
            const ftxMarket = await this.ftxService.getMarket(market)
            return {
                name: market,
                price: ftxMarket.last!
            }
        })
        return await Promise.all(promises)
    }
}
