import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import { getKeplrOfflineSigner, handleSendTx } from "../../utils/keplr";
import { Buffer } from "buffer";
import { BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { MsgExecuteContract, MsgMultiSend } from "@injectivelabs/sdk-ts";
import { useNavigate } from 'react-router-dom';
import { humanReadableAmount } from "../../utils/helpers";

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"

const AirdropModal = (props) => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const navigate = useNavigate()

    const [shroomFee] = useState(1000000)
    const [feePayed, setFeePayed] = useState(false)

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)
    const [msgPreview, setMsgPreview] = useState(null)

    const [error, setError] = useState(null)

    const payFee = useCallback(async () => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId, true);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong wallet address")
        }
        else {
            setError(null)
        }

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: SHROOM_TOKEN_ADDRESS,
            sender: injectiveAddress,
            msg: {
                transfer: {
                    recipient: FEE_COLLECTION_ADDRESS,
                    amount: (shroomFee).toFixed(0) + "0".repeat(18),
                },
            },
        });

        console.log("send shroom fee", msg)
        return await handleSendTx(networkConfig, pubKey, msg, injectiveAddress, offlineSigner)
    }, [shroomFee, networkConfig, connectedAddress])

    const sendAirdrops = useCallback(async (denom: any) => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId, true);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong wallet address")
        }
        else {
            setError(null)
        }

        const records = props.airdropDetails.map((record) => {
            return {
                address: record.address,
                amount: record.amount
            }
        });

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
                if (calculatedGas < 500000) {
                    calculatedGas = 500000;
                }

                const fee = (calculatedGas * Number(160000000)) / Math.pow(10, 18)
                const feeFormatted = Math.round(((fee * 1.05) * Math.pow(10, 18))).toString()

                const gas = {
                    amount: [
                        {
                            denom: "inj",
                            amount: feeFormatted
                        }
                    ],
                    gas: calculatedGas
                };

                console.log("gas", gas)
                console.log("msg", msg)

                setMsgPreview(msg)

                const response = await handleSendTx(networkConfig, pubKey, msg, injectiveAddress, offlineSigner, gas);
                filteredChunk.forEach(record => successfullyProcessed.add(record.address));
                transactions.push(response.txHash)

            } catch (error) {
                console.error("Transaction failed, retrying...", error);
            }
        }

        return transactions
    }, [connectedAddress, networkConfig, props.airdropDetails]);

    const handleSendAirdrops = useCallback(async () => {
        if (currentNetwork == "mainnet" && !feePayed) {
            console.log("pay shroom fee")
            setProgress("Pay shroom fee for airdrop")
            const result = await payFee()
            if (result) setFeePayed(true)
        }
        sendAirdrops(props.tokenInfo.denom).then((r) => {
            console.log("done", r)
            navigate(`/token-holders?address=${props.tokenInfo.denom}`);
        }).catch(e => {
            console.log(e)
            setError(e.message)
            setProgress("")
            setTxLoading(false)
        })
    }, [currentNetwork, feePayed, navigate, payFee, props.tokenInfo.denom, sendAirdrops])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
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
                                                        {props.airdropDetails.filter(x => Number(Number(x.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0).map((holder, index) => (
                                                            <tr key={index} className="text-white border-b text-xs">
                                                                <td className="px-4 py-1 whitespace-nowrap">
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
                            Fee for airdrop: {humanReadableAmount(shroomFee)} shroom <br />
                            <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                            <br />
                            <div className="mt-2">Fee payed: {feePayed ? "True" : "False"}</div>
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
                                onClick={() => handleSendAirdrops().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
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