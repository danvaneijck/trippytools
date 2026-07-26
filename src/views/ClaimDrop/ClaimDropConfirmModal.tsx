import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { CircleLoader } from "react-spinners";
import { useMutation } from "@apollo/client";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import TokenUtils from "../../modules/tokenUtils";
import { performTransaction } from "../../utils/walletStrategy";
import { buildShroomFeeMessages } from "../../utils/shroomFee";
import { sendTelegramMessage } from "../../modules/telegram";
import { createOneShotDrop } from "../../utils/claimDrops/messages";
import { fundingRequired, ceilFee, leavesUriForRoot, nanosToDate } from "../../utils/claimDrops/config";
import { INSERT_CAMPAIGN, UPSERT_LEAVES } from "../../utils/claimDrops/hasura";
import { fetchStoredLeaves } from "../../utils/claimDrops/leavesSource";
import { buildTree, type BuiltTree } from "../../utils/claimDrops/merkle";
import type { DropMeta } from "../../utils/claimDrops/types";
import { queryCampaignsByCreator } from "../../utils/claimDrops/queries";
import { parseCampaignId } from "./campaignId";
import { fromBaseUnits } from "./leaves";
import { humanReadableAmount } from "../Airdrop/format";
import { btnPrimary, btnGhost } from "../Airdrop/components/ui";

export interface ClaimDropNotes {
    invalidRows: number;
    mergedRows: number;
    truncatedRows: number;
    zeroRows: number;
    blockedRows: number;
}

// Remember that the SHROOM fee was already charged for THIS exact drop, so a
// retry after a failed create tx (or a page reload mid-flow) never bills it
// twice. The root is a commitment over the whole allocation, so it — plus the
// sender and the contract — identifies the drop uniquely.
const feeKey = (sender: string, contract: string, root: string) =>
    `trippy.claimdrop.fee.${sender}.${contract}.${root}`;

// localStorage can throw (iOS quota, private mode). A lost flag only costs a
// re-check, never a crash.
const readFeePaid = (key: string): boolean => {
    try {
        return localStorage.getItem(key) === "1";
    } catch {
        return false;
    }
};

const writeFeePaid = (key: string): void => {
    try {
        localStorage.setItem(key, "1");
    } catch (e) {
        console.warn("[claim-drop] could not persist fee flag", e);
    }
};

/**
 * Fallback when the tx response carries no usable events: ask the chain which of
 * this creator's campaigns holds the root we just published. Highest id wins, so
 * re-publishing the same tree resolves to the newest campaign.
 */
async function findCampaignIdByRoot(
    grpc: string,
    contract: string,
    creator: string,
    rootHex: string,
): Promise<number | null> {
    let startAfter: number | undefined;
    let found: number | null = null;
    // `campaigns_by_creator` pages ascending by id, 100 max per page.
    for (let page = 0; page < 25; page++) {
        const batch = await queryCampaignsByCreator(grpc, contract, creator, startAfter, 100);
        if (batch.length === 0) break;
        for (const entry of batch) {
            if (entry.campaign.root?.toLowerCase() === rootHex.toLowerCase()) found = entry.id;
        }
        if (batch.length < 100) break;
        startAfter = batch[batch.length - 1].id;
    }
    return found;
}

/**
 * A row for this root already existed, so our insert was a no-op. Confirm the
 * stored document is really OUR tree before putting its URL on-chain.
 *
 * The table is insert-only and keyed by root, which makes a published row
 * un-rewritable — but it also means whoever inserts a root FIRST owns that key
 * forever, and nothing in the database checks that the leaves hash to it. A
 * drop whose allocation list was published in advance therefore has a
 * predictable root, and a squatted row would leave the campaign frozen around a
 * leaves_uri that serves a list rebuilding to a different root: every claim page
 * would refuse to build a proof. Cheap to check, permanent if missed.
 */
