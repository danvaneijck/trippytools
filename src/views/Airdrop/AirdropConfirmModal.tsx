import {
    MsgExecuteContract,
    MsgExecuteContractCompat,
    MsgMultiSend,
} from "@injectivelabs/sdk-ts";
import { BigNumber, BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import { sendTelegramMessage } from "../../modules/telegram";
import { gql, useMutation } from '@apollo/client';
import moment from "moment";
import { getKeplrOfflineSigner, handleSendTx } from "../../utils/keplr";

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"
const BURN_WALLET_ADDRESS = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

const INSERT_AIRDROP_MUTATION = gql`
mutation insertAirdropLog (
    $time: timestamptz!, 
    $token_dropped_id: String!, 
    $wallet_id: String!, 
    $amount_dropped: float8, 
    $participants: [airdrop_tracker_airdroplog_participants_insert_input!]!, 
    $criteria: String, 
    $description: String, 
    $total_participants: Int!,
    $tx_hashes: String,
    $fee: float8
    ) {
  insert_airdrop_tracker_airdroplog_one(object: {
    time: $time, 
    token_dropped_id: $token_dropped_id, 
    wallet_id: $wallet_id, 
    amount_dropped: $amount_dropped, 
    criteria: $criteria, 
    description: $description, 
    total_participants: $total_participants, 
    participants: {data: $participants},
    tx_hashes: $tx_hashes,
    fee: $fee
    }) {
    id
  }
}
`

const INSERT_WALLETS_MUTATION = gql`
mutation insertWallet($objects: [wallet_tracker_wallet_insert_input!]!) {
  insert_wallet_tracker_wallet(objects: $objects, on_conflict: {constraint:wallet_tracker_wallet_pkey, update_columns: []}){
    returning{
      address
    }
  }
}
`

const INSERT_TOKEN_MUTATION = gql`
mutation insertToken($objects: [token_tracker_token_insert_input!]!) {
  insert_token_tracker_token(objects: $objects, on_conflict: {constraint: token_tracker_token_pkey, update_columns: []}) {
    returning {
      address
    }
  }
}
`

const AirdropConfirmModal = (props: {
    airdropDetails: unknown;
    tokenAddress: string;
    tokenDecimals: number;
    shroomCost: number
    setShowModal: (arg0: boolean) => void;
    criteria: string;
    description: string;
}) => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const navigate = useNavigate();

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

    const [feePayed, setFeePayed] = useState(false)

    const [estimatedTx, setEstimatedTx] = useState(null)
    const [completedTx, setCompletedTx] = useState(0)


    const [insertAirdropLog] = useMutation(INSERT_AIRDROP_MUTATION)
    const [insertWallets] = useMutation(INSERT_WALLETS_MUTATION)
    const [insertTokenDropped] = useMutation(INSERT_TOKEN_MUTATION)

    const sendAirdrops = useCallback(async (denom: any, decimals: number | undefined, airdropDetails: any[]) => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong address")
        }

        const records = airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).map((record: { address: any; amountToAirdrop: any; }) => {
            return {
                address: record.address,
                amount: Number(record.amountToAirdrop).toFixed(props.tokenDecimals)
            }
        });

        const chunkSize = denom.includes("factory") ? 500 : 500;
        const gasPerRecord = denom.includes("factory") ? 40000 : 80000;
        const chunks = [];

        for (let i = 0; i < records.length; i += chunkSize) {
            chunks.push(records.slice(i, i + chunkSize));
        }

        const successfullyProcessed = new Set();

        const transactions = []
        setEstimatedTx(chunks.length)

        for (const chunk of chunks) {
            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    const filteredChunk = chunk.filter(record => !successfullyProcessed.has(record.address));

                    if (filteredChunk.length === 0) {
                        break;
                    }

                    let msg;
                    if (!denom.includes("factory")) {
                        msg = filteredChunk.map((record) => {
                            return MsgExecuteContractCompat.fromJSON({
                                contractAddress: denom,
                                sender: injectiveAddress,
                                msg: {
                                    transfer: {
                                        recipient: record.address,
                                        amount: new BigNumberInBase(record.amount)
                                            .toWei(decimals)
                                            .toFixed()
                                    },
                                },
                            });
                        });
                    } else {
                        const totalChunkToSend = filteredChunk.reduce((acc, record) => {
                            return acc.plus(new BigNumberInBase(record.amount).toWei(decimals));
                        }, new BigNumberInWei(0));

                        msg = MsgMultiSend.fromJSON({
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
                                            amount: new BigNumberInBase(record.amount)
                                                .toWei(decimals)
                                                .toFixed(),
                                            denom,
                                        },
                                    ],
                                };
                            }),
                        });
                    }

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

                    console.log("gas", gas)
                    console.log("msg", msg)

                    const response = await handleSendTx(networkConfig, pubKey, msg, injectiveAddress, offlineSigner, gas);
                    filteredChunk.forEach(record => successfullyProcessed.add(record.address));

                    success = true;
                    transactions.push(response.txHash)
                    setCompletedTx(transactions.length)
                } catch (error) {
                    console.error("Transaction failed, retrying...", error);
                    retries -= 1;
                }
            }

            if (!success) {
                console.error("Failed to send airdrop after multiple retries");
                throw new Error("Failed to send airdrop after multiple retries");
            }
        }
        return transactions
    }, [connectedAddress, props.tokenDecimals, networkConfig]);

    const payFee = useCallback(async () => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const totalAmount = props.shroomCost * Math.pow(10, 18);
        const feeCollectionAmount = (totalAmount * 0.9).toLocaleString('fullwide', { useGrouping: false }); // 90%
        const burnAmount = (totalAmount * 0.1).toLocaleString('fullwide', { useGrouping: false });          // 10%

        const feeMsg = MsgExecuteContract.fromJSON({
            contractAddress: SHROOM_TOKEN_ADDRESS,
            sender: injectiveAddress,
            msg: {
                transfer: {
                    recipient: FEE_COLLECTION_ADDRESS,
                    amount: feeCollectionAmount,
                },
            },
        });

        const burnMsg = MsgExecuteContract.fromJSON({
            contractAddress: SHROOM_TOKEN_ADDRESS,
            sender: injectiveAddress,
            msg: {
                transfer: {
                    recipient: BURN_WALLET_ADDRESS,
                    amount: burnAmount,
                },
            },
        });

        console.log("send shroom fee", feeMsg);
        console.log("send shroom burn", burnMsg);

        return await handleSendTx(networkConfig, pubKey, [feeMsg, burnMsg], injectiveAddress, offlineSigner);
    }, [networkConfig, props.shroomCost]);

    const startAirdrop = useCallback(async () => {
        setError(null)
        if (props.airdropDetails !== null && props.airdropDetails.length > 0) {

            // pay fee
            if (currentNetwork == "mainnet" && props.shroomCost !== 0 && !feePayed) {
                console.log("pay shroom fee")
                setProgress("Pay shroom fee for airdrop")
                const result = await payFee()
                if (result) setFeePayed(true)
            }

            console.log("airdrop")
            setProgress("Send airdrops")
            const txHashes = await sendAirdrops(props.tokenAddress, props.tokenDecimals, props.airdropDetails)
            setProgress("Done...")
            console.log(txHashes)

            if (currentNetwork == "mainnet") await sendTelegramMessage(
                `wallet ${connectedAddress} performed an airdrop on trippyinj!\ntoken dropped: ${props.tokenAddress}\n` +
                `num participants: ${props.airdropDetails ? props.airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).length : "n/a"}\n` +
                `${props.criteria}\n${props.description}`
            )

            if (currentNetwork == "mainnet") {
                try {
                    await insertTokenDropped({
                        variables: {
                            objects: [{ address: props.tokenAddress }]
                        }
                    })

                    await insertWallets({
                        variables: {
                            objects: props.airdropDetails.map(wallet => ({
                                address: wallet.address,
                                burn_address: false
                            }))
                        }
                    })

                    insertAirdropLog({
                        variables: {
                            "time": moment(),
                            "token_dropped_id": props.tokenAddress,
                            "wallet_id": connectedAddress,
                            "amount_dropped": props.airdropDetails.reduce((sum, airdrop) => sum + Number(airdrop.amountToAirdrop), 0),
                            "total_participants": props.airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).length,
                            "participants": props.airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).map((wallet) => {
                                return {
                                    "wallet_id": wallet.address
                                }
                            }),
                            "criteria": props.criteria,
                            "description": props.description,
                            "tx_hashes": txHashes.join(","),
                            "fee": props.shroomCost.toString()
                        }
                    }).then(r => {
                        console.log(r)
                    }).catch(e => {
                        console.log("failed to insert airdrop log", e)
                    })
                }
                catch (e) {
                    console.log(e)
                }
            }

            navigate('/airdrop-history');
        }
    }, [props.airdropDetails, props.shroomCost, props.tokenAddress, props.tokenDecimals, feePayed, currentNetwork, sendAirdrops, connectedAddress, navigate, payFee, insertAirdropLog, props.criteria, props.description, insertWallets, insertTokenDropped])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Airdrop on {currentNetwork}
                            </h3>

                        </div>

                        <div className="relative p-6 flex-auto">
                            <div>
                                <p>
                                    Airdropping token <br />{props.tokenAddress}
                                </p>
                                {props.airdropDetails !== null && props.airdropDetails.length > 0 &&
                                    <div className="mt-5">
                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                            <div>Total participants: {props.airdropDetails.filter(x => x.includeInDrop).length}</div>
                                            <div className="text-xs">You should exclude addresses such as burn addresses, the pair contract etc..</div>
                                            <div className="mt-2">
                                                <table className="table-auto w-full">
                                                    <thead className="text-white">
                                                        <tr>

                                                            <th className="px-4 py-2">
                                                                Address
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Airdrop
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Percentage
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {props.airdropDetails.filter(x => Number(Number(x.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0).map((holder, index) => (
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
                                                                    {Number(holder.amountToAirdrop).toFixed(props.tokenDecimals)}{" "}
                                                                </td>
                                                                <td className="px-6 py-1">
                                                                    {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                }
                            </div>
                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-rose-600 mt-5">{error}</div>}
                        </div>
                        {estimatedTx !== null &&
                            <div className="mx-5 mb-2">
                                <div>
                                    Total number of tx for airdrop: {estimatedTx}
                                </div>
                                <div>
                                    Completed tx: {completedTx}
                                </div>
                            </div>
                        }
                        <div className="mx-5">If the airdrop TX fails, try increasing the gas fee in your wallet. Each tx will retry up to 3 times.</div>
                        {currentNetwork == "mainnet" && (props.airdropDetails.length > 0) && <div className="m-5">
                            Fee for airdrop: {props.shroomCost} shroom <br />
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
                                onClick={() => startAirdrop().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Do Airdrop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>

    )
}

export default AirdropConfirmModal