// The creator's view: /claim-drop/manage.
//
// Reads the wallet's campaigns straight from the contract (CampaignsByCreator),
// not from our index — a drop is live whether or not Hasura ever heard about it,
// and this is the page someone opens when something looks wrong.
//
// Three of the actions here cannot be undone (freeze, clawback, and winding a
// perpetual drop down to an expiry), so every button carries the contract's own
// rule: unavailable ones are disabled WITH the reason, and the irreversible ones
// arm before they fire. See manageRules.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GridLoader } from "react-spinners";
import { PiHandCoinsBold, PiLockKeyFill, PiWarningBold } from "react-icons/pi";

import ConnectWallet from "../../components/App/ConnectKeplr";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore, { type NetworkKey } from "../../store/useNetworkStore";
import useTokenStore from "../../store/useTokenStore";
import { performTransaction } from "../../utils/walletStrategy";
import {
    claimUrl,
    listInstances,
    secondsToNanos,
    type InstanceKey,
} from "../../utils/claimDrops/config";
import {
    clawback as buildClawback,
    freeze as buildFreeze,
    setCampaignPaused as buildSetPaused,
    setExpiry as buildSetExpiry,
    updateMeta as buildUpdateMeta,
} from "../../utils/claimDrops/messages";
import { fetchAllClaims, queryCampaign, queryCampaignsByCreator } from "../../utils/claimDrops/queries";
import type { CampaignResponse } from "../../utils/claimDrops/types";
import { arrayToCsv, downloadCsv } from "../../utils/csv";
import { btnGhost, btnPrimary, btnSecondary, cardBase, inputBase } from "../Airdrop/components/ui";
import { shortAddress } from "../Airdrop/format";
import { fromBaseUnits } from "./leaves";
import { dropStatus, parseMeta } from "./claimState";
import { dateInputValue, endOfDayMs, expiryMs, manageActions } from "./manageRules";

/** Disabled buttons explain themselves rather than just going grey. */
const Action = ({
    label,
    availability,
    danger,
    busy,
    onRun,
}: {
    label: string;
    availability: { enabled: boolean; reason?: string };
    danger?: boolean;
    busy?: boolean;
    onRun: () => void;
}) => {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (!armed) return;
        const t = setTimeout(() => setArmed(false), 6000);
        return () => {
            clearTimeout(t);
        };
    }, [armed]);

    return (
        <div className="space-y-1">
            <button
                className={`${danger && armed ? btnPrimary : btnSecondary} w-full`}
                disabled={!availability.enabled || busy}
                onClick={() => {
                    if (!danger) {
                        onRun();
                        return;
                    }
                    if (armed) {
                        setArmed(false);
                        onRun();
                    } else {
                        setArmed(true);
                    }
                }}
            >
                {busy ? "Signing…" : armed ? `${label} — can't be undone. Confirm?` : label}
            </button>
            {availability.reason && <p className="text-xs text-slate-500">{availability.reason}</p>}
        </div>
    );
};