async function storedLeavesMatch(rootHex: string): Promise<boolean> {
    const stored = await fetchStoredLeaves(rootHex);
    if (!stored) return false;
    try {
        return buildTree(stored.leaves).rootHex.toLowerCase() === rootHex.toLowerCase();
    } catch {
        return false;
    }
}

/** How far the wallet is short of the funds this drop needs, in base units. */
const balanceShortfall = (balanceBase: string | null, required: string): bigint | null => {
    if (balanceBase === null) return null;
    try {
        return BigInt(balanceBase) - BigInt(required);
    } catch {
        return null;
    }
};

const StepRow = ({ done, label }: { done: boolean; label: string }) => (
    <div className={`flex items-center gap-2 ${done ? "text-emerald-400" : "text-slate-400"}`}>
        <span>{done ? "✓" : "•"}</span>
        <span>{label}</span>
    </div>
);

const ClaimDropConfirmModal = (props: {
    setShowModal: (show: boolean) => void;
    contract: string;
    denom: string;
    symbol: string;
    decimals: number;
    meta: DropMeta;
    tree: BuiltTree;
    /** The instance's `fee_bps` (Config query) — charged on top of the total. */
    feeBps: number;
    expiryNanos: string | null;
    shroomCost: number;
    /** Wallet balance of `denom` in base units, or null if it couldn't be read. */
    balanceBase: string | null;
    notes: ClaimDropNotes;
}) => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore();

    const [upsertLeaves] = useMutation(UPSERT_LEAVES);
    const [insertCampaign] = useMutation(INSERT_CAMPAIGN);

    const [progress, setProgress] = useState("");
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const key = feeKey(connectedAddress ?? "", props.contract, props.tree.rootHex);
    const [feePaid, setFeePaid] = useState(() => readFeePaid(key));
    const [leavesStored, setLeavesStored] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [campaignId, setCampaignId] = useState<number | null>(null);
    const [recorded, setRecorded] = useState(false);
    const [copied, setCopied] = useState(false);

    const { rootHex, total, leaves } = props.tree;
    const leavesUri = leavesUriForRoot(currentNetwork, rootHex);
    const contractFee = ceilFee(total, props.feeBps);
    const required = fundingRequired(total, props.feeBps);

    const totalWhole = fromBaseUnits(total, props.decimals);
    const requiredWhole = fromBaseUnits(required, props.decimals);

    // Gas is paid in INJ, so a drop *of* INJ that spends the whole balance can't
    // pay for its own tx. Warn rather than block — the user may top up.
    const shortfall = balanceShortfall(props.balanceBase, required);

    const shareUrl = campaignId !== null ? `${window.location.origin}/claim/${campaignId}` : null;

    const payFee = useCallback(async () => {
        const messages = await buildShroomFeeMessages(connectedAddress as string, props.shroomCost, {
            burn: true,
        });
        const result = await performTransaction(connectedAddress as string, messages);
        if (result) writeFeePaid(key);
        return result;
    }, [connectedAddress, props.shroomCost, key]);

    // Record the published campaign in Hasura. Split out so a failure here (the
    // drop is already live on-chain at this point) can be retried on its own.
    const recordCampaign = useCallback(
        async (id: number, hash: string | null) => {
            await insertCampaign({
                variables: {
                    network: currentNetwork,
                    contract: props.contract,
                    campaign_id: id,
                    root: rootHex,
                    denom: props.denom,
                    symbol: props.symbol || null,
                    decimals: props.decimals,
                    meta: props.meta,
                    creator: connectedAddress,
                    tx_hash: hash,
                },
            });
            setRecorded(true);
        },
        [
            insertCampaign,
            currentNetwork,
            props.contract,
            props.denom,
            props.symbol,
            props.decimals,
            props.meta,
            rootHex,
            connectedAddress,
        ],
    );

    const createDrop = useCallback(async () => {
        setError(null);
        if (!connectedAddress) throw new Error("Connect a wallet first");
        if (!props.contract) throw new Error("The claim-drops contract is not deployed on this network");
        if (leaves.length === 0) throw new Error("No recipients to drop to");
        // Hard stop on a second broadcast: the create tx already moved the funds,
        // so re-running it would open (and fund) a duplicate campaign. Anything
        // still missing afterwards is an indexing problem — `resolveId` handles it.
        if (txHash !== null) {
            throw new Error(
                `This drop was already broadcast (tx ${txHash}). Use "Find campaign id" instead — ` +
                    `creating it again would fund a second, duplicate drop.`,
            );
        }

        setTxLoading(true);

        // 1. Publish the leaves BEFORE anything is charged or broadcast. The
        //    create tx writes `leaves_uri` on-chain and (being one-shot) freezes
        //    the root in the same block, so a drop whose leaves never landed
        //    would be immutable and unclaimable — nobody could build a proof.
        //    This is also the only step here that can hard-stop, so it runs
        //    ahead of the fee: no reason to bill someone for a drop we already
        //    know we can't publish. Storing first is harmless if the tx then
        //    fails — the row is content-addressed, so the next attempt reuses it.
        if (!leavesStored) {
            setProgress("Publish leaves");
            try {
                const stored = await upsertLeaves({
                    variables: {
                        root: rootHex,
                        total,
                        leaves,
                        created_by: connectedAddress,
                    },
                });
                // `null` means the insert hit an existing row for this root
                // (ON CONFLICT DO NOTHING) — verify it before trusting it.
                if (!stored.data?.insert_claim_drop_leaves_one && !(await storedLeavesMatch(rootHex))) {
                    throw new Error(
                        "the stored list for this merkle root doesn't rebuild to it — publish under a " +
                            "different allocation set, or host the leaves yourself",
                    );
                }
                setLeavesStored(true);
            } catch (e) {
                setTxLoading(false);
                setProgress("");
                throw new Error(
                    `Could not publish the leaves file (${(e as Error).message}). Nothing was broadcast — ` +
                        `a drop created without it would be frozen with a leaves_uri nobody can read.`,
                    { cause: e },
                );
            }
        }

        // 2. SHROOM fee (mainnet only, once per drop).
        if (currentNetwork === "mainnet" && props.shroomCost > 0 && !feePaid) {
            // Never bill for a drop the chain is going to refuse. The usual
            // create failure is simply not holding the funds, and the usual fix
            // is editing amounts — which changes the root, and a new root is a
            // new fee. Re-read the balance rather than trusting the one loaded
            // with the token, so a top-up made since then counts.
            const fresh = await new TokenUtils(networkConfig)
                .getBalanceOfToken(props.denom, connectedAddress)
                .catch(() => null);
            const short = balanceShortfall(
                fresh?.amount ?? props.balanceBase,
                fundingRequired(total, props.feeBps),
            );
            if (short !== null && short < 0n) {
                setTxLoading(false);
                setProgress("");
                throw new Error(
                    `Not enough ${props.symbol || props.denom} to fund this drop — short by ` +
                        `${fromBaseUnits((-short).toString(), props.decimals)}. Nothing was charged.`,
                );
            }

            setProgress("Pay SHROOM fee");
            const result = await payFee();
            if (result) setFeePaid(true);
        }

        // 3. One tx: create + fund + auto-freeze (one-shot ⇒ streaming: false).
        setProgress("Create + fund drop");
        const msg = createOneShotDrop({
            sender: connectedAddress,
            contract: props.contract,
            denom: props.denom,
            meta: JSON.stringify(props.meta),
            rootHex,
            total,
            leavesUri: leavesUri,
            feeBps: props.feeBps,
            expiryNanos: props.expiryNanos,
        });
        const response = await performTransaction(connectedAddress, [msg]);
        const hash = response?.txHash ?? null;
        setTxHash(hash);

        // 4. Resolve the campaign id, then index it for the claim/manage pages.
        setProgress("Record drop");
        let id = parseCampaignId(response);
        if (id === null) {
            id = await findCampaignIdByRoot(
                networkConfig.grpc,
                props.contract,
                connectedAddress,
                rootHex,
            ).catch(() => null);
        }
        setCampaignId(id);

        if (id !== null) {
            try {
                await recordCampaign(id, hash);
            } catch (e) {
                console.error("failed to index claim drop campaign", e);
                setError(
                    `The drop is live (campaign #${id}) but indexing it failed: ${(e as Error).message}. ` +
                        `Claim links still work — use "Retry indexing" so it shows up in your drops list.`,
                );
            }
        } else {
            setError(
                'The drop was created but its campaign id couldn\'t be read from the transaction. Try ' +
                    '"Find campaign id" — the contract still knows which campaign holds this root.',
            );
        }

        if (currentNetwork === "mainnet") {
            await sendTelegramMessage(
                `wallet ${connectedAddress} created a claim drop on trippyinj!\n` +
                    `campaign: #${id ?? "?"} (${props.contract})\n` +
                    `token: ${props.symbol || props.denom}\n` +
                    `recipients: ${leaves.length}\ntotal: ${totalWhole}\n` +
                    `${props.meta.title}`,
            ).catch(() => undefined);
        }

        setProgress("Done...");
        setTxLoading(false);
    }, [
        connectedAddress,
        currentNetwork,
        feePaid,
        leaves,
        leavesStored,
        leavesUri,
        networkConfig,
        payFee,
        props.balanceBase,
        props.contract,
        props.decimals,
        props.denom,
        props.expiryNanos,
        props.feeBps,
        props.meta,
        props.shroomCost,
        props.symbol,
        recordCampaign,
        rootHex,
        total,
        totalWhole,
        txHash,
        upsertLeaves,
    ]);

    const retryIndexing = useCallback(() => {
        if (campaignId === null) return;
        setError(null);
        recordCampaign(campaignId, txHash).catch((e: Error) => setError(e.message));
    }, [campaignId, recordCampaign, txHash]);

    /**
     * The drop landed but we never got its id: ask the contract which campaign
     * holds this root, then index it. Never broadcasts anything.
     */
    const resolveId = useCallback(() => {
        if (!connectedAddress || !props.contract) return;
        setError(null);
        setProgress("Find campaign id");
        findCampaignIdByRoot(networkConfig.grpc, props.contract, connectedAddress, rootHex)
            .then(async (id) => {
                if (id === null) {
                    setError(
                        "No campaign on this contract holds that root yet. If the tx just landed, give it a " +
                            "block and try again.",
                    );
                    return;
                }
                setCampaignId(id);
                await recordCampaign(id, txHash);
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setProgress(""));
    }, [connectedAddress, networkConfig.grpc, props.contract, recordCampaign, rootHex, txHash]);

    const copyShareUrl = useCallback(() => {
        if (!shareUrl) return;
        void navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [shareUrl]);

    const done = campaignId !== null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto p-4 text-sm text-white outline-hidden focus:outline-hidden">
                <div className="relative mx-auto my-4 w-full max-w-4xl">
                    <div className="relative flex w-full flex-col rounded-2xl border border-white/10 bg-[#04141b] shadow-2xl shadow-black/50">
                        <div className="flex items-center justify-between rounded-t-2xl border-b border-white/10 p-5">
                            <h3 className="text-lg font-bold">
                                Create claim drop on{" "}
                                <span className="capitalize text-trippyYellow">{currentNetwork}</span>
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
                            <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs">
                                <span className="text-slate-400">Dropping</span>
                                <div className="mt-0.5 break-all font-mono text-slate-200">
                                    {props.symbol ? `${props.symbol} — ` : ""}
                                    {props.denom}
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Recipients
                                    </div>
                                    <div className="text-sm font-bold">{leaves.length.toLocaleString()}</div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Total claimable
                                    </div>
                                    <div className="text-sm font-bold">
                                        {humanReadableAmount(totalWhole)} {props.symbol}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                        You send
                                    </div>
                                    <div className="text-sm font-bold">
                                        {humanReadableAmount(requiredWhole)} {props.symbol}
                                    </div>
                                    {contractFee !== "0" && (
                                        <div className="text-[11px] text-slate-400">
                                            incl. {fromBaseUnits(contractFee, props.decimals)} contract fee (
                                            {props.feeBps} bps)
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                        Transactions
                                    </div>
                                    <div className="text-sm font-bold">
                                        1{currentNetwork === "mainnet" ? " + fee" : ""}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 space-y-1.5 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs">
                                <div className="flex flex-wrap gap-x-2">
                                    <span className="text-slate-400">merkle root</span>
                                    <span className="break-all font-mono text-slate-200">{rootHex}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-2">
                                    <span className="text-slate-400">leaves</span>
                                    <a
                                        href={leavesUri}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="break-all font-mono text-trippyYellow underline"
                                    >
                                        {leavesUri}
                                    </a>
                                </div>
                                <div className="flex flex-wrap gap-x-2">
                                    <span className="text-slate-400">expiry</span>
                                    <span className="text-slate-200">
                                        {props.expiryNanos
                                            ? `${nanosToDate(props.expiryNanos).toUTCString()} — unclaimed funds can be clawed back after this`
                                            : "perpetual — claimable forever, no clawback (auto-frozen)"}
                                    </span>
                                </div>
                            </div>

                            {(props.notes.invalidRows > 0 ||
                                props.notes.mergedRows > 0 ||
                                props.notes.truncatedRows > 0 ||
                                props.notes.zeroRows > 0 ||
                                props.notes.blockedRows > 0) && (
                                <div className="mt-3 space-y-1 text-xs text-amber-400">
                                    {props.notes.invalidRows > 0 && (
                                        <div>
                                            {props.notes.invalidRows} CSV row(s) had an invalid address or amount
                                            and are excluded.
                                        </div>
                                    )}
                                    {props.notes.mergedRows > 0 && (
                                        <div>
                                            {props.notes.mergedRows} duplicate row(s) were merged — a repeated
                                            address gets one leaf with the summed allocation.
                                        </div>
                                    )}
                                    {props.notes.truncatedRows > 0 && (
                                        <div>
                                            {props.notes.truncatedRows} amount(s) carried more precision than{" "}
                                            {props.decimals} decimals and were rounded down.
                                        </div>
                                    )}
                                    {props.notes.zeroRows > 0 && (
                                        <div>
                                            {props.notes.zeroRows} allocation(s) rounded to 0 and were dropped.
                                        </div>
                                    )}
                                    {props.notes.blockedRows > 0 && (
                                        <div>
                                            {props.notes.blockedRows} bank-blocked module account(s) excluded —
                                            they hold no keys and could never claim.
                                        </div>
                                    )}
                                </div>
                            )}

                            {shortfall !== null && shortfall < 0n && (
                                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                                    Your balance is short by{" "}
                                    {fromBaseUnits((-shortfall).toString(), props.decimals)} {props.symbol}.
                                </div>
                            )}
                            {props.denom === "inj" && shortfall !== null && shortfall >= 0n && (
                                <div className="mt-3 text-xs text-amber-400">
                                    Dropping INJ: leave some spare for gas — this tx is paid out of the same
                                    balance.
                                </div>
                            )}

                            <div className="mt-4 max-h-72 overflow-x-auto overflow-y-auto rounded-xl border border-white/10">
                                <table className="w-full table-auto text-xs">
                                    <thead className="sticky top-0 bg-[#04141b] text-left text-slate-400">
                                        <tr>
                                            <th className="px-4 py-2">Address</th>
                                            <th className="px-4 py-2">Claimable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaves.map((leaf) => (
                                            <tr
                                                key={leaf.address}
                                                className="border-b border-white/5 transition hover:bg-white/5"
                                            >
                                                <td className="whitespace-nowrap px-4 py-1.5 font-mono">
                                                    {leaf.address}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-1.5 font-medium text-trippyYellow">
                                                    {fromBaseUnits(leaf.amount, props.decimals)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs">
                                <StepRow done={leavesStored} label="Publish leaves file" />
                                {currentNetwork === "mainnet" && props.shroomCost > 0 && (
                                    <StepRow done={feePaid} label={`Pay ${props.shroomCost} SHROOM fee`} />
                                )}
                                <StepRow done={txHash !== null} label="Create + fund drop (1 tx, auto-frozen)" />
                                <StepRow done={recorded} label="Index campaign" />
                            </div>

                            {progress && (
                                <div className="mt-4 text-sm text-slate-300">
                                    <span className="text-slate-400">progress:</span> {progress}
                                </div>
                            )}
                            {txLoading && <CircleLoader color="#f9d73f" className="mt-3 m-auto" />}

                            {error && (
                                <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
                                    {error}
                                    {campaignId !== null && !recorded && (
                                        <button type="button" onClick={retryIndexing} className={`${btnGhost} ml-2`}>
                                            Retry indexing
                                        </button>
                                    )}
                                </div>
                            )}

                            {done && (
                                <div className="mt-4 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                                    <div className="text-base font-bold text-emerald-300">
                                        Claim drop #{campaignId} is live
                                    </div>
                                    <div className="text-xs text-slate-300">
                                        Recipients claim their own allocation — nothing is pushed, so an
                                        unclaimed drop costs you no further gas.
                                    </div>
                                    {shareUrl && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <code className="break-all rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1 font-mono text-xs text-trippyYellow">
                                                {shareUrl}
                                            </code>
                                            <button type="button" onClick={copyShareUrl} className={btnGhost}>
                                                {copied ? "Copied ✓" : "Copy claim link"}
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-3 text-xs">
                                        {txHash && (
                                            <a
                                                href={`${networkConfig.explorerUrl}/transaction/${txHash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-trippyYellow underline"
                                            >
                                                View transaction
                                            </a>
                                        )}
                                        <Link to={`/claim/${campaignId}`} className="text-trippyYellow underline">
                                            Open claim page
                                        </Link>
                                        <Link to="/claim-drop/manage" className="text-trippyYellow underline">
                                            Manage drops
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        {currentNetwork === "mainnet" && props.shroomCost > 0 && (
                            <div className="mx-5 mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
                                <span className="text-slate-400">
                                    Fee: {props.shroomCost} SHROOM (cw20){" "}
                                    <a
                                        href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                                        className="text-trippyYellow underline"
                                    >
                                        buy here
                                    </a>
                                </span>
                                <span
                                    className={
                                        feePaid ? "font-bold text-emerald-400" : "font-bold text-slate-300"
                                    }
                                >
                                    {feePaid ? "Fee paid ✓" : "Fee unpaid"}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-white/10 p-4">
                            <button className={btnGhost} type="button" onClick={() => props.setShowModal(false)}>
                                {done ? "Close" : "Back"}
                            </button>
                            {!done &&
                                (txHash === null ? (
                                    <button
                                        className={btnPrimary}
                                        type="button"
                                        disabled={txLoading}
                                        onClick={() => {
                                            createDrop().catch((e: Error) => {
                                                console.error(e);
                                                setError(e.message);
                                                setProgress("");
                                                setTxLoading(false);
                                            });
                                        }}
                                    >
                                        Create &amp; fund drop
                                    </button>
                                ) : (
                                    // The funds are already committed on-chain — the
                                    // only thing left to retry is the lookup.
                                    <button className={btnPrimary} type="button" onClick={resolveId}>
                                        Find campaign id
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"></div>
        </>
    );
};

export default ClaimDropConfirmModal;
