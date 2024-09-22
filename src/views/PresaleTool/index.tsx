import { ToastContainer } from "react-toastify"
import Footer from "../../components/App/Footer"
import { Link } from "react-router-dom"
import ConnectKeplr from "../../components/App/ConnectKeplr"
import TokenSelect from "../../components/Inputs/TokenSelect"
import { useCallback, useState } from "react"
import { TOKENS } from "../../constants/contractAddresses"
import ShroomBalance from "../../components/App/ShroomBalance"
import { useSelector } from "react-redux"
import TokenUtils from "../../modules/tokenUtils"

const INJECTIVE_TOKEN = {
    value: "inj",
    label: "INJ",
    img: "https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Finjective%2Fimages%2Finj.svg&n=-1&w=64&h=64"
}

const PreSaleTool = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [presaleToken, setPresaleToken] = useState(INJECTIVE_TOKEN)
    const [walletAddress, setWalletAddress] = useState("inj1yegzy0u8z8k0mzcq6532nzk8eg2z9yyuppqxgk")

    const [maxCap, setMaxCap] = useState(500)
    const [minPerWallet, setMinPerWallet] = useState(0.1)
    const [maxPerWallet, setMaxPerWallet] = useState(50)

    const [amountList, setAmountList] = useState(null)

    const handleCollectWallets = useCallback(async () => {
        const module = new TokenUtils(networkConfig);

        const allTransactions = await module.getAccountTx(walletAddress);

        if (allTransactions) {
            const { preSaleAmounts, totalAmountReceived } = module.getPreSaleAmounts(
                walletAddress,
                allTransactions,
                maxCap,
                minPerWallet,
                maxPerWallet,
                presaleToken.value
            );

            console.log(preSaleAmounts)
            let totalRefunded = 0;
            let totalContribution = 0;
            let totalToRefund = 0;

            Array.from(preSaleAmounts.values()).forEach((entry) => {
                if (entry.amountRefunded)
                    totalRefunded += Number(entry.amountRefunded) ?? 0;
                if (entry.contribution)
                    totalContribution += Number(entry.contribution) ?? 0;
                if (entry.toRefund) totalToRefund += Number(entry.toRefund) ?? 0;
            });

            console.log(
                "total received: ",
                (totalAmountReceived / Math.pow(10, 18)).toFixed(2),
                "INJ"
            );
            console.log(
                "to refund: ",
                (totalToRefund / Math.pow(10, 18)).toFixed(2),
                "INJ"
            );
            console.log(
                "total contributions: ",
                (totalContribution / Math.pow(10, 18)).toFixed(2),
                "INJ"
            );
            console.log(
                "total refunded: ",
                (totalRefunded / Math.pow(10, 18)).toFixed(2),
                "INJ"
            );

            setAmountList(Array.from(preSaleAmounts.values()))
        }

    }, [networkConfig, walletAddress, presaleToken, maxCap, minPerWallet, maxPerWallet])

    return (
        <div className="flex flex-col min-h-screen pb-10">
            <ToastContainer />
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-sm">
                    <Link to="/" className="font-bold hover:underline mx-5">
                        home
                    </Link>

                    <Link
                        to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                        className="font-bold hover:underline mr-5"
                    >
                        liquidity tool
                    </Link>
                    <Link
                        to="/manage-tokens"
                        className="font-bold hover:underline "
                    >
                        manage tokens
                    </Link>
                </div>
                <div className="m-2">
                    <ConnectKeplr />
                </div>
            </header>

            <div className="pt-14 flex-grow mx-2 pb-20">
                {currentNetwork == "mainnet" && <div className=""><ShroomBalance /></div>}
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-lg px-2 py-10">
                        <div className="text-center text-white">
                            <div className="text-xl">
                                Trippy Pre sale tool
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label
                                htmlFor="token-address"
                                className="block text-white"
                            >
                                Pre sale Token
                            </label>
                            <span
                                className="text-sm"
                            >
                                The token being raised in the pre sale
                            </span>
                            <TokenSelect
                                options={[
                                    {
                                        label: "TOKENS",
                                        options: [INJECTIVE_TOKEN, ...TOKENS]
                                    },
                                ]}
                                selectedOption={presaleToken}
                                setSelectedOption={setPresaleToken}
                            />
                        </div>

                        <div className="mt-4 space-y-2">
                            <label
                                htmlFor="token-address"
                                className="block text-white"
                            >
                                Pre sale wallet address
                            </label>
                            <span
                                className="text-sm"
                            >
                                The wallet address where the funds are being sent to
                            </span>
                            <br />
                            <input
                                className="w-full rounded p-2 text-black"
                                type="text"
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                            />
                        </div>

                        <div
                            className="mt-4 space-x-5 flex flex-row"
                        >
                            <div>
                                <label
                                    htmlFor="token-address"
                                    className="block text-white"
                                >
                                    Min per wallet
                                </label>
                                <input
                                    className="w-full rounded p-2 text-black mt-1"
                                    type="number"
                                    value={minPerWallet}
                                    onChange={(e) => setMinPerWallet(e.target.value)}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="token-address"
                                    className="block text-white"
                                >
                                    Max per wallet
                                </label>
                                <input
                                    className="w-full rounded p-2 text-black mt-1"
                                    type="number"
                                    value={maxPerWallet}
                                    onChange={(e) => setMaxPerWallet(e.target.value)}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="token-address"
                                    className="block text-white"
                                >
                                    Max total cap
                                </label>
                                <input
                                    className="w-full rounded p-2 text-black mt-1"
                                    type="number"
                                    value={maxCap}
                                    onChange={(e) => setMaxCap(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleCollectWallets}
                            className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5"
                        >
                            Collect wallets
                        </button>

                        {amountList !== null &&
                            <div>
                                <div className="overflow-x-auto mt-2 text-sm  max-h-80 overflow-y-scroll">
                                    <table className="table-auto w-full">
                                        <thead className="text-white text-left">
                                            <tr>
                                                <th className="px-4 py-2">
                                                    Position
                                                </th>
                                                <th className="px-4 py-2">
                                                    Address
                                                </th>
                                                <th className="px-4 py-2">
                                                    Amount Sent
                                                </th>
                                                <th className="px-4 py-2">
                                                    To Refund
                                                </th>
                                                <th className="px-4 py-2">
                                                    Amount Refunded
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {amountList.sort((a, b) => b.amountSent - a.amountSent).map((holder, index) => (
                                                <tr key={index} className="text-white border-b text-left">
                                                    <td className="px-6 py-1">{index + 1}</td>
                                                    <td className="px-6 py-1">{holder.address}</td>
                                                    <td className="px-6 py-1">{holder.amountSentFormatted}</td>
                                                    <td className="px-6 py-1">{holder.toRefundFormatted}</td>
                                                    <td className="px-6 py-1">{holder.amountRefundedFormatted}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>



                                <button
                                    onClick={handleCollectWallets}
                                    className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5"
                                >
                                    Prepare Refund
                                </button>
                                <button
                                    onClick={handleCollectWallets}
                                    className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5 ml-5"
                                >
                                    Refund All
                                </button>

                            </div>
                        }
                    </div>
                </div>
            </div>



            <Footer />
        </div>
    )
}

export default PreSaleTool