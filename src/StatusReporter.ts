import Big from "big.js"
import { Wallet } from "ethers"
import { parseBytes32String } from "ethers/lib/utils"
import FTXRest from "ftx-api-rest"
import { Service } from "typedi"
import { ERC20Service } from "./ERC20Service"
import { EthService } from "./EthService"
import { FtxService } from "./FtxService"
import { Log } from "./Log"
import { PerpService, PnlCalcOption } from "./PerpService"
import { ServerProfile } from "./ServerProfile"
import { SystemMetadataFactory } from "./SystemMetadataFactory"

const USDC_TOKEN_ADDR = "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83"

enum AccountType {
    Perp = "Perp",
    FTX = "FTX",
}

type AccountValues = Record<AccountType, Big>

@Service()
export class StatusReporter {
    private readonly log = Log.getLogger(StatusReporter.name)

    private readonly arbitrageur: Wallet
    private readonly ftxClient: any

    constructor(
        readonly perpService: PerpService,
        readonly erc20Service: ERC20Service,
        readonly ethService: EthService,
        readonly serverProfile: ServerProfile,
        readonly systemMetadataFactory: SystemMetadataFactory,
        readonly ftxService: FtxService
    ) {
        this.arbitrageur = ethService.privateKeyToWallet(serverProfile.arbitrageurPK)
        this.ftxClient = new FTXRest({
            key: this.serverProfile.ftxApiKey,
            secret: this.serverProfile.ftxApiSecret,
            subaccount: this.serverProfile.ftxSubaccount,
        })
    }

    async getAccountValues(): Promise<AccountValues> {
        const [perpVal, ftxVal] = await Promise.all([this.getPerpAccountValue(), this.getFtxAccountValue()])

        return {
            [AccountType.Perp]: perpVal,
            [AccountType.FTX]: ftxVal,
        }
    }

    private async getPerpAccountValue(): Promise<Big> {
        const { address: arbitrageurAddr } = this.arbitrageur
        const [quoteBalance, pnl] = await Promise.all([
            this.erc20Service.balanceOf(USDC_TOKEN_ADDR, arbitrageurAddr),
            this.getPerpPnl(arbitrageurAddr),
        ])

        return quoteBalance.add(pnl)
    }

    private async getFtxAccountValue(): Promise<Big> {
        const account = await this.ftxService.getAccountInfo(this.ftxClient)
        return account.totalAccountValue
    }

    async getPerpPnl(arbitrageurAddr: string): Promise<Big> {
        const amms = await this.perpService.getAllOpenAmms()

        const promises = amms.map(async (amm) => {
            const ammAddr = amm.address

            const [priceFeedKey, margin, unrealizedPnl] = await Promise.all([
                amm.priceFeedKey().then(parseBytes32String),
                this.perpService
                    .getPersonalPositionWithFundingPayment(ammAddr, arbitrageurAddr)
                    .then((position) => position.margin),

                this.perpService.getUnrealizedPnl(ammAddr, arbitrageurAddr, PnlCalcOption.SPOT_PRICE),
            ])

            this.log.jinfo({
                event: "PerpFiPnL",
                params: {
                    priceFeedKey,
                    margin: margin.toString(),
                    unrealizedPnl: unrealizedPnl.toString(),
                },
            })

            return margin.add(unrealizedPnl)
        })

        const ammPnls = await Promise.all(promises)

        return ammPnls.reduce((sum, pnl) => sum.add(pnl), Big(0))
    }
}
