import "../src/init"

import Container from "typedi"
import { StatusReporter } from "../src/StatusReporter"

async function main() {
    const reporter = Container.get(StatusReporter)

    const result = await reporter.getAccountValues()

    console.table({
        Perp: +result.Perp,
        FTX: +result.FTX,
        Total: +result.Perp.add(result.FTX),
    })
}

main()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => console.error(error.stack))
