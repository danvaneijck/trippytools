// The public claim page: /claim/<id>.
//
// This is the page a stranger opens from a link, so it resolves everything from
// the chain and verifies it locally rather than trusting whoever shared the link:
//
//   id → campaign (root, leaves_uri) → published leaves → REBUILD THE TREE and
//   check it hashes to the on-chain root → derive our own proof → dry-run
//   Claimable → Claim.
//
// The root check is the point. A proof is only worth broadcasting if the document
// it came from is the one the contract committed to, and because a one-shot drop
// freezes on its first publish, that commitment can never be edited afterwards.
// If the rebuilt root doesn't match, the page refuses to offer a claim at all
// instead of sending a transaction that can only revert.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { GridLoader } from "react-spinners";
import { PiHandCoinsBold, PiSealCheckFill, PiWarningBold } from "react-icons/pi";

import ConnectWallet from "../../components/App/ConnectKeplr";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore, { type NetworkKey } from "../../store/useNetworkStore";
import useTokenStore from "../../store/useTokenStore";
import { NETWORKS } from "../../utils/constants";
import { performTransaction } from "../../utils/walletStrategy";
import {
    DEFAULT_INSTANCE,
    claimUrl,
    instanceAddress,
    nanosToDate,
    resolveInstance,
    type InstanceKey,
} from "../../utils/claimDrops/config";
import { fetchLeaves } from "../../utils/claimDrops/leavesSource";
import { buildTree, proofFor, verifyProof, type BuiltTree } from "../../utils/claimDrops/merkle";
import { claim as buildClaimMsg } from "../../utils/claimDrops/messages";
import { queryCampaign, queryClaimable, queryClaimed, queryConfig } from "../../utils/claimDrops/queries";
import type { CampaignResponse } from "../../utils/claimDrops/types";
import { btnPrimary, btnSecondary, cardBase } from "../Airdrop/components/ui";
import { shortAddress } from "../Airdrop/format";
import { fromBaseUnits } from "./leaves";
import { dropStatus, entitlement, parseMeta, rootMatch, type DropStatus } from "./claimState";

const OTHER: Record<NetworkKey, NetworkKey> = { mainnet: "testnet", testnet: "mainnet" };

/**
 * Does this campaign id exist on the OTHER network? A claim link carries no
 * network, so the common failure is a good link opened on the wrong one.
 *
 * Must query the other network's own endpoint: asking mainnet about a testnet
 * contract address just returns "not found", which is the same answer as "the
 * drop doesn't exist" and would silently swallow the offer to switch.
 */
async function existsOnOtherNetwork(
    other: NetworkKey,
    instanceKey: InstanceKey,
    id: number,
): Promise<boolean> {
    // The SAME instance on the other network — instances are keyed by role, so
    // "public #3" means the equivalent drop over there. Probing a different
    // instance would answer a question nobody asked.
    const otherContract = instanceAddress(instanceKey, other);
    if (!otherContract) return false;
    return queryCampaign(NETWORKS[other].grpc, otherContract, id)
        .then(() => true)
        .catch(() => false);
}

const statusLabel = (status: DropStatus): string => {
    switch (status.kind) {
        case "live":
            return "Live";
        case "unpublished":
            return "Not published yet";
        case "contract_paused":
            return "Claims paused";
        case "paused":
            return "Paused by the creator";
        case "swept":
            return "Closed — unclaimed funds returned";
        case "expired":
            return `Expired ${status.at.toLocaleDateString()}`;
    }
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-right text-xs text-slate-200">{children}</span>
    </div>
);

