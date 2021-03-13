import "../src/init"

import Container from "typedi"
import { ExchangeMonitor } from "../src/ExchangeMonitor"

async function main() {
    const monitor = Container.get(ExchangeMonitor)
    const ftxCoins = await monitor.getFTXStatus()
    const perpCoins = await monitor.getPerpStatus()

    console.log('FTX:')
    console.table(ftxCoins.reduce<Record<string, number>>((obj, coin) => {
        obj[coin.name] = +coin.price
        return obj
    }, {}))

    console.log('Perp:')
    console.table(perpCoins.reduce<Record<string, number>>((obj, coin) => {
        obj[coin.name] = +coin.price
        return obj
    }, {}))
}

main()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => console.error(error.stack))
