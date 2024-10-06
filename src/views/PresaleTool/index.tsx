import { ToastContainer } from "react-toastify"
import Footer from "../../components/App/Footer"
import { Link } from "react-router-dom"
import ConnectKeplr from "../../components/App/ConnectKeplr"
import TokenSelect from "../../components/Inputs/TokenSelect"
import { useCallback, useEffect, useState } from "react"
import ShroomBalance from "../../components/App/ShroomBalance"
import { useSelector } from "react-redux"
import TokenUtils from "../../modules/tokenUtils"
import RefundModal from "./RefundModal"
import { humanReadableAmount } from "../../utils"
import AirdropModal from "./AirdropModal"


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

    const [maxCap, setMaxCap] = useState(1000)
    const [minPerWallet, setMinPerWallet] = useState(0.1)
    const [maxPerWallet, setMaxPerWallet] = useState(50)

    const [amountList, setAmountList] = useState(null)

    const [refundModal, setRefundModal] = useState(false)
    const [refundAmounts, setRefundAmounts] = useState([])

    const [totalToRefund, setTotalToRefund] = useState(null)

    const [tokenToAirdrop, setTokenToAirdrop] = useState("factory/inj1lq9wn94d49tt7gc834cxkm0j5kwlwu4gm65lhe/subs")
    const [tokenInfo, setTokenInfo] = useState(null);
    const [tokenBalance, setTokenBalance] = useState(null);
    const [percentToAirdrop, setPercentToAirdrop] = useState(50)

    const [airdropModal, setAirdropModal] = useState(false)
    const [airdropList, setAirdropList] = useState(null)

    const [error, setError] = useState(null)

    useEffect(() => {
        setAmountList(null)
    }, [minPerWallet, maxPerWallet, maxCap])

    useEffect(() => {
        setAirdropList(null)
    }, [percentToAirdrop])


    const handleCollectWallets = useCallback(async () => {
        setAmountList(null)
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
            setTotalToRefund(totalToRefund)
        }

    }, [networkConfig, walletAddress, presaleToken, maxCap, minPerWallet, maxPerWallet])

    const handleRefund = useCallback(() => {
        const refundList = amountList.map((amount) => {
            return {
                address: amount.address,
                amount: amount.toRefund
            }
        })
        setRefundAmounts(refundList.filter(x => x.amount !== 0))
        setRefundModal(true)
    }, [amountList])

    const handleRefundAll = useCallback(() => {
        const refundList = amountList.map((amount) => {
            return {
                address: amount.address,
                amount: amount.amountSent - amount.amountRefunded
            }
        })
        setRefundAmounts(refundList.filter(x => x.amount > 0))
        setRefundModal(true)
    }, [amountList])

    const handleGetTokenDetails = useCallback(async () => {
        console.log(connectedAddress)
        if (!connectedAddress) {
            setError("Please connect your wallet to continue")
            return
        }
        else {
            setError(null)
        }
        if (!tokenToAirdrop.includes("factory")) {
            setError("Only token factory tokens are supported right now")
            return
        }
        else {
            setError(null)
        }
        const module = new TokenUtils(networkConfig);
        const metadata = await module.getDenomExtraMetadata(tokenToAirdrop);
        setTokenInfo(metadata);
        const balance = await module.getBalanceOfToken(tokenToAirdrop, connectedAddress)
        setTokenBalance(balance)
    }, [tokenToAirdrop, networkConfig, connectedAddress])

    const handlePrepareAirdropList = useCallback(async () => {
        console.log(amountList)
        let totalToSend = tokenBalance.amount * (percentToAirdrop / 100)

        totalToSend = totalToSend - (totalToSend * 0.0000001)

        const totalContributions = amountList.reduce((acc, curr) => acc + curr.contribution, 0);


        const airdropList = amountList.map((amount) => {
            const percentContribution = (amount.contribution / totalContributions) * 100;
            const amountToSend = Math.round(totalToSend * (percentContribution / 100))

            return {
                address: amount.address,
                amount: amountToSend,
                amountFormatted: amountToSend / Math.pow(10, tokenInfo.decimals),
                percent: percentContribution,
                contribution: amount.contribution,
                contributionFormatted: amount.totalContributionFormatted
            }
        })
        setAirdropList(airdropList)
    }, [tokenInfo, percentToAirdrop, amountList, tokenBalance])

    const handleAirdrop = useCallback(() => {
        setAirdropModal(true)
    }, [])

    return (
        <>
            {refundModal &&
                <RefundModal
                    refundDetails={refundAmounts}
                    tokenAddress={presaleToken.value}
                    decimals={18}
                    setShowModal={setRefundModal}
                    collectWallets={handleCollectWallets}
                />
            }
            {airdropModal &&
                <AirdropModal
                    airdropDetails={airdropList}
                    tokenInfo={tokenInfo}
                    setShowModal={setAirdropModal}
                />
            }
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
                                    className="block text-white font-bold"
                                >
                                    Pre sale Token
                                </label>
                                <span
                                    className="text-sm"
                                >
                                    The token being raised in the pre sale. Only INJ supported for now.
                                </span>
                                <TokenSelect
                                    options={[
                                        {
                                            label: "TOKENS",
                                            options: [INJECTIVE_TOKEN]
                                        },
                                    ]}
                                    selectedOption={presaleToken}
                                    setSelectedOption={setPresaleToken}
                                />
                            </div>

                            <div className="mt-4 space-y-2">
                                <label
                                    htmlFor="token-address"
                                    className="block text-white font-bold"
                                >
                                    Pre sale wallet address
                                </label>
                                <span
                                    className="text-sm"
                                >
                                    The wallet address where the funds are being sent to. This should be a fresh wallet created purely for the purpose of the pre sale.
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
                            <label
                                htmlFor="token-address"
                                className="block text-white text-sm mt-1"
                            >
                                Please note down these variables in case you need to input them again later
                            </label>

                            <button
                                onClick={handleCollectWallets}
                                className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5"
                            >
                                Collect wallets
                            </button>

                            {amountList !== null &&
                                <div>
                                    <div className="overflow-x-auto mt-2 text-sm  max-h-60 overflow-y-scroll">
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
                                                        <td className="px-6 py-1">{holder.amountSentFormatted} {presaleToken.label}</td>
                                                        <td className="px-6 py-1">{holder.toRefundFormatted} {presaleToken.label}</td>
                                                        <td className="px-6 py-1">{holder.amountRefundedFormatted} {presaleToken.label}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {
                                        totalToRefund !== null &&
                                        <div className="mt-5">
                                            Total to refund: {totalToRefund / Math.pow(10, 18)} {presaleToken.label}
                                        </div>
                                    }

                                    <button
                                        onClick={handleRefund}
                                        className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5"
                                    >
                                        Review Refunds
                                    </button>
                                    <button
                                        onClick={handleRefundAll}
                                        className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5 ml-5"
                                    >
                                        Review Refund All
                                    </button>

                                </div>
                            }

                            {totalToRefund != 0 && amountList !== null &&
                                <div className="mt-5 text-rose-600">
                                    Please process all refunds to continue, or increase the max total cap
                                </div>
                            }

                            {totalToRefund == 0 && amountList !== null &&
                                <div>
                                    <div className="mt-4 space-y-2">
                                        <label
                                            htmlFor="token-address"
                                            className="block text-white font-bold"
                                        >
                                            Token to airdrop to participants
                                        </label>
                                        <span
                                            className="text-sm"
                                        >
                                            The denom that we are airdropping to participants
                                        </span>
                                        <br />
                                        <input
                                            className="w-full rounded p-2 text-black"
                                            type="text"
                                            value={tokenToAirdrop}
                                            onChange={(e) => setTokenToAirdrop(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        onClick={handleGetTokenDetails}
                                        className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-2"
                                    >
                                        Get token details
                                    </button>
                                </div>
                            }
                            {tokenInfo && tokenBalance && totalToRefund == 0 &&
                                <div>
                                    <div className="mt-5 text-white mr-20">
                                        <div className="font-bold">address: {tokenInfo.denom}</div>
                                        <div>name: {tokenInfo.name}</div>
                                        <div>symbol: {tokenInfo.symbol}</div>
                                        {tokenInfo.decimals !== null && <div>decimals: {tokenInfo.decimals}</div>}
                                        {tokenInfo.description && tokenInfo.description.length > 0 && <div>description: {tokenInfo.description}</div>}
                                        {tokenInfo.total_supply && (
                                            <div>
                                                total supply:{" "}
                                                {humanReadableAmount(tokenInfo.total_supply /
                                                    Math.pow(10, tokenInfo.decimals))}
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className="text-lg font-bold mt-2"
                                    >
                                        Your balance: {humanReadableAmount(tokenBalance.amount / Math.pow(10, tokenInfo.decimals))}
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <label
                                            htmlFor="token-address"
                                            className="block text-white font-bold"
                                        >
                                            Percent to airdrop
                                        </label>
                                        <span
                                            className="text-sm"
                                        >
                                            The percentage of your balance to airdrop to participants
                                        </span>
                                        <br />
                                        <input
                                            className="w-full rounded p-2 text-black"
                                            type="number"
                                            max={100}
                                            min={1}
                                            value={percentToAirdrop}
                                            onChange={(e) => setPercentToAirdrop(e.target.value)}
                                        />
                                    </div>
                                    <div
                                        className="mt-4"
                                    >
                                        Tokens to airdrop: {(tokenBalance.amount / Math.pow(10, tokenInfo.decimals)) * (percentToAirdrop / 100)}
                                    </div>
                                    <button
                                        onClick={handlePrepareAirdropList}
                                        className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-2"
                                    >
                                        Prepare airdrop list
                                    </button>
                                </div>
                            }

                            {airdropList !== null && totalToRefund == 0 &&
                                <div>
                                    <div className="overflow-x-auto mt-2 text-sm  max-h-60 overflow-y-scroll">
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
                                                        Contribution
                                                    </th>
                                                    <th className="px-4 py-2">
                                                        To Send
                                                    </th>
                                                    <th className="px-4 py-2">
                                                        Percentage
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {airdropList.sort((a, b) => b.amount - a.amount).map((holder, index) => (
                                                    <tr key={index} className="text-white border-b text-left">
                                                        <td className="px-6 py-1">{index + 1}</td>
                                                        <td className="px-6 py-1">{holder.address}</td>
                                                        <td className="px-6 py-1">{holder.contributionFormatted} {presaleToken.label}</td>
                                                        <td className="px-6 py-1">{holder.amountFormatted} {tokenInfo.symbol}</td>
                                                        <td className="px-6 py-1">{holder.percent.toFixed(4)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>


                                    <button
                                        onClick={handleAirdrop}
                                        className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-5"
                                    >
                                        Review Airdrop
                                    </button>


                                </div>
                            }

                            {error !== null &&
                                <div className="text-rose-600 text-lg mt-5">
                                    {error}
                                </div>
                            }
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        </>

    )
}

export default PreSaleTool