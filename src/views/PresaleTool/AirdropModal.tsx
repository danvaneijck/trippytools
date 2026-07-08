import { useCallback, useState } from "react";
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import { useNavigate } from 'react-router-dom';
import { humanReadableAmount } from "../../utils/helpers";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import { sendNativeMultiSend } from "../../utils/multiSend";
import { buildShroomFeeMessages } from "../../utils/shroomFee";

interface AirdropRecord {
    address: string;
    amount: number;
    amountFormatted: number;
    percent: number;
    contribution: number;
    contributionFormatted: number;
}

interface AirdropModalProps {
    airdropDetails: AirdropRecord[];
    tokenInfo: { denom: string; symbol: string; decimals: number };
    setShowModal: (show: boolean) => void;
}

const AirdropModal = (props: AirdropModalProps) => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork } = useNetworkStore()

    const navigate = useNavigate()

    const [shroomFee] = useState(200000)
    const [feePayed, setFeePayed] = useState(false)

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)
    const [msgPreview, setMsgPreview] = useState<any>(null)

    const [error, setError] = useState<any>(null)

    const payFee = useCallback(async () => {

        const injectiveAddress = connectedAddress

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong wallet address")
        }
        else {
            setError(null)
        }

        // Auto-converts bank SHROOM → CW20 if the wallet's CW20 balance is short.
        const messages = await buildShroomFeeMessages(injectiveAddress as string, shroomFee)
        console.log("send shroom fee", messages)
        return await performTransaction(injectiveAddress as string, messages)
    }, [shroomFee, connectedAddress])

    const sendAirdrops = useCallback(async (denom: string) => {
        if (!connectedAddress) {
            throw new Error("Please connect your wallet to continue")
        }
        setError(null)

        const records = props.airdropDetails.map((record) => ({
            address: record.address,
            amount: record.amount,
        }));

        return sendNativeMultiSend(connectedAddress, denom, records, {
            chunkSize: 1200,
            retries: 3,
            onPreview: setMsgPreview,
            onProgress: (done, total) => setProgress(`Sent ${done}/${total} transactions`),
        });
    }, [connectedAddress, props.airdropDetails]);

    const handleSendAirdrops = useCallback(async () => {
        setTxLoading(true)
        try {
            if (currentNetwork == "mainnet" && !feePayed) {
                setProgress("Pay shroom fee for airdrop")
                const result = await payFee()
                if (result) setFeePayed(true)
            }
            setProgress("Send airdrops")
            const r = await sendAirdrops(props.tokenInfo.denom)
            console.log("done", r)
            setTxLoading(false)
            void navigate(`/token-holders?address=${props.tokenInfo.denom}`);
        } catch (e: any) {
            console.log(e)
            setError(e.message)
            setProgress("")
            setTxLoading(false)
        }
    }, [currentNetwork, feePayed, navigate, payFee, props.tokenInfo.denom, sendAirdrops])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-hidden focus:outline-hidden text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-hidden focus:outline-hidden">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Perform pre sale airdrop
                            </h3>

                        </div>

                        <div className="relative p-6 flex-auto 25">
                            <div>
                                <p>
                                    Airdropping token: {props.tokenInfo.symbol}
                                </p>
                                <p>
                                    Required {props.tokenInfo.symbol}: {props.airdropDetails.reduce((accumulator, current) => {
                                        return accumulator + current.amount;
                                    }, 0) / Math.pow(10, props.tokenInfo.decimals)} {props.tokenInfo.symbol}
                                </p>
                                {props.airdropDetails !== null && props.airdropDetails.length > 0 &&
                                    <div className="mt-5">
                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                            <div>Total wallets to airdrop: {props.airdropDetails.length}</div>
                                            <div className="mt-2">
                                                <table className="table-auto w-full text-left">
                                                    <thead className="text-white">
                                                        <tr>
                                                            <th className="px-4 py-2">
                                                                Address
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Airdrop
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {props.airdropDetails.filter((x) => Number(x.amount) !== 0).map((holder, index) => (
                                                            <tr key={index} className="text-white border-b text-xs">
                                                                <td className="px-4 py-1 whitespace-nowrap">
                                                                    <a
                                                                        className="hover:text-indigo-900"
                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                    >
                                                                        {holder.address}
                                                                        {
                                                                            (WALLET_LABELS as Record<string, any>)[holder.address] ? (
                                                                                <span className={`${(WALLET_LABELS as Record<string, any>)[holder.address].bgColor} ${(WALLET_LABELS as Record<string, any>)[holder.address].textColor} ml-2`}>
                                                                                    {(WALLET_LABELS as Record<string, any>)[holder.address].label}
                                                                                </span>
                                                                            ) : null
                                                                        }
                                                                    </a>
                                                                </td>
                                                                <td className="px-4 py-1">
                                                                    {(Number(holder.amountFormatted))} {props.tokenInfo.symbol}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                }
                                {
                                    props.airdropDetails !== null && props.airdropDetails.length == 0 &&
                                    <div
                                        className="my-5 text-lg"
                                    >
                                        No airdrops to send
                                    </div>
                                }
                            </div>

                        </div>
                        <div className="pl-6 mb-5">If the airdrop TX fails, up the gas !</div>

                        <div
                            className="mx-5"
                        >
                            {progress && <div className="">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-rose-600 mt-2">{error}</div>}
                        </div>


                        {!connectedAddress &&
                            <div
                                className="m-5 text-rose-600 text-lg"
                            >
                                Please connect your wallet to continue
                            </div>
                        }

                        {msgPreview !== null &&
                            <div className="text-xs m-5 max-h-40 overflow-y-scroll whitespace-pre">
                                message preview:{"\n\n"}
                                {JSON.stringify(msgPreview.toData(), null, 2)}
                            </div>
                        }

                        {currentNetwork == "mainnet" && (props.airdropDetails.length > 0) && <div className="m-5">
                            Fee for airdrop: {humanReadableAmount(shroomFee)} shroom (cw20)<br />
                            <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                            <br />
                            <div className="mt-2">Fee payed: {feePayed ? "True" : "False"}</div>
                        </div>
                        }

                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(false)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded-sm shadow-sm hover:shadow-lg outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => { void handleSendAirdrops(); }}
                            >
                                Send Airdrops
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default AirdropModal