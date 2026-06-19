import { useCallback, useState } from "react";
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import useWalletStore from "../../store/useWalletStore";
import { sendNativeMultiSend } from "../../utils/multiSend";

interface RefundRecord {
    address: string;
    amount: number | string;
}

interface RefundModalProps {
    refundDetails: RefundRecord[];
    tokenAddress: string;
    decimals: number;
    setShowModal: (show: boolean) => void;
    collectWallets: () => void;
}

const RefundModal = (props: RefundModalProps) => {
    const { connectedWallet: connectedAddress } = useWalletStore()

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [msgPreview, setMsgPreview] = useState(null)

    const [error, setError] = useState(null)

    const sendRefunds = useCallback(async (denom: string) => {
        if (!connectedAddress) {
            throw new Error("Please connect your wallet to continue")
        }
        setError(null)

        const records = props.refundDetails.map((record) => ({
            address: record.address,
            amount: record.amount,
        }));

        return sendNativeMultiSend(connectedAddress, denom, records, {
            chunkSize: 1200,
            retries: 3,
            onPreview: setMsgPreview,
            onProgress: (done, total) => setProgress(`Sent ${done}/${total} transactions`),
        });
    }, [connectedAddress, props.refundDetails]);


    const handleSendRefunds = useCallback(async () => {
        setTxLoading(true)
        try {
            setProgress("Send refunds")
            const r = await sendRefunds("inj")
            console.log("done", r)
            setTxLoading(false)
            props.collectWallets()
            props.setShowModal(false)
        } catch (e: any) {
            console.log(e)
            setError(e.message)
            setProgress("")
            setTxLoading(false)
        }
    }, [props, sendRefunds])


    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-hidden focus:outline-hidden text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl min-w-[600px]">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-hidden focus:outline-hidden">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Prepare refund
                            </h3>

                        </div>

                        <div className="relative p-6 flex-auto">
                            <div>
                                <p>
                                    Refunding token: {props.tokenAddress}
                                </p>
                                <p>
                                    Required {props.tokenAddress}: {props.refundDetails.reduce((accumulator, current) => {
                                        return accumulator + current.amount;
                                    }, 0) / Math.pow(10, 18)} {props.tokenAddress}
                                </p>
                                {props.refundDetails !== null && props.refundDetails.length > 0 &&
                                    <div className="mt-5">
                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                            <div>Total wallets to refund: {props.refundDetails.length}</div>
                                            <div className="mt-2">
                                                <table className="table-auto w-full">
                                                    <thead className="text-white">
                                                        <tr>

                                                            <th className="px-4 py-2">
                                                                Address
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Refund
                                                            </th>

                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {props.refundDetails.filter((x) => Number(x.amount) !== 0).map((holder, index) => (
                                                            <tr key={index} className="text-white border-b text-xs">
                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                    <a
                                                                        className="hover:text-indigo-900"
                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                    >
                                                                        {holder.address}
                                                                        {
                                                                            WALLET_LABELS[holder.address] ? (
                                                                                <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                    {WALLET_LABELS[holder.address].label}
                                                                                </span>
                                                                            ) : null
                                                                        }
                                                                    </a>
                                                                </td>
                                                                <td className="px-6 py-1">
                                                                    {(Number(holder.amount) / Math.pow(10, props.decimals)).toFixed(8)}
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
                                    props.refundDetails !== null && props.refundDetails.length == 0 &&
                                    <div
                                        className="my-5 text-lg"
                                    >
                                        No refunds to send
                                    </div>
                                }
                            </div>
                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-rose-600 mt-5">{error}</div>}
                        </div>
                        <div className="pl-6 mb-5">If the refund TX fails, up the gas !</div>

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
                                onClick={handleSendRefunds}
                            >
                                Send Refund
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>

    )
}

export default RefundModal