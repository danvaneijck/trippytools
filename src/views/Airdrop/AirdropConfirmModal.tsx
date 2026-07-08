import {
    MsgExecuteContractCompat,
    MsgMultiSend,
} from "@injectivelabs/sdk-ts";
import { buildShroomFeeMessages } from "../../utils/shroomFee";
import { BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { downloadCsv } from "../../utils/csv";
import {
    clearCheckpoint,
    loadCheckpoint,
    markFeePaid,
    planKey,
    recordChunkPaid,
} from "./checkpoint";
import { btnPrimary, btnGhost } from "./components/ui";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Widen the simulated-gas headroom for airdrop chunks. A 500-output multisend
// occasionally lands just over the 1.1x default and fails; 1.3x costs nothing
// extra (gas is charged on use, not on the limit) and removes that failure mode.
const AIRDROP_GAS_BUFFER = 1.3;

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

    const [error, setError] = useState<string | null>(null)

    const [feePayed, setFeePayed] = useState(false)

    const [estimatedTx, setEstimatedTx] = useState<number | null>(null)
    const [completedTx, setCompletedTx] = useState(0)

    // Resume/idempotency state, seeded from the persisted checkpoint (if any).
    const [paidCount, setPaidCount] = useState(0)
    const [failedChunks, setFailedChunks] = useState<number[]>([])

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

    // The exact `{address, amount}` rows that will be sent — the single source of
    // truth for both the send loop and the checkpoint key, so the key always
    // matches what actually goes out.
    const payableRecords = useMemo<{ address: string; amount: string }[]>(
        () =>
            (props.airdropDetails || [])
                .filter(isPayable)
                .filter((r: any) => isValidInjAddress(r.address))
                .map((r: any) => ({
                    address: r.address as string,
                    amount: Number(r.amountToAirdrop).toFixed(props.tokenDecimals),
                })),
        [props.airdropDetails, isPayable, props.tokenDecimals],
    );

    // Stable per-plan checkpoint key (sender + token + sorted address/amount set).
    const checkpointKey = useMemo(
        () =>
            connectedAddress && payableRecords.length > 0
                ? planKey(connectedAddress, props.tokenAddress, payableRecords)
                : null,
        [connectedAddress, props.tokenAddress, payableRecords],
    );

    // Rehydrate resume state from any persisted checkpoint for this exact plan:
    // how many recipients were already paid, and whether the fee was already
    // charged (so a resumed run never double-charges).
    useEffect(() => {
        if (!checkpointKey) {
            setPaidCount(0);
            return;
        }
        const cp = loadCheckpoint(checkpointKey);
        setPaidCount(cp?.paid.length ?? 0);
        setCompletedTx(cp?.txHashes.length ?? 0);
        if (cp?.feePaid) setFeePayed(true);
    }, [checkpointKey]);

    const sendAirdrops = useCallback(async (denom: any, decimals: number | undefined) => {

        const injectiveAddress = connectedAddress as string

        if (injectiveAddress !== connectedAddress) {
            throw new Error("You are connected to the wrong address")
        }

        const records = payableRecords;

        if (records.length === 0) {
            throw new Error("No valid recipients to airdrop to")
        }

        const key = checkpointKey;
        const base = { sender: injectiveAddress, token: props.tokenAddress, total: records.length };

        const isNative = (
            denom.includes("factory") ||
            denom.includes("peggy") ||
            denom.includes("ibc") ||
            denom == "inj"
        )

        const chunkSize = CHUNK_SIZE;
        const chunks: { address: string; amount: string }[][] = [];

        for (let i = 0; i < records.length; i += chunkSize) {
            chunks.push(records.slice(i, i + chunkSize));
        }

        // Resume: seed the already-paid set and landed hashes from the persisted
        // checkpoint so recipients paid on a previous attempt are never paid
        // again — this is what makes a half-finished run continuable.
        const prior = key ? loadCheckpoint(key) : null;
        const successfullyProcessed = new Set<string>(prior?.paid ?? []);
        const transactions: string[] = [...(prior?.txHashes ?? [])];

        setEstimatedTx(chunks.length)
        setCompletedTx(transactions.length)
        setPaidCount(successfullyProcessed.size)

        // Chunks that couldn't be sent after their retries. We record them and
        // keep going instead of aborting the whole run, so one bad chunk no
        // longer strands the other 35.
        const failed: number[] = [];

        for (let ci = 0; ci < chunks.length; ci++) {
            const filteredChunk = chunks[ci].filter(record => !successfullyProcessed.has(record.address));

            if (filteredChunk.length === 0) {
                continue; // every recipient in this chunk was already paid
            }

            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
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

                    const response = await performTransaction(injectiveAddress, msg as any, {
                        gasBufferCoefficient: AIRDROP_GAS_BUFFER,
                    });

                    // Persist progress BEFORE anything else can throw, so a crash
                    // right after broadcast can't lose a landed tx.
                    filteredChunk.forEach(record => successfullyProcessed.add(record.address));
                    transactions.push(response!.txHash)
                    if (key) {
                        recordChunkPaid(key, base, filteredChunk.map(r => r.address), response!.txHash);
                    }
                    setCompletedTx(transactions.length)
                    setPaidCount(successfullyProcessed.size)
                    success = true;
                } catch (error) {
                    console.error(`Chunk ${ci + 1}/${chunks.length} failed, retrying...`, error);
                    retries -= 1;
                    if (retries > 0) {
                        await sleep(1000 * (3 - retries)); // 1s, then 2s backoff
                    }
                }
            }

            if (!success) {
                console.error(`Chunk ${ci + 1}/${chunks.length} failed after retries — continuing`);
                failed.push(ci);
            }
        }

        setFailedChunks(failed)
        return { txHashes: transactions, failed }
    }, [connectedAddress, payableRecords, checkpointKey, props.tokenAddress]);

    const payFee = useCallback(async () => {
        const injectiveAddress = connectedAddress as string;
        // 90% fee / 10% burn, auto-converting bank SHROOM → CW20 if the wallet's
        // CW20 balance can't cover the fee.
        const messages = await buildShroomFeeMessages(injectiveAddress, props.shroomCost, { burn: true });
        console.log("send shroom fee", messages);
        const result = await performTransaction(injectiveAddress, messages);
        // Persist that the fee was charged so a resumed/retried run (even after a
        // page reload) never bills the SHROOM fee a second time.
        if (result && checkpointKey) {
            markFeePaid(checkpointKey, {
                sender: injectiveAddress,
                token: props.tokenAddress,
                total: payableRecords.length,
            });
        }
        return result;
    }, [props.shroomCost, connectedAddress, checkpointKey, props.tokenAddress, payableRecords.length]);

    const startAirdrop = useCallback(async () => {
        setError(null)
        if (props.airdropDetails !== null && props.airdropDetails.length > 0) {
            setTxLoading(true)

            // pay fee
            if (currentNetwork == "mainnet" && props.shroomCost !== 0 && !feePayed) {
                console.log("pay shroom fee")
                setProgress("Pay shroom fee for airdrop")
                const result = await payFee()
                if (result) setFeePayed(true)
            }

            console.log("airdrop")
            setProgress("Send airdrops")
            const { txHashes, failed } = await sendAirdrops(props.tokenAddress, props.tokenDecimals)
            const partial = failed.length > 0
            setProgress(partial ? "" : "Done...")
            setTxLoading(false)
            console.log(txHashes, "failed chunks:", failed)

            // Who actually got paid (from the checkpoint's confirmed set) — so
            // logs and receipts reflect reality even on a partial run.
            const finalCp = checkpointKey ? loadCheckpoint(checkpointKey) : null
            const paidSet = new Set<string>(finalCp?.paid ?? [])
            const paidRecipients = partial
                ? payable.filter((w: any) => paidSet.has(w.address))
                : payable
            const paidOut = partial
                ? paidRecipients.reduce(
                    (s: number, r: any) => s + Number(Number(r.amountToAirdrop).toFixed(props.tokenDecimals)),
                    0,
                )
                : totalOut
            const partialNote = partial
                ? ` [partial: ${paidRecipients.length}/${payable.length} recipients paid, ${failed.length} chunk(s) failed]`
                : ""

            if (currentNetwork == "mainnet") await sendTelegramMessage(
                `wallet ${connectedAddress} performed an airdrop on trippyinj!${partialNote}\ntoken dropped: ${props.tokenAddress}\n` +
                `num participants: ${paidRecipients.length}\n` +
                `${props.criteria}\n${props.description}`
            )

            // Persist a log whenever at least one tx landed, so the hashes are
            // never orphaned — including partial runs.
            if (currentNetwork == "mainnet" && txHashes.length > 0) {
                try {
                    await insertTokenDropped({
                        variables: {
                            objects: [{ address: props.tokenAddress }]
                        }
                    })

                    await insertWallets({
                        variables: {
                            objects: paidRecipients.map((wallet: any) => ({
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
                            "amount_dropped": paidOut,
                            "total_participants": paidRecipients.length,
                            "participants": paidRecipients.map((wallet: any) => {
                                return {
                                    "wallet_id": wallet.address
                                }
                            }),
                            "criteria": props.criteria,
                            "description": (props.description ?? "") + partialNote,
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

            if (partial) {
                // Keep the checkpoint so the user can retry only the failed
                // chunks; surface a clear, actionable message.
                setError(
                    `Sent to ${paidRecipients.length}/${payable.length} recipients. ` +
                    `${failed.length} transaction(s) failed. Your progress is saved — ` +
                    `click "Retry failed" to send only the remaining recipients.`,
                )
                return
            }

            if (checkpointKey) clearCheckpoint(checkpointKey)
            void navigate('/airdrop-history');
        }
    }, [props.airdropDetails, props.shroomCost, props.tokenAddress, props.tokenDecimals, feePayed, currentNetwork, sendAirdrops, connectedAddress, navigate, payFee, insertAirdropLog, props.criteria, props.description, insertWallets, insertTokenDropped, payable, totalOut, checkpointKey])

    // Reconciliation receipt: every intended recipient with its amount and
    // whether it's been paid yet — handy after a partial run.
    const downloadReceipt = useCallback(() => {
        const cp = checkpointKey ? loadCheckpoint(checkpointKey) : null;
        const paidSet = new Set<string>(cp?.paid ?? []);
        const header = "address,amount,status";
        const rows = payableRecords.map(
            (r) => `${r.address},${r.amount},${paidSet.has(r.address) ? "paid" : "pending"}`,
        );
        downloadCsv(
            `airdrop-receipt-${props.tokenSymbol ?? "token"}.csv`,
            [header, ...rows].join("\n"),
        );
    }, [checkpointKey, payableRecords, props.tokenSymbol]);

    const hasProgress = paidCount > 0;
    const remaining = Math.max(0, payable.length - paidCount);
    const actionLabel = failedChunks.length > 0
        ? `Retry failed (${remaining} left)`
        : hasProgress
            ? `Resume airdrop (${remaining} left)`
            : "Do Airdrop";

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto p-4 text-sm text-white outline-hidden focus:outline-hidden"
            >
                <div className="relative mx-auto my-4 w-full max-w-4xl">
                    <div className="relative flex w-full flex-col rounded-2xl border border-white/10 bg-[#04141b] shadow-2xl shadow-black/50 outline-hidden focus:outline-hidden">
                        <div className="flex items-center justify-between rounded-t-2xl border-b border-white/10 p-5">
                            <h3 className="text-lg font-bold">
                                Airdrop on <span className="capitalize text-trippyYellow">{currentNetwork}</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => props.setShowModal(false)}
                                className="text-slate-400 transition hover:text-white"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="relative flex-auto p-5">
                            <div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs">
                                    <span className="text-slate-400">Airdropping token</span>
                                    <div className="mt-0.5 break-all font-mono text-slate-200">{props.tokenAddress}</div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                                    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Recipients</div>
                                        <div className="text-sm font-bold">{payable.length.toLocaleString()}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Total out</div>
                                        <div className="text-sm font-bold">{humanReadableAmount(totalOut)} {props.tokenSymbol ?? ""}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
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
                                        <div className="mb-2 text-xs text-slate-400">
                                            Total participants:{" "}
                                            <span className="font-bold text-white">{payable.length}</span> — exclude burn
                                            addresses, pair contracts etc. on the previous screen.
                                        </div>
                                        <div className="max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-white/10">
                                            <table className="w-full table-auto text-xs">
                                                <thead className="sticky top-0 bg-[#04141b] text-left text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-2">Address</th>
                                                        <th className="px-4 py-2">Airdrop</th>
                                                        <th className="px-4 py-2">%</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {payable.map((holder: any, index: any) => (
                                                        <tr key={index} className="border-b border-white/5 text-white transition hover:bg-white/5">
                                                            <td className="whitespace-nowrap px-4 py-1.5">
                                                                <a
                                                                    className="transition hover:text-trippyYellow"
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
                                                            <td className="whitespace-nowrap px-4 py-1.5 font-medium text-trippyYellow">
                                                                {Number(holder.amountToAirdrop).toFixed(props.tokenDecimals)}{" "}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-slate-400">
                                                                {Number(holder.percentToAirdrop).toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                }
                            </div>
                            {progress && (
                                <div className="mt-5 text-sm text-slate-300">
                                    <span className="text-slate-400">progress:</span> {progress}
                                </div>
                            )}
                            {txLoading && <CircleLoader color="#f9d73f" className="mt-3 m-auto" />}
                            {error && (
                                <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
                                    {error}
                                </div>
                            )}
                        </div>
                        {(estimatedTx !== null || hasProgress) &&
                            <div className="mx-5 mb-2 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                                <div className="flex flex-wrap gap-x-6 gap-y-1">
                                    <div>Recipients paid: <b>{paidCount}</b> / {payable.length}</div>
                                    {estimatedTx !== null &&
                                        <div>Completed tx: <b>{completedTx}</b> / {estimatedTx}</div>
                                    }
                                    {remaining > 0 && <div>Remaining: <b>{remaining}</b></div>}
                                    {failedChunks.length > 0 &&
                                        <div className="text-rose-400">Failed tx: <b>{failedChunks.length}</b></div>
                                    }
                                </div>
                                {hasProgress &&
                                    <div className="mt-2 text-xs text-slate-400">
                                        Progress is saved. If a run stops early, click&nbsp;
                                        <b>{actionLabel}</b>&nbsp;— already-paid recipients are skipped.
                                        <button
                                            type="button"
                                            onClick={downloadReceipt}
                                            className="ml-2 text-trippyYellow underline"
                                        >
                                            Download receipt
                                        </button>
                                    </div>
                                }
                            </div>
                        }
                        <div className="mx-5 text-xs text-slate-400">Each transaction retries up to 3 times with backoff. A failed transaction no longer aborts the whole airdrop — your progress is saved and you can retry the rest.</div>
                        {currentNetwork == "mainnet" && (props.airdropDetails.length > 0) &&
                            <div className="mx-5 mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
                                <span className="text-slate-400">
                                    Fee: {props.shroomCost} SHROOM (cw20){" "}
                                    <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="text-trippyYellow underline">buy here</a>
                                </span>
                                <span className={feePayed ? "font-bold text-emerald-400" : "font-bold text-slate-300"}>
                                    {feePayed ? "Fee paid ✓" : "Fee unpaid"}
                                </span>
                            </div>
                        }
                        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-white/10 p-4">
                            <button
                                className={btnGhost}
                                type="button"
                                onClick={() => props.setShowModal(false)}
                            >
                                Back
                            </button>
                            <button
                                className={btnPrimary}
                                type="button"
                                disabled={txLoading}
                                onClick={() => { void startAirdrop().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                }); }}
                            >
                                {actionLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"></div>
        </>

    )
}

export default AirdropConfirmModal