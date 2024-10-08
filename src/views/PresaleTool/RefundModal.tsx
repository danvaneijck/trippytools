import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import { getKeplr, handleSendTx } from "../../utils/helpers";
import { MsgMultiSend } from "@injectivelabs/sdk-ts";
import { BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { Buffer } from "buffer";

const RefundModal = (props) => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [msgPreview, setMsgPreview] = useState(null)

    const [error, setError] = useState(null)

    const sendRefunds = useCallback(async (denom: any) => {
        const { key, offlineSigner } = await getKeplr(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong wallet address")
        }
        else {
            setError(null)
        }

        const records = props.refundDetails.map((record) => {
            return {
                address: record.address,
                amount: record.amount
            }
        });

        console.log(records)

        const chunkSize = 1200
        const gasPerRecord = 40000
        const chunks = [];

        for (let i = 0; i < records.length; i += chunkSize) {
            chunks.push(records.slice(i, i + chunkSize));
        }

        const successfullyProcessed = new Set();
        const transactions = []

        for (const chunk of chunks) {
            try {
                const filteredChunk = chunk.filter(record => !successfullyProcessed.has(record.address));

                if (filteredChunk.length === 0) {
                    break;
                }

                const totalChunkToSend = filteredChunk.reduce((acc, record) => {
                    return acc.plus(new BigNumberInBase(record.amount));
                }, new BigNumberInWei(0));

                const msg = MsgMultiSend.fromJSON({
                    inputs: [
                        {
                            address: injectiveAddress,
                            coins: [
                                {
                                    denom,
                                    amount: totalChunkToSend.toFixed(),
                                },
                            ],
                        },
                    ],
                    outputs: filteredChunk.map((record: { address: any; amount: BigNumber.Value; }) => {
                        return {
                            address: record.address,
                            coins: [
                                {
                                    amount: new BigNumberInBase(record.amount).toFixed(),
                                    denom,
                                },
                            ],
                        };
                    }),
                });

                let calculatedGas = filteredChunk.length * gasPerRecord;
                if (calculatedGas < 5000000) {
                    calculatedGas = 5000000;
                }

                const gas = {
                    amount: [
                        {
                            denom: "inj",
                            amount: calculatedGas.toString()
                        }
                    ],
                    gas: calculatedGas.toString()
                };

                console.log(msg)
                setMsgPreview(msg)

                const response = await handleSendTx(networkConfig, pubKey, msg, injectiveAddress, offlineSigner, gas);
                filteredChunk.forEach(record => successfullyProcessed.add(record.address));
                transactions.push(response.txHash)

            } catch (error) {
                console.error("Transaction failed, retrying...", error);
            }
        }

        return transactions
    }, [connectedAddress, networkConfig, props.refundDetails]);


    const handleSendRefunds = useCallback(() => {
        sendRefunds("inj").then((r) => {
            console.log("done", r)
            props.collectWallets()
            props.setShowModal(false)
        }).catch(e => {
            console.log(e)
            setError(e.message)
            setProgress("")
            setTxLoading(false)
        })
    }, [props, sendRefunds])


    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl min-w-[600px]">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
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
                                                        {props.refundDetails.filter(x => Number(Number(x.amount).toFixed(props.tokenDecimals)) !== 0).map((holder, index) => (
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
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(false)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
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