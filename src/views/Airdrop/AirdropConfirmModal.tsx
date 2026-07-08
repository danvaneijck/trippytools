import {
    MsgExecuteContractCompat,
    MsgMultiSend,
} from "@injectivelabs/sdk-ts";
import { buildShroomFeeMessages } from "../../utils/shroomFee";
import { BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import { sendTelegramMessage } from "../../modules/telegram";
import { gql, useMutation } from '@apollo/client';
import dayjs from "dayjs";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import { CHUNK_SIZE } from "./distribution";
import { isValidInjAddress } from "./csv";
import { humanReadableAmount } from "./format";

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
    airdropDetails: any;
    tokenAddress: string;
    tokenDecimals: number;
    tokenSymbol?: string;
    shroomCost: number
    setShowModal: (arg0: boolean) => void;
    criteria: string;
    description: string;
}) => {

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork } = useNetworkStore()

    const navigate = useNavigate();

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

    const [feePayed, setFeePayed] = useState(false)

    const [estimatedTx, setEstimatedTx] = useState<number | null>(null)
    const [completedTx, setCompletedTx] = useState(0)


    const [insertAirdropLog] = useMutation(INSERT_AIRDROP_MUTATION)
    const [insertWallets] = useMutation(INSERT_WALLETS_MUTATION)
    const [insertTokenDropped] = useMutation(INSERT_TOKEN_MUTATION)

    // A recipient is actually paid only if it's included AND rounds to a
    // non-zero amount at the token's decimals. (CSV excludes keep their amount,
    // so checking includeInDrop here matters — not just amount > 0.)
    const isPayable = useCallback(
        (record: any) =>
            record.includeInDrop &&
            Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) > 0,
        [props.tokenDecimals],
    );

    const payable = useMemo(
        () => (props.airdropDetails || []).filter(isPayable),
        [props.airdropDetails, isPayable],
    );
    const totalOut = useMemo(
        () => payable.reduce((sum: number, r: any) => sum + Number(Number(r.amountToAirdrop).toFixed(props.tokenDecimals)), 0),
        [payable, props.tokenDecimals],
    );
    const invalidAddressCount = useMemo(
        () => payable.filter((r: any) => !isValidInjAddress(r.address)).length,
        [payable],
    );
    const txCount = Math.ceil(payable.length / CHUNK_SIZE);

    const sendAirdrops = useCallback(async (denom: any, decimals: number | undefined, airdropDetails: any[]) => {

        const injectiveAddress = connectedAddress as string

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong address")
        }

        const records = airdropDetails
            .filter(isPayable)
            .filter((record: { address: string }) => isValidInjAddress(record.address))
            .map((record: { address: any; amountToAirdrop: any; }) => {
                return {
                    address: record.address,
                    amount: Number(record.amountToAirdrop).toFixed(props.tokenDecimals)
                }
            });

        if (records.length === 0) {
            throw new Error("No valid recipients to airdrop to")
        }

        const isNative = (
            denom.includes("factory") ||
            denom.includes("peggy") ||
            denom.includes("ibc") ||
            denom == "inj"
        )

        const chunkSize = CHUNK_SIZE;
        const gasPerRecord = isNative ? 40000 : 80000;
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
                    if (!isNative) {
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

                    const response = await performTransaction(injectiveAddress, msg as any);
                    filteredChunk.forEach(record => successfullyProcessed.add(record.address));

                    success = true;
                    transactions.push(response!.txHash)
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
    }, [connectedAddress, props.tokenDecimals, isPayable]);

    const payFee = useCallback(async () => {
        const injectiveAddress = connectedAddress as string;
        // 90% fee / 10% burn, auto-converting bank SHROOM → CW20 if the wallet's
        // CW20 balance can't cover the fee.
        const messages = await buildShroomFeeMessages(injectiveAddress, props.shroomCost, { burn: true });
        console.log("send shroom fee", messages);
        return await performTransaction(injectiveAddress, messages);
    }, [props.shroomCost, connectedAddress]);

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
                `num participants: ${payable.length}\n` +
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
                            objects: payable.map((wallet: any) => ({
                                address: wallet.address,
                                burn_address: false
                            }))
                        }
                    })

                    insertAirdropLog({
                        variables: {
                            "time": dayjs(),
                            "token_dropped_id": props.tokenAddress,
                            "wallet_id": connectedAddress,
                            "amount_dropped": totalOut,
                            "total_participants": payable.length,
                            "participants": payable.map((wallet: any) => {
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

            void navigate('/airdrop-history');
        }
    }, [props.airdropDetails, props.shroomCost, props.tokenAddress, props.tokenDecimals, feePayed, currentNetwork, sendAirdrops, connectedAddress, navigate, payFee, insertAirdropLog, props.criteria, props.description, insertWallets, insertTokenDropped, payable, totalOut])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-hidden focus:outline-hidden text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-gray-800 outline-hidden focus:outline-hidden">
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

                                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <div className="rounded-md bg-slate-900 p-2">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Recipients</div>
                                        <div className="text-sm font-bold">{payable.length.toLocaleString()}</div>
                                    </div>
                                    <div className="rounded-md bg-slate-900 p-2">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Total out</div>
                                        <div className="text-sm font-bold">{humanReadableAmount(totalOut)} {props.tokenSymbol ?? ""}</div>
                                    </div>
                                    <div className="rounded-md bg-slate-900 p-2">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Transactions</div>
                                        <div className="text-sm font-bold">{txCount}{currentNetwork == "mainnet" ? " + fee" : ""}</div>
                                    </div>
                                </div>
                                {invalidAddressCount > 0 &&
                                    <div className="text-amber-400 text-xs mt-2">
                                        {invalidAddressCount} recipient{invalidAddressCount === 1 ? "" : "s"} with an invalid address will be skipped.
                                    </div>
                                }

                                {props.airdropDetails !== null && props.airdropDetails.length > 0 &&
                                    <div className="mt-5">
                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                            <div>Total participants: {payable.length}</div>
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
                                                        {payable.map((holder: any, index: any) => (
                                                            <tr key={index} className="text-white border-b text-xs">
                                                                <td className="px-6 py-1 whitespace-nowrap">
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
                            Fee for airdrop: {props.shroomCost} shroom (cw20)<br />
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
                                className="bg-gray-600 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded-sm shadow-sm hover:shadow-lg outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => { void startAirdrop().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                }); }}
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