const DropCard = ({
    entry,
    contract,
    instanceKey,
    instanceLabel,
    networkKey,
    grpc,
    explorerUrl,
    creator,
    nowMs,
    onChanged,
}: {
    entry: CampaignResponse;
    contract: string;
    instanceKey: InstanceKey;
    /** Shown as a badge only when more than one instance is deployed. */
    instanceLabel: string | null;
    networkKey: NetworkKey;
    grpc: string;
    explorerUrl: string;
    creator: string;
    nowMs: number;
    onChanged: (instanceKey: InstanceKey, fresh: CampaignResponse) => void;
}) => {
    const { tokens } = useTokenStore();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [expiryDate, setExpiryDate] = useState("");
    const [newUri, setNewUri] = useState("");
    const [claims, setClaims] = useState<{ address: string; claimed: string }[] | null>(null);
    const [loadingClaims, setLoadingClaims] = useState(false);
    const [open, setOpen] = useState(false);

    const c = entry.campaign;
    const meta = useMemo(() => parseMeta(c.meta), [c.meta]);
    const listed = tokens.find((t) => t.address === c.denom);
    const decimals = meta.decimals ?? listed?.decimals ?? 0;
    const symbol = meta.symbol || listed?.symbol || c.denom;
    const amount = useCallback((b: string) => fromBaseUnits(b, decimals), [decimals]);

    // Router path (no origin) for the in-app link; `claimUrl` builds the absolute
    // one for the clipboard. Both go through the same helper so the `?c=` rule
    // can't drift between them.
    const claimPath = useMemo(
        () => claimUrl("", networkKey, instanceKey, entry.id),
        [networkKey, instanceKey, entry.id],
    );

    const status = dropStatus(c, nowMs);
    const actions = manageActions(c, entry.remaining, nowMs, creator === c.creator);
    const pct =
        BigInt(c.total) > 0n ? Number((BigInt(c.claimed_total) * 10000n) / BigInt(c.total)) / 100 : 0;

    const run = useCallback(
        async (key: string, build: () => ReturnType<typeof buildFreeze>) => {
            setBusy(key);
            setError(null);
            setTxHash(null);
            try {
                const res = await performTransaction(creator, [build()]);
                setTxHash((res as { txHash?: string } | undefined)?.txHash ?? null);
                const fresh = await queryCampaign(grpc, contract, entry.id);
                onChanged(instanceKey, fresh);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setBusy(null);
            }
        },
        [creator, grpc, contract, instanceKey, entry.id, onChanged],
    );

    const loadClaims = useCallback(async () => {
        setLoadingClaims(true);
        try {
            setClaims(await fetchAllClaims(grpc, contract, entry.id));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoadingClaims(false);
        }
    }, [grpc, contract, entry.id]);

    const earliest = actions.setExpiry.earliestMs;

    return (
        <div className={`${cardBase} space-y-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-magic text-lg text-white">
                            {meta.title || `Drop #${entry.id}`}
                        </span>
                        {c.frozen && <PiLockKeyFill className="text-emerald-400" title="frozen" />}
                        {/* Which contract holds this drop. Campaign ids restart
                            at 1 per instance, so "#1" is ambiguous without it. */}
                        {instanceLabel && (
                            <span className="rounded-full border border-slate-600 px-2 py-0.5 text-2xs text-slate-300">
                                {instanceLabel}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-400">
                        #{entry.id} · {amount(c.total)} {symbol} ·{" "}
                        <span className={status.kind === "live" ? "text-emerald-300" : "text-amber-200"}>
                            {status.kind === "expired" ? "expired" : status.kind.replace("_", " ")}
                        </span>
                    </div>
                </div>
                <button className={btnGhost} onClick={() => setOpen((v) => !v)}>
                    {open ? "Hide" : "Manage"}
                </button>
            </div>

            <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-trippyYellow"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>
                        {amount(c.claimed_total)} claimed by {c.claimants.toLocaleString()} wallet
                        {c.claimants === 1 ? "" : "s"}
                    </span>
                    <span>{amount(entry.remaining)} left</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Link to={claimPath} className="flex-1">
                    <div className={`${btnGhost} w-full`}>Open claim page</div>
                </Link>
                <button
                    className={`${btnGhost} flex-1`}
                    onClick={() => {
                        void navigator.clipboard.writeText(
                            claimUrl(
                                typeof window === "undefined" ? "" : window.location.origin,
                                networkKey,
                                instanceKey,
                                entry.id,
                            ),
                        );
                    }}
                >
                    Copy claim link
                </button>
            </div>

            {open && (
                <div className="space-y-4 border-t border-white/10 pt-3">
                    <div className="space-y-1 text-xs text-slate-400">
                        <div>
                            token <span className="break-all font-mono text-slate-300">{c.denom}</span>
                        </div>
                        <div>
                            expiry{" "}
                            <span className="text-slate-300">
                                {c.expiry === null
                                    ? "perpetual"
                                    : new Date(expiryMs(c) as number).toLocaleString()}
                            </span>
                        </div>
                        <div>
                            list{" "}
                            <a
                                href={c.leaves_uri}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-trippyYellow underline"
                            >
                                {c.leaves_uri || "—"}
                            </a>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Action
                            label="Freeze the recipient list"
                            availability={actions.freeze}
                            danger
                            busy={busy === "freeze"}
                            onRun={() => {
                                void run("freeze", () =>
                                    buildFreeze({ sender: creator, contract, id: entry.id }),
                                );
                            }}
                        />
                        <Action
                            label={c.paused ? "Resume claims" : "Pause claims"}
                            availability={actions.pause}
                            busy={busy === "pause"}
                            onRun={() => {
                                void run("pause", () =>
                                    buildSetPaused({
                                        sender: creator,
                                        contract,
                                        id: entry.id,
                                        paused: !c.paused,
                                    }),
                                );
                            }}
                        />
                    </div>

                    {/* Expiry */}
                    <div className="space-y-1.5">
                        <div className="text-xs font-bold text-white">
                            {c.expiry === null ? "Wind down (set an expiry)" : "Extend the expiry"}
                        </div>
                        {actions.setExpiry.enabled && earliest !== null ? (
                            <>
                                <input
                                    type="date"
                                    className={inputBase}
                                    min={dateInputValue(earliest)}
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                />
                                <p className="text-xs text-slate-500">
                                    {c.expiry === null
                                        ? "Perpetual → dated needs at least 7 days' notice, and can never be reversed or shortened."
                                        : "An announced deadline can only ever move later."}{" "}
                                    Earliest: {dateInputValue(earliest)}.
                                </p>
                                <Action
                                    label="Set expiry"
                                    availability={{
                                        enabled:
                                            expiryDate !== "" && endOfDayMs(expiryDate) >= earliest,
                                        ...(expiryDate === ""
                                            ? { reason: "Pick a date." }
                                            : endOfDayMs(expiryDate) < earliest
                                              ? { reason: `Too early — the contract would reject it.` }
                                              : {}),
                                    }}
                                    danger={c.expiry === null}
                                    busy={busy === "expiry"}
                                    onRun={() => {
                                        void run("expiry", () =>
                                            buildSetExpiry({
                                                sender: creator,
                                                contract,
                                                id: entry.id,
                                                expiryNanos: secondsToNanos(
                                                    Math.floor(endOfDayMs(expiryDate) / 1000),
                                                ),
                                            }),
                                        );
                                    }}
                                />
                            </>
                        ) : (
                            <p className="text-xs text-slate-500">{actions.setExpiry.reason}</p>
                        )}
                    </div>

                    {/* Clawback */}
                    <div className="space-y-1.5">
                        <div className="text-xs font-bold text-white">Claw back what's unclaimed</div>
                        <Action
                            label={`Return ${amount(actions.clawback.amount)} ${symbol} to me`}
                            availability={actions.clawback}
                            danger
                            busy={busy === "clawback"}
                            onRun={() => {
                                void run("clawback", () =>
                                    buildClawback({ sender: creator, contract, id: entry.id }),
                                );
                            }}
                        />
                    </div>

                    {/* leaves_uri repair */}
                    <div className="space-y-1.5">
                        <div className="text-xs font-bold text-white">Re-point the recipient list</div>
                        <p className="text-xs text-slate-500">
                            For when the published list stops resolving. The root is the commitment, so
                            this can only fix a dead link — it can never change who gets what.
                        </p>
                        <input
                            className={inputBase}
                            placeholder={c.leaves_uri || "https://…/<root>.json"}
                            value={newUri}
                            onChange={(e) => setNewUri(e.target.value)}
                        />
                        <Action
                            label="Update the list URL"
                            availability={{
                                enabled: actions.updateLeavesUri.enabled && /^https?:\/\//.test(newUri),
                                ...(actions.updateLeavesUri.reason
                                    ? { reason: actions.updateLeavesUri.reason }
                                    : !/^https?:\/\//.test(newUri)
                                      ? { reason: "Needs to be an http(s) URL." }
                                      : {}),
                            }}
                            busy={busy === "uri"}
                            onRun={() => {
                                void run("uri", () =>
                                    buildUpdateMeta({
                                        sender: creator,
                                        contract,
                                        id: entry.id,
                                        leavesUri: newUri,
                                    }),
                                );
                            }}
                        />
                    </div>

                    {/* Claimants */}
                    <div className="space-y-2 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-white">
                                Who has claimed ({c.claimants.toLocaleString()})
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className={btnGhost}
                                    disabled={loadingClaims}
                                    onClick={() => {
                                        void loadClaims();
                                    }}
                                >
                                    {loadingClaims ? "Loading…" : claims ? "Refresh" : "Load"}
                                </button>
                                {claims && claims.length > 0 && (
                                    <button
                                        className={btnGhost}
                                        onClick={() => {
                                            downloadCsv(
                                                `claim-drop-${entry.id}-claimants.csv`,
                                                arrayToCsv(
                                                    claims.map((x) => ({
                                                        address: x.address,
                                                        claimed: amount(x.claimed),
                                                        claimed_base_units: x.claimed,
                                                    })),
                                                    ["address", "claimed", "claimed_base_units"],
                                                ),
                                            );
                                        }}
                                    >
                                        CSV
                                    </button>
                                )}
                            </div>
                        </div>
                        {claims && (
                            <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10">
                                {claims.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-500">
                                        Nobody has claimed yet.
                                    </div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {claims.map((x) => (
                                                <tr key={x.address} className="border-b border-white/5">
                                                    <td className="p-2 font-mono text-slate-300">
                                                        {shortAddress(x.address)}
                                                    </td>
                                                    <td className="p-2 text-right text-slate-200">
                                                        {amount(x.claimed)} {symbol}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    {txHash && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                            Done.{" "}
                            <a
                                href={`${explorerUrl}/transaction/${txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                            >
                                View transaction
                            </a>
                        </div>
                    )}
                    {error && (
                        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                            {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/** One of the wallet's campaigns, tagged with the instance that holds it. */
interface OwnedDrop {
    instanceKey: InstanceKey;
    instanceLabel: string;
    contract: string;
    entry: CampaignResponse;
}

const ManageDrops = () => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey, network } = useNetworkStore();
    // Every deployed instance, not a picked one: campaign ids restart at 1 per
    // instance, so a wallet with drops on two of them would otherwise see half
    // its drops and no hint the rest existed.
    const instances = useMemo(() => listInstances(networkKey), [networkKey]);

    const [campaigns, setCampaigns] = useState<OwnedDrop[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clock in state, not read during render (react-hooks/purity), and ticking so
    // an expiry passing while the page is open unlocks Clawback on its own.
    const [nowMs, setNowMs] = useState(0);
    useEffect(() => {
        setNowMs(Date.now());
        const tick = setInterval(() => setNowMs(Date.now()), 30_000);
        return () => {
            clearInterval(tick);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!connectedAddress || instances.length === 0) {
                setCampaigns([]);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const perInstance = await Promise.all(
                    instances.map(async (i) => {
                        const mine = await queryCampaignsByCreator(
                            network.grpc,
                            i.address,
                            connectedAddress,
                            undefined,
                            100,
                        );
                        return mine.map((entry) => ({
                            instanceKey: i.key,
                            instanceLabel: i.label,
                            contract: i.address,
                            entry,
                        }));
                    }),
                );
                if (!cancelled) setCampaigns(perInstance.flat());
            } catch (e) {
                if (!cancelled) setError((e as Error).message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [connectedAddress, instances, network.grpc]);

    // Matched on instance AND id: ids restart at 1 per instance, so id alone
    // would write a refreshed campaign over its namesake on the other one.
    const onChanged = useCallback((instanceKey: InstanceKey, fresh: CampaignResponse) => {
        setCampaigns((prev) =>
            prev.map((c) =>
                c.instanceKey === instanceKey && c.entry.id === fresh.id ? { ...c, entry: fresh } : c,
            ),
        );
    }, []);

    const sorted = useMemo(
        () =>
            [...campaigns].sort(
                (a, b) =>
                    a.instanceKey.localeCompare(b.instanceKey) || b.entry.id - a.entry.id,
            ),
        [campaigns],
    );

    return (
        <div className="flex min-h-screen flex-col bg-customGray">
            <div className="mx-2 grow pt-24 pb-20">
                <div className="mx-auto w-full max-w-2xl space-y-4 px-2">
                    <div className="text-center text-white">
                        <PiHandCoinsBold className="mx-auto mb-2 text-trippyYellow" size={34} />
                        <div className="font-magic text-3xl">My claim drops</div>
                        <div className="text-sm text-slate-400">
                            on Injective <span className="capitalize text-trippyYellow">{networkKey}</span>
                        </div>
                    </div>

                    {!connectedAddress ? (
                        <div className={`${cardBase} space-y-3 text-center`}>
                            <p className="text-sm text-slate-300">
                                Connect the wallet that created the drops.
                            </p>
                            <ConnectWallet />
                        </div>
                    ) : instances.length === 0 ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                            Claim drops aren't deployed on {networkKey} yet.
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Link to="/claim-drop" className="flex-1">
                                    <div className={`${btnPrimary} w-full`}>New claim drop</div>
                                </Link>
                            </div>

                            {loading && <GridLoader color="#f9d73f" className="m-auto" />}
                            {error && (
                                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                                    {error}
                                </div>
                            )}
                            {!loading && sorted.length === 0 && !error && (
                                <div className={`${cardBase} space-y-2 text-center`}>
                                    <PiWarningBold className="mx-auto text-slate-500" size={22} />
                                    <p className="text-sm text-slate-400">
                                        This wallet hasn't created any drops on {networkKey}.
                                    </p>
                                </div>
                            )}
                            {nowMs > 0 &&
                                sorted.map((d) => (
                                    <DropCard
                                        key={`${d.contract}:${d.entry.id}`}
                                        entry={d.entry}
                                        contract={d.contract}
                                        instanceKey={d.instanceKey}
                                        // Only worth naming when there's more
                                        // than one instance to tell apart.
                                        instanceLabel={
                                            instances.length > 1 ? d.instanceLabel : null
                                        }
                                        networkKey={networkKey}
                                        grpc={network.grpc}
                                        explorerUrl={network.explorerUrl}
                                        creator={connectedAddress}
                                        nowMs={nowMs}
                                        onChanged={onChanged}
                                    />
                                ))}
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ManageDrops;
