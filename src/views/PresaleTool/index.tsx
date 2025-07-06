import { ToastContainer } from "react-toastify"
import Footer from "../../components/App/Footer"
import { useSearchParams } from "react-router-dom"
import TokenSelect from "../../components/Inputs/TokenSelect"
import { useCallback, useEffect, useState } from "react"
import ShroomBalance from "../../components/App/ShroomBalance"
import TokenUtils from "../../modules/tokenUtils"
import RefundModal from "./RefundModal"
import { humanReadableAmount } from "../../utils/helpers"
import AirdropModal from "./AirdropModal"
import DisclaimerModal from "../../components/Modals/DisclaimerModal"
import moment from "moment"
import { FaCheckCircle } from "react-icons/fa"
import { ImCross } from "react-icons/im"
import useWalletStore from "../../store/useWalletStore"
import useNetworkStore from "../../store/useNetworkStore"


const INJECTIVE_TOKEN = {
    value: "inj",
    label: "INJ",
    img: "https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Finjective%2Fimages%2Finj.svg&n=-1&w=64&h=64"
}


const PreSaleTool = () => {

    const [searchParams, setSearchParams] = useSearchParams();

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [injPrice, setInjPrice] = useState(null)
    const [injBalance, setINJBalance] = useState(null)

    const [presaleToken, setPresaleToken] = useState(INJECTIVE_TOKEN)
    // const [walletAddress, setWalletAddress] = useState(connectedAddress ?? "")

    const [walletAddress, setWalletAddress] = useState(
        searchParams.get("walletAddress") || "inj1u5tqjvvffun8ld35kq860sw9rpvcmmr2adeucg"
    );
    const [ignoredAddresses, setIgnoredAddresses] = useState(
        searchParams.get("ignoredAddresses") || "inj18xsczx27lanjt40y9v79q0v57d76j2s8ctj85x"
    );
    const [maxCap, setMaxCap] = useState(
        Number(searchParams.get("maxCap")) || 200
    );
    const [minPerWallet, setMinPerWallet] = useState(
        Number(searchParams.get("minPerWallet")) || 0.1
    );
    const [maxPerWallet, setMaxPerWallet] = useState(
        Number(searchParams.get("maxPerWallet")) || 2
    );

    useEffect(() => {
        const params = {
            walletAddress,
            ignoredAddresses,
            maxCap,
            minPerWallet,
            maxPerWallet,
        };

        setSearchParams(params);
    }, [walletAddress, ignoredAddresses, maxCap, minPerWallet, maxPerWallet, setSearchParams]);

    const [amountList, setAmountList] = useState(null)
    const [walletFilter, setWalletFilter] = useState(null)

    const [refundModal, setRefundModal] = useState(false)
    const [refundAmounts, setRefundAmounts] = useState([])

    const [totalToRefund, setTotalToRefund] = useState(null)
    const [totalRefunded, setTotalRefunded] = useState(null)
    const [totalContributions, setTotalContributions] = useState(null)

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

    const getINJBalance = useCallback(async () => {
        console.log("get INJ price")
        const module = new TokenUtils(networkConfig);
        try {
            const price = await module.getINJDerivativesPrice();
            const balance = await module.getBalanceOfToken('inj', connectedAddress)
            console.log(balance)
            setINJBalance(Number(balance.amount) / Math.pow(10, 18))
            setInjPrice(price)
            return price;
        } catch (error) {
            console.error('Failed to fetch INJ price:', error);
            throw error;
        }
    }, [connectedAddress, networkConfig]);

    useEffect(() => {
        setAmountList(null)
        setTokenInfo(null)
        setAirdropList(null)
        if (connectedAddress) {
            getINJBalance().then(r => {
                console.log(r)
            }).catch(e => {
                console.log(e)
            })
            if (!walletAddress) {
                setWalletAddress(connectedAddress)
            }
        }
    }, [connectedAddress, getINJBalance, networkConfig, walletAddress])

    const handleCollectWallets = useCallback(async () => {
        setAmountList(null)
        const module = new TokenUtils(networkConfig);

        if (!walletAddress) {
            setError("Please enter a pre sale wallet address")
            return
        }
        else {
            setError(null)
        }

        const allTransactions = await module.getAccountTx(walletAddress);

        if (allTransactions) {
            const { preSaleAmounts, totalAmountReceived } = module.getPreSaleAmounts(
                walletAddress,
                ignoredAddresses.split(","),
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
            let totalToRef = totalToRefund - totalRefunded
            if (totalToRef < 0) totalToRef = 0
            setTotalToRefund(totalToRef)

            setTotalRefunded((totalRefunded / Math.pow(10, 18)).toFixed(2))

            setTotalContributions((totalContribution / Math.pow(10, 18)).toFixed(2))
        }

    }, [networkConfig, walletAddress, presaleToken, maxCap, minPerWallet, maxPerWallet, ignoredAddresses])

    useEffect(() => {
        if (
            walletAddress && ignoredAddresses && maxCap && minPerWallet && maxPerWallet && !amountList
        ) {
            handleCollectWallets()
        }
    }, [walletAddress, ignoredAddresses, maxCap, minPerWallet, maxPerWallet, amountList, handleCollectWallets])

    const handleRefund = useCallback(() => {
        const refundList = amountList.map((amount) => {
            console.log(amount.amountRefunded)
            return {
                address: amount.address,
                amount: Number(amount.toRefund) - Number(amount.amountRefunded ?? 0)
            }
        })
        setRefundAmounts(refundList.filter(x => x.amount !== 0))
        setRefundModal(true)
    }, [amountList])

    const handleRefundAll = useCallback(() => {
        const refundList = amountList.map((amount) => {
            return {
                address: amount.address,
                amount: Number(amount.amountSent) - Number(amount.amountRefunded ?? 0)
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

        console.log(`total to send ${totalToSend}`)

        const totalContributions = amountList.reduce((acc, curr) => acc + curr.contribution, 0);

        console.log(`total contributions ${totalContributions}`)

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

        console.log(airdropList)

        setAirdropList(airdropList)
    }, [tokenInfo, percentToAirdrop, amountList, tokenBalance])

    const handleAirdrop = useCallback(() => {
        setAirdropModal(true)
    }, [])

    const CsvHeaders = [
        { label: "address", key: "address" },
        { label: "amount", key: "amountFormatted" },
    ];


    return (
        <>
            <DisclaimerModal />
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
                    airdropDetails={airdropList.filter(record => record.amount != 0)}
                    tokenInfo={tokenInfo}
                    setShowModal={setAirdropModal}
                />
            }
            <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                <ToastContainer />
                <div className="pt-16 md:pt-24 flex-grow mx-2 pb-20">
                    {currentNetwork == "mainnet" &&
                        <div className="mb-2 flex flex-row justify-between">
                            <ShroomBalance />
                            <div className="text-sm">
                                {injPrice &&
                                    <div>INJ  price: ${Number(injPrice).toFixed(2)}</div>
                                }
                                {injPrice && injBalance &&
                                    <div>INJ  balance: {injBalance.toFixed(2)} (${(injBalance * injPrice).toFixed(2)})</div>
                                }
                            </div>
                        </div>
                    }

                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-screen-lg px-2 ">
                            <div className="text-center text-white">
                                <div className="text-3xl font-magic">
                                    Pre sale tool
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
                            <div className="mt-4 space-y-2">
                                <label
                                    htmlFor="token-address"
                                    className="block text-white font-bold"
                                >
                                    Wallets to ignore
                                </label>
                                <span
                                    className="text-sm"
                                >
                                    Wallet addresses to exclude from the count.
                                    These may be addresses you sent gas from or are sending the pre sale funds to in order to create the LP.
                                    Comma separated.
                                </span>
                                <br />
                                <input
                                    className="w-full rounded p-2 text-black"
                                    type="text"
                                    value={ignoredAddresses}
                                    onChange={(e) => setIgnoredAddresses(e.target.value)}
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
                                    <input
                                        className="w-full rounded p-1 px-2 text-black mt-1 text-sm"
                                        type="text"
                                        placeholder="Search wallet"
                                        value={walletFilter}
                                        onChange={(e) => setWalletFilter(e.target.value)}
                                    />
                                    <div className="overflow-x-auto mt-2 text-sm  max-h-80 overflow-y-scroll">
                                        <table className="table-auto w-full">
                                            <thead className="text-white text-left">
                                                <tr>
                                                    <th className="px-2 py-2">
                                                        Block time
                                                    </th>
                                                    <th className="px-2 py-2">
                                                        Address
                                                    </th>
                                                    <th className="px-2 py-2">
                                                        Included
                                                    </th>
                                                    <th className="px-2 py-2">
                                                        Amount Sent
                                                    </th>
                                                    <th className="px-2 py-2">
                                                        To Refund
                                                    </th>
                                                    <th className="px-2 py-2">
                                                        Refunded
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {amountList.filter(holder => {
                                                    return walletFilter && walletFilter.length > 0
                                                        ? holder.address === walletFilter
                                                        : true;
                                                }).sort((a, b) => new Date(a.timeSent) - new Date(b.timeSent)).map((holder, index) => (
                                                    <tr
                                                        key={index}
                                                        className={holder.toRefundFormatted != holder.amountRefundedFormatted ? "bg-rose-600" : "text-white border-b text-left"}
                                                    >
                                                        <td className="px-2 py-1">{moment(holder.timeSent).format("D MMM hh:mm:ss a")}</td>
                                                        <td className="px-2 py-1 ">{holder.address}</td>
                                                        <td className="px-2 py-1">{holder.contribution > 0 ?
                                                            <div><FaCheckCircle className="text-emerald-500" /></div>
                                                            :
                                                            <div><ImCross className="text-rose-500" /></div>}
                                                        </td>
                                                        <td className="px-2 py-1 ">{holder.amountSentFormatted.toFixed(4)} {presaleToken.label}</td>
                                                        <td className="px-2 py-1 ">{holder.toRefundFormatted.toFixed(4)} {presaleToken.label}</td>
                                                        <td className="px-2 py-1 ">{holder.amountRefundedFormatted.toFixed(4)} {presaleToken.label}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {
                                        totalRefunded !== null &&
                                        <div className="mt-5">
                                            Total refunded: {totalRefunded} {presaleToken.label}
                                        </div>
                                    }
                                    {
                                        totalToRefund !== null &&
                                        <div className="mt-1">
                                            Total to refund: {totalToRefund / Math.pow(10, 18)} {presaleToken.label}
                                        </div>
                                    }
                                    {
                                        totalContributions !== null &&
                                        <div className="mt-1">
                                            Total contributions: {totalContributions} {presaleToken.label}
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

                                    <div className="flex flex-row mt-5">
                                        <button
                                            onClick={handleAirdrop}
                                            className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 "
                                        >
                                            Review Airdrop
                                        </button>
                                        {/* <CSVLink data={airdropList} headers={CsvHeaders} filename={"airdrop.csv"}>
                                            <button className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 ml-5">
                                                Download CSV
                                            </button>
                                        </CSVLink> */}
                                    </div>
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
            </div >
        </>

    )
}

export default PreSaleTool