const ClaimPage = () => {
    const { id: idParam } = useParams();
    const [search] = useSearchParams();
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey, network, setNetwork } = useNetworkStore();
    const { tokens } = useTokenStore();

    const id = Number(idParam);
    const validId = Number.isInteger(id) && id > 0;

    // `?c=` names the claim-drops instance; absent means the default (every link
    // minted before instances existed). `resolveInstance` is an ALLOWLIST — an
    // address that isn't ours comes back null and the page refuses to render
    // rather than falling back, because anyone can instantiate code 2066 and
    // "?c=<their instance>" would otherwise be a phishing page wearing our
    // chrome, with a genuinely working claim button on it.
    const instanceParam = search.get("c");
    const instanceKey = resolveInstance(networkKey, instanceParam);
    const contract = instanceKey ? instanceAddress(instanceKey, networkKey) : "";

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [camp, setCamp] = useState<CampaignResponse | null>(null);
    const [contractPaused, setContractPaused] = useState(false);
    const [tree, setTree] = useState<BuiltTree | null>(null);
    const [leavesFrom, setLeavesFrom] = useState<"uri" | "hasura" | null>(null);
    const [matched, setMatched] = useState<"root" | "prev_root" | null>(null);
    const [leavesError, setLeavesError] = useState<string | null>(null);
    /** Set when this id exists on the OTHER network — a link opened on the wrong one. */
    const [foundOn, setFoundOn] = useState<NetworkKey | null>(null);

    const [claimed, setClaimed] = useState<string | null>(null);
    const [payable, setPayable] = useState<string | null>(null);
    const [proofOk, setProofOk] = useState<boolean | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [claimError, setClaimError] = useState<string | null>(null);

    // ---------------------------------------------------------------- drop load
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);
            setLeavesError(null);
            setCamp(null);
            setTree(null);
            setMatched(null);
            setFoundOn(null);

            if (!validId) {
                if (!cancelled) {
                    setError(`"${idParam ?? ""}" isn't a campaign id.`);
                    setLoading(false);
                }
                return;
            }
            if (!instanceKey) {
                // Unrecognised `?c=`. Deliberately NOT probed on the other
                // network and NOT retried against the default — the link points
                // at a contract this tool doesn't vouch for, and the only safe
                // answer is to stop.
                if (!cancelled) {
                    setError(
                        "This link points at a claim-drops contract trippytools doesn't recognise. " +
                            "Nothing is shown for unknown contracts — check where the link came from.",
                    );
                    setLoading(false);
                }
                return;
            }
            if (!contract) {
                // Known instance, not deployed on this network — the drop may
                // still be on the other one.
                const other = OTHER[networkKey];
                if (await existsOnOtherNetwork(other, instanceKey, id)) {
                    if (!cancelled) setFoundOn(other);
                }
                if (!cancelled) {
                    setError(`This drop's contract isn't deployed on ${networkKey} yet.`);
                    setLoading(false);
                }
                return;
            }

            try {
                const [campaign, config] = await Promise.all([
                    queryCampaign(network.grpc, contract, id),
                    queryConfig(network.grpc, contract).catch(() => null),
                ]);
                if (cancelled) return;
                setCamp(campaign);
                setContractPaused(config?.paused ?? false);

                if (campaign.campaign.root === null) {
                    setLoading(false);
                    return;
                }

                try {
                    const doc = await fetchLeaves(campaign.campaign.leaves_uri, campaign.campaign.root);
                    if (cancelled) return;
                    const rebuilt = buildTree(doc.leaves);
                    setTree(rebuilt);
                    setLeavesFrom(doc.source);
                    setMatched(rootMatch(rebuilt.rootHex, campaign.campaign));
                } catch (e) {
                    if (!cancelled) setLeavesError((e as Error).message);
                }
            } catch {
                if (cancelled) return;
                // Unknown id on this network — check whether the link belongs elsewhere.
                const other = OTHER[networkKey];
                if (await existsOnOtherNetwork(other, instanceKey, id)) {
                    if (!cancelled) setFoundOn(other);
                }
                if (!cancelled) setError(`No campaign #${id} on ${networkKey}.`);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [id, idParam, validId, contract, instanceKey, networkKey, network.grpc]);

    const meta = useMemo(() => (camp ? parseMeta(camp.campaign.meta) : {}), [camp]);
    const listed = useMemo(
        () => (camp ? tokens.find((t) => t.address === camp.campaign.denom) : undefined),
        [camp, tokens],
    );
    const decimals = meta.decimals ?? listed?.decimals ?? 0;
    const symbol = meta.symbol || listed?.symbol || (camp ? camp.campaign.denom : "");
    const amount = useCallback((base: string) => fromBaseUnits(base, decimals), [decimals]);

    // Drops published by an MCP agent tag themselves `trippy-mcp:<name>` in the
    // on-chain meta. Creator-supplied text, so it is clamped and stripped of
    // anything that isn't an agent name before it goes on the page.
    const agentName = useMemo(() => {
        const raw = meta.createdBy ?? "";
        const m = /^trippy-mcp:([a-z0-9][a-z0-9_-]{2,31})$/.exec(raw.trim());
        return m ? m[1] : null;
    }, [meta.createdBy]);

    // Expiry is compared against a clock held in state, not read during render:
    // reading it in render is impure (react-hooks/purity), and a page left open
    // across an expiry should flip to "expired" on its own rather than keep
    // offering a claim the chain would now reject.
    const [nowMs, setNowMs] = useState(0);
    useEffect(() => {
        setNowMs(Date.now());
        const tick = setInterval(() => setNowMs(Date.now()), 30_000);
        return () => {
            clearInterval(tick);
        };
    }, []);

    const status = useMemo(
        () => (camp && nowMs > 0 ? dropStatus(camp.campaign, nowMs, contractPaused) : null),
        [camp, nowMs, contractPaused],
    );

    const leaf = useMemo(() => {
        if (!tree || !connectedAddress) return null;
        return tree.leaves.find((l) => l.address === connectedAddress) ?? null;
    }, [tree, connectedAddress]);

    const proof = useMemo(
        () => (tree && connectedAddress ? proofFor(tree, connectedAddress) ?? null : null),
        [tree, connectedAddress],
    );

    // ------------------------------------------------------------- wallet load
    const loadWallet = useCallback(async () => {
        if (!camp || !contract || !connectedAddress || !leaf || !proof) {
            setClaimed(null);
            setPayable(null);
            setProofOk(null);
            return;
        }
        // Verify locally before asking the chain: a proof that fails here can
        // never be paid, and saying so needs no network round-trip.
        setProofOk(
            camp.campaign.root !== null &&
                (verifyProof(camp.campaign.root, connectedAddress, leaf.amount, proof) ||
                    (camp.campaign.prev_root !== null &&
                        verifyProof(camp.campaign.prev_root, connectedAddress, leaf.amount, proof))),
        );
        const [already, dry] = await Promise.all([
            queryClaimed(network.grpc, contract, camp.id, connectedAddress).catch(() => null),
            queryClaimable(network.grpc, contract, camp.id, connectedAddress, leaf.amount, proof).catch(
                () => null,
            ),
        ]);
        setClaimed(already?.claimed ?? null);
        setPayable(dry?.payable ?? null);
    }, [camp, contract, connectedAddress, leaf, proof, network.grpc]);

    useEffect(() => {
        void loadWallet();
    }, [loadWallet]);

    const share = useMemo(
        () =>
            camp && typeof window !== "undefined"
                ? claimUrl(window.location.origin, networkKey, instanceKey ?? DEFAULT_INSTANCE, camp.id)
                : "",
        // `camp` is only ever set for a resolved instance, so the ?? is a type
        // guard rather than a real fallback.
        [camp, networkKey, instanceKey],
    );

    const doClaim = useCallback(async () => {
        if (!camp || !contract || !connectedAddress || !leaf || !proof) return;
        setClaiming(true);
        setClaimError(null);
        try {
            const res = await performTransaction(connectedAddress, [
                buildClaimMsg({
                    sender: connectedAddress,
                    contract,
                    id: camp.id,
                    amount: leaf.amount,
                    proof,
                }),
            ]);
            setTxHash((res as { txHash?: string } | undefined)?.txHash ?? null);
            // Re-read from the chain rather than assuming: `claimed` is the number
            // the next claim is measured against.
            await loadWallet();
            const fresh = await queryCampaign(network.grpc, contract, camp.id).catch(() => null);
            if (fresh) setCamp(fresh);
        } catch (e) {
            setClaimError((e as Error).message);
        } finally {
            setClaiming(false);
        }
    }, [camp, contract, connectedAddress, leaf, proof, loadWallet, network.grpc]);

    const ent = useMemo(
        () => (status && claimed !== null ? entitlement(leaf?.amount ?? null, claimed, status) : null),
        [status, claimed, leaf],
    );

    const shell = (children: React.ReactNode) => (
        <div className="flex min-h-screen flex-col bg-customGray">
            <div className="mx-2 grow pt-24 pb-20">
                <div className="mx-auto w-full max-w-xl space-y-4 px-2">{children}</div>
            </div>
            <Footer />
        </div>
    );

    if (loading) {
        return shell(
            <div className="space-y-4 pt-10 text-center">
                <GridLoader color="#f9d73f" className="m-auto" />
                <div className="text-sm text-slate-400">Resolving drop #{idParam} on {networkKey}…</div>
            </div>,
        );
    }

    if (error || !camp) {
        return shell(
            <div className="space-y-4 text-center text-white">
                <PiWarningBold className="mx-auto text-amber-300" size={34} />
                <div className="font-magic text-3xl">Drop not found</div>
                <p className="text-sm text-slate-400">{error}</p>
                {foundOn && (
                    <div className={`${cardBase} space-y-3 text-left`}>
                        <p className="text-sm text-slate-300">
                            Campaign #{id} does exist on{" "}
                            <span className="capitalize text-trippyYellow">{foundOn}</span>. A claim link
                            doesn't carry the network, so switch and this page will load it.
                        </p>
                        <button
                            className={`${btnPrimary} w-full`}
                            onClick={() => {
                                setNetwork(foundOn);
                            }}
                        >
                            Switch to {foundOn}
                        </button>
                    </div>
                )}
                <Link to="/claim-drop">
                    <div className={`${btnSecondary} w-full`}>Create a claim drop</div>
                </Link>
            </div>,
        );
    }

    const c = camp.campaign;
    const pct =
        BigInt(c.total) > 0n ? Number((BigInt(c.claimed_total) * 10000n) / BigInt(c.total)) / 100 : 0;
    const verified = matched !== null;

    return shell(
        <div className="space-y-4">
            <div className="text-center text-white">
                {meta.logo ? (
                    <img
                        src={meta.logo}
                        alt=""
                        className="mx-auto mb-2 size-12 rounded-full object-cover"
                    />
                ) : (
                    <PiHandCoinsBold className="mx-auto mb-2 text-trippyYellow" size={34} />
                )}
                <div className="font-magic text-3xl">{meta.title || `Claim drop #${camp.id}`}</div>
                <div className="mt-1 text-sm text-slate-400">
                    {amount(c.total)} {symbol} to {tree ? tree.leaves.length.toLocaleString() : "—"}{" "}
                    wallet{tree?.leaves.length === 1 ? "" : "s"} on{" "}
                    <span className="capitalize text-trippyYellow">{networkKey}</span>
                </div>
                {meta.description && (
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">{meta.description}</p>
                )}
                {agentName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
                        <span className="rounded bg-trippyYellow/20 px-1.5 py-0.5 font-semibold text-trippyYellow">
                            AGENT
                        </span>
                        created by {agentName}
                    </div>
                )}
            </div>

            {/* The claim box — the only part most visitors care about. */}
            <div className={cardBase}>
                {!connectedAddress ? (
                    <div className="space-y-3 text-center">
                        <p className="text-sm text-slate-300">
                            Connect the wallet you think is in this drop. Nothing is signed until you press
                            claim.
                        </p>
                        <ConnectWallet />
                    </div>
                ) : leavesError ? (
                    <div className="space-y-2 text-sm text-amber-200">
                        <div className="font-bold">This drop's recipient list couldn't be loaded.</div>
                        <p className="text-xs">{leavesError}</p>
                        <p className="text-xs text-slate-400">
                            The funds are safe in the contract — a proof just can't be built without the
                            list. The root is on-chain, so any copy that hashes to it will work.
                        </p>
                    </div>
                ) : !verified ? (
                    <div className="space-y-2 text-sm text-rose-300">
                        <div className="font-bold">The recipient list doesn't match this campaign.</div>
                        <p className="text-xs">
                            The published leaves rebuild to a different merkle root than the one the contract
                            holds, so no proof from them can be paid. Not claiming — a transaction here could
                            only revert.
                        </p>
                    </div>
                ) : ent === null ? (
                    <div className="text-center text-sm text-slate-400">Checking your allocation…</div>
                ) : ent.kind === "not_included" ? (
                    <div className="space-y-1 text-center">
                        <div className="text-sm font-bold text-white">
                            This wallet isn't in this drop
                        </div>
                        <p className="text-xs text-slate-400">
                            {shortAddress(connectedAddress)} has no allocation in campaign #{camp.id}. If you
                            expected one, switch wallets — allocations are fixed to the addresses the creator
                            published.
                        </p>
                    </div>
                ) : ent.kind === "fully_claimed" ? (
                    <div className="space-y-1 text-center">
                        <PiSealCheckFill className="mx-auto text-emerald-400" size={28} />
                        <div className="text-sm font-bold text-white">Already claimed</div>
                        <p className="text-xs text-slate-400">
                            You've taken the full {amount(ent.claimed)} {symbol} from this drop.
                        </p>
                    </div>
                ) : ent.kind === "blocked" ? (
                    <div className="space-y-1 text-center">
                        <div className="text-sm font-bold text-amber-200">
                            {amount(ent.claimable)} {symbol} unclaimed — but this drop isn't paying
                        </div>
                        <p className="text-xs text-slate-400">{statusLabel(ent.status)}.</p>
                    </div>
                ) : (
                    <div className="space-y-3 text-center">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-slate-400">
                                Your allocation
                            </div>
                            <div className="font-magic text-4xl text-trippyYellow">
                                {amount(ent.claimable)}
                            </div>
                            <div className="text-sm text-slate-300">{symbol}</div>
                            {BigInt(ent.claimed) > 0n && (
                                <div className="mt-1 text-xs text-slate-400">
                                    {amount(ent.claimed)} of {amount(ent.allocation)} already claimed
                                </div>
                            )}
                        </div>

                        {proofOk === false && (
                            <p className="text-xs text-rose-300">
                                Your proof doesn't verify against the on-chain root — not claiming.
                            </p>
                        )}
                        {payable !== null && payable !== ent.claimable && (
                            <p className="text-xs text-amber-200">
                                The contract would pay {amount(payable)} {symbol} right now, which differs
                                from your leaf balance. It pays the lower of the two.
                            </p>
                        )}

                        <button
                            className={`${btnPrimary} w-full`}
                            disabled={claiming || proofOk === false || payable === "0"}
                            onClick={() => {
                                void doClaim();
                            }}
                        >
                            {claiming ? "Claiming…" : `Claim ${amount(ent.claimable)} ${symbol}`}
                        </button>
                        <p className="text-xs text-slate-500">
                            You pay the gas for your own claim. The proof is built in your browser.
                        </p>
                    </div>
                )}

                {txHash && (
                    <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-200">
                        Claimed.{" "}
                        <a
                            href={`${network.explorerUrl}/transaction/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                        >
                            View transaction
                        </a>
                    </div>
                )}
                {claimError && (
                    <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                        {claimError}
                    </div>
                )}
            </div>

            {/* Drop facts + the audit trail. */}
            <div className={cardBase}>
                <div className="divide-y divide-white/5">
                    <Row label="status">
                        <span className={status?.kind === "live" ? "text-emerald-300" : "text-amber-200"}>
                            {status ? statusLabel(status) : "—"}
                        </span>
                    </Row>
                    <Row label="claimed so far">
                        {amount(c.claimed_total)} / {amount(c.total)} {symbol} ({pct}%) by{" "}
                        {c.claimants.toLocaleString()} wallet{c.claimants === 1 ? "" : "s"}
                    </Row>
                    <Row label="token">
                        <span className="break-all font-mono">{c.denom}</span>
                    </Row>
                    <Row label="expiry">
                        {c.expiry === null ? (
                            <span className="text-emerald-300">perpetual — never expires</span>
                        ) : (
                            nanosToDate(c.expiry).toLocaleString()
                        )}
                    </Row>
                    <Row label="immutable">
                        {c.frozen ? (
                            <span className="text-emerald-300">
                                frozen — the recipient list can never change
                            </span>
                        ) : (
                            <span className="text-amber-200">not frozen — the creator can republish</span>
                        )}
                    </Row>
                    <Row label="created by">
                        <span className="break-all font-mono">{shortAddress(c.creator)}</span>
                    </Row>
                </div>
            </div>

            <div className={`${cardBase} space-y-2`}>
                <div className="flex items-center gap-2 text-xs">
                    {verified ? (
                        <>
                            <PiSealCheckFill className="shrink-0 text-emerald-400" size={16} />
                            <span className="text-emerald-300">
                                Verified in your browser: the published list rebuilds to the{" "}
                                {matched === "prev_root" ? "previous" : "current"} on-chain root.
                            </span>
                        </>
                    ) : (
                        <>
                            <PiWarningBold className="shrink-0 text-amber-300" size={16} />
                            <span className="text-amber-200">Recipient list not verified.</span>
                        </>
                    )}
                </div>
                <div className="divide-y divide-white/5">
                    <Row label="merkle root">
                        <span className="break-all font-mono">{c.root ?? "not published"}</span>
                    </Row>
                    <Row label="recipient list">
                        {c.leaves_uri ? (
                            <a
                                href={c.leaves_uri}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-trippyYellow underline"
                            >
                                {c.leaves_uri}
                            </a>
                        ) : (
                            "—"
                        )}
                        {leavesFrom === "hasura" && (
                            <span className="ml-1 text-slate-500">(loaded from backup copy)</span>
                        )}
                    </Row>
                    <Row label="contract">
                        <a
                            href={`${network.explorerUrl}/contract/${contract}`}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-trippyYellow underline"
                        >
                            {shortAddress(contract)}
                        </a>
                    </Row>
                </div>
                <p className="text-xs text-slate-500">
                    Anyone can check this drop from the chain alone: read the campaign's root, fetch the
                    list above, and rebuild the tree. This page did exactly that before offering you a
                    claim.
                </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <button
                    className={`${btnSecondary} flex-1`}
                    onClick={() => {
                        void navigator.clipboard.writeText(share);
                    }}
                >
                    Copy claim link
                </button>
                <Link to="/claim-drop" className="flex-1">
                    <div className={`${btnSecondary} w-full`}>Create a claim drop</div>
                </Link>
            </div>
        </div>,
    );
};

export default ClaimPage;
