import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GridLoader } from "react-spinners";
import { PiHandCoinsBold } from "react-icons/pi";
import TokenUtils from "../../modules/tokenUtils";
import ConnectWallet from "../../components/App/ConnectKeplr";
import ShroomBalance from "../../components/App/ShroomBalance";
import Footer from "../../components/App/Footer";
import TokenSelect from "../../components/Inputs/TokenSelect";
import SectionCard from "../Airdrop/components/SectionCard";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import useTokenStore from "../../store/useTokenStore";
import { withShroomMetadata } from "../../modules/shroomTokenMeta";
import { buildTree } from "../../utils/claimDrops/merkle";
import { claimDropsContract, leavesUriForRoot, secondsToNanos } from "../../utils/claimDrops/config";
import { queryConfig } from "../../utils/claimDrops/queries";
import type { DropMeta } from "../../utils/claimDrops/types";
import { isBlockedRecipient } from "../Airdrop/blockedAddresses";
import { humanReadableAmount } from "../Airdrop/format";
import { downloadCsv } from "../../utils/csv";
import {
    btnPrimary,
    btnSecondary,
    btnGhost,
    inputBase,
    labelBase,
    darkSelectStyles,
} from "../Airdrop/components/ui";
import { type ParsedClaimCsv } from "./csv";
import { buildLeavesFromRows, fromBaseUnits, type CsvRow } from "./leaves";
import RecipientSources, { type RecipientsChange } from "./RecipientSources";
import ClaimDropConfirmModal from "./ClaimDropConfirmModal";

// SHROOM fee for publishing a drop — the same 25k (90% fee / 10% burn) the
// Airdrop tool charges. A claim drop is one tx instead of N, but it's the same
// service, and the recipients pay their own claim gas.
const CLAIM_DROP_SHROOM_COST = 25000;

// Today, resolved once at module load: `min` on the expiry picker only needs to
// be right for the session, and reading the clock during render isn't allowed.
const TODAY_ISO = new Date().toISOString().slice(0, 10);

// The contract holds native coins only (no CW20 support at all), so the picker
// must never offer a cw20 contract address — funding one would revert.
const isNativeDenom = (denom: string) =>
    denom === "inj" ||
    denom.startsWith("factory/") ||
    denom.startsWith("peggy") ||
    denom.startsWith("ibc/");


const ClaimDrop = () => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore();
    const { tokens } = useTokenStore();

    const contract = claimDropsContract(currentNetwork);

    const [denomOption, setDenomOption] = useState<{ value: string; label: string } | null>(null);
    const [tokenInfo, setTokenInfo] = useState<{ symbol: string; name?: string; decimals: number } | null>(
        null,
    );
    const [decimalsOverride, setDecimalsOverride] = useState<string>("");
    const [balanceBase, setBalanceBase] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [rows, setRows] = useState<CsvRow[]>([]);
    const [invalidRows, setInvalidRows] = useState<ParsedClaimCsv["invalidRows"]>([]);
    /** Where the list came from, e.g. "holders of PUNK" — seeds the drop title. */
    const [sourceLabel, setSourceLabel] = useState("");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [logo, setLogo] = useState("");
    const [expiryDate, setExpiryDate] = useState("");

    // The instance's own platform fee (Dan's is expected to be 0 — the tool
    // charges its SHROOM fee instead) and pause flag, read from the contract.
    const [feeBps, setFeeBps] = useState(0);
    const [paused, setPaused] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    const [showConfirm, setShowConfirm] = useState(false);

    const denom = denomOption?.value ?? "";
    // The manual override is a free-text field, so a half-typed or cleared value
    // must never reach the leaf math — an invalid one falls back to the on-chain
    // decimals rather than throwing out of render.
    const overrideDecimals = Number(decimalsOverride);
    const decimals =
        decimalsOverride !== "" &&
        Number.isInteger(overrideDecimals) &&
        overrideDecimals >= 0 &&
        overrideDecimals <= 24
            ? overrideDecimals
            : (tokenInfo?.decimals ?? 6);

    useEffect(() => {
        setTokenInfo(null);
        setBalanceBase(null);
        setDecimalsOverride("");
    }, [denomOption]);

    useEffect(() => {
        if (!contract) return;
        let cancelled = false;
        queryConfig(networkConfig.grpc, contract)
            .then((cfg) => {
                if (cancelled) return;
                setFeeBps(cfg.fee_bps);
                setPaused(cfg.paused);
                setConfigError(null);
            })
            .catch((e: Error) => {
                if (!cancelled) setConfigError(e.message);
            });
        return () => {
            cancelled = true;
        };
    }, [contract, networkConfig.grpc]);

    const getDenomInfo = useCallback(async () => {
        if (!denom) return;
        setLoading(true);
        setError(null);
        const module = new TokenUtils(networkConfig);

        // The chain is the authority on decimals, but its lookup doesn't cover
        // every native denom (the tokenfactory authority-metadata leg fails for
        // peggy/IBC denoms), so the indexed token list is the fallback rather
        // than making the user type decimals for USDT.
        const known = tokens.find((t) => t.address === denom);
        let info: { symbol: string; name?: string; decimals: number } | null = known
            ? { symbol: known.symbol, name: known.name, decimals: known.decimals }
            : null;

        try {
            // SHROOM launch tokens carry a raw subdenom on-chain; overlay the
            // launchpad's friendly name/symbol (no-op for every other denom).
            const meta = await withShroomMetadata(denom, await module.getDenomExtraMetadata(denom));
            info = { symbol: meta.symbol, name: meta.name, decimals: meta.decimals };
        } catch (e) {
            const reason = (e as Error).message;
            if (info) {
                setError(
                    `On-chain metadata for ${denom} couldn't be read (${reason}) — using the token list's ` +
                        `${info.decimals} decimals. Check that against the token before publishing.`,
                );
            } else {
                info = { symbol: "", decimals: 0 };
                setError(
                    `Could not read metadata for ${denom} (${reason}). You can still continue — set the ` +
                        `decimals manually below.`,
                );
            }
        }

        setTokenInfo(info);
        if (!title) setTitle(`${info.symbol || "Token"} claim drop`);
        if (connectedAddress) {
            const bal = await module.getBalanceOfToken(denom, connectedAddress).catch(() => null);
            setBalanceBase(bal?.amount ?? null);
        }
        setLoading(false);
    }, [denom, networkConfig, connectedAddress, title, tokens]);

    const onRecipientsChange = useCallback((change: RecipientsChange) => {
        setRows(change.rows);
        setInvalidRows(change.invalidRows);
        setSourceLabel(change.sourceLabel);
    }, []);

    // Recipients → leaves (base units, deduped) → tree. Rebuilt whenever the list
    // or the denom's decimals change, since both feed the leaf hashes. Guarded:
    // an exception escaping a render would white-screen the whole tool.
    const build = useMemo(() => {
        try {
            return buildLeavesFromRows(rows, decimals, { isBlocked: isBlockedRecipient });
        } catch (e) {
            console.error("failed to build claim-drop leaves", e);
            return {
                leaves: [],
                totalBase: "0",
                mergedRows: 0,
                truncatedRows: 0,
                zeroRows: 0,
                blockedRows: 0,
            };
        }
    }, [rows, decimals]);

    const tree = useMemo(() => {
        if (build.leaves.length === 0) return null;
        try {
            return buildTree(build.leaves);
        } catch (e) {
            console.error("failed to build merkle tree", e);
            return null;
        }
    }, [build.leaves]);

    const expiryNanos = useMemo(() => {
        if (!expiryDate) return null;
        const ms = new Date(`${expiryDate}T23:59:59Z`).getTime();
        if (!Number.isFinite(ms)) return null;
        return secondsToNanos(Math.floor(ms / 1000));
    }, [expiryDate]);

    const meta: DropMeta = useMemo(
        () => ({
            title: title.trim() || `${tokenInfo?.symbol ?? denom} claim drop`,
            symbol: tokenInfo?.symbol ?? "",
            decimals,
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(logo.trim() ? { logo: logo.trim() } : {}),
        }),
        [title, description, logo, tokenInfo?.symbol, denom, decimals],
    );

    // `MAX_META_LEN` in the contract. Blowing it only fails at broadcast, so it's
    // checked here instead — in UTF-8 BYTES, which is what `meta.len()` counts on
    // the Rust side. A title in emoji or CJK is up to 4x longer there than the
    // JS string length suggests.
    const metaTooLong = new TextEncoder().encode(JSON.stringify(meta)).length > 4096;

    const totalWhole = tree ? fromBaseUnits(tree.total, decimals) : "0";
    const perWallet =
        tree && build.leaves.length > 0
            ? fromBaseUnits((BigInt(tree.total) / BigInt(build.leaves.length)).toString(), decimals)
            : "0";

    const blockers: string[] = [];
    if (!contract) blockers.push("The claim-drops contract isn't deployed on this network yet.");
    if (paused) blockers.push("The contract is paused — no new drops can be created right now.");
    if (!denom) blockers.push("Pick the token to drop.");
    if (denom && !isNativeDenom(denom)) blockers.push("Native denoms only — this contract can't hold CW20 tokens.");
    if (!tokenInfo) blockers.push("Load the token info so amounts convert at the right decimals.");
    if (!tree) blockers.push("Upload a CSV with at least one valid recipient.");
    if (metaTooLong) blockers.push("Title/description/logo are too long (4KB limit on-chain).");
    // The contract demands EXACTLY total + fee, so publishing on a guessed
    // fee_bps would just revert. Better to make the failed read the blocker.
    if (contract && configError) blockers.push("Couldn't read the contract's fee config — reload and retry.");

    // The clock can't be read during render, so a past expiry is caught here (the
    // contract rejects one too — this just fails before the wallet prompt).
    const openConfirm = useCallback(() => {
        if (expiryNanos !== null && BigInt(expiryNanos) <= BigInt(Date.now()) * 1_000_000n) {
            setError("The expiry date must be in the future.");
            return;
        }
        setError(null);
        setShowConfirm(true);
    }, [expiryNanos]);

    const downloadLeaves = useCallback(() => {
        if (!tree) return;
        const header = "address,amount_base_units,amount";
        const body = tree.leaves.map(
            (l) => `${l.address},${l.amount},${fromBaseUnits(l.amount, decimals)}`,
        );
        downloadCsv(`claim-drop-${tree.rootHex.slice(0, 10)}.csv`, [header, ...body].join("\n"));
    }, [tree, decimals]);

    return (
        <>
            {showConfirm && tree && tokenInfo && (
                <ClaimDropConfirmModal
                    setShowModal={setShowConfirm}
                    contract={contract}
                    denom={denom}
                    symbol={tokenInfo.symbol}
                    decimals={decimals}
                    meta={meta}
                    tree={tree}
                    feeBps={feeBps}
                    expiryNanos={expiryNanos}
                    shroomCost={CLAIM_DROP_SHROOM_COST}
                    balanceBase={balanceBase}
                    notes={{
                        invalidRows: invalidRows.length,
                        mergedRows: build.mergedRows,
                        truncatedRows: build.truncatedRows,
                        zeroRows: build.zeroRows,
                        blockedRows: build.blockedRows,
                    }}
                />
            )}

            <div className="flex min-h-screen flex-col bg-customGray pb-10">
                <div className="mx-2 grow pt-24 pb-20">
                    {currentNetwork === "mainnet" && <ShroomBalance />}

                    <div className="flex min-h-full items-center justify-center">
                        <div className="w-full max-w-(--breakpoint-lg) px-2">
                            {connectedAddress ? (
                                <div className="space-y-5">
                                    <div className="text-center text-white">
                                        <PiHandCoinsBold className="mx-auto mb-2 text-trippyYellow" size={34} />
                                        <div className="font-magic text-3xl">New Claim Drop</div>
                                        <div className="text-sm text-slate-400">
                                            on Injective{" "}
                                            <span className="capitalize text-trippyYellow">{currentNetwork}</span>{" "}
                                            — recipients claim; you pay one transaction
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Link to="/airdrop" className="flex-1">
                                            <div className={`${btnSecondary} w-full`}>Push an airdrop instead →</div>
                                        </Link>
                                        <Link to="/claim-drop/manage" className="flex-1">
                                            <div className={`${btnSecondary} w-full`}>Manage my drops</div>
                                        </Link>
                                    </div>

                                    {!contract && (
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                                            The <span className="font-mono">choice-claim-drops</span> contract
                                            isn't deployed on {currentNetwork} yet, so this tool is read-only for
                                            now. You can still build and export a list; publishing unlocks once
                                            the instance address is set.
                                        </div>
                                    )}
                                    {configError && (
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                                            Couldn't read the contract config ({configError}). Publishing needs it
                                            — funding has to match the instance's fee exactly — so reload before
                                            creating a drop.
                                        </div>
                                    )}

                                    {/* Step 1 — token */}
                                    <SectionCard
                                        step={1}
                                        title="Token to drop"
                                        subtitle="Native denoms only (tokenfactory / peggy / IBC / inj) — this contract can't hold CW20"
                                    >
                                        <TokenSelect
                                            dark
                                            styles={darkSelectStyles}
                                            placeholder="Search or paste a denom"
                                            options={[
                                                {
                                                    label: "NATIVE DENOMS",
                                                    options: tokens
                                                        .filter((t) => t.show_on_ui && isNativeDenom(t.address))
                                                        .map((t) => ({
                                                            label: `${t.name} (${t.symbol})`,
                                                            value: t.address,
                                                            img: t.icon,
                                                        })),
                                                },
                                            ]}
                                            selectedOption={denomOption}
                                            setSelectedOption={setDenomOption}
                                        />
                                        {denom && !isNativeDenom(denom) && (
                                            <div className="mt-3 text-xs text-rose-300">
                                                {denom} looks like a CW20 contract. Wrap it to its factory denom
                                                first, or use the push airdrop tool.
                                            </div>
                                        )}
                                        {denom && isNativeDenom(denom) && (
                                            <button
                                                disabled={loading}
                                                onClick={() => {
                                                    void getDenomInfo();
                                                }}
                                                className={`${btnPrimary} mt-4 w-full`}
                                            >
                                                Get token info
                                            </button>
                                        )}

                                        {tokenInfo && (
                                            <div className="mt-5 grid gap-4 text-sm text-white md:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <span className="text-slate-400">symbol:</span>{" "}
                                                        {tokenInfo.symbol || "—"}
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">name:</span>{" "}
                                                        {tokenInfo.name || "—"}
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">balance:</span>{" "}
                                                        {balanceBase !== null
                                                            ? `${humanReadableAmount(fromBaseUnits(balanceBase, decimals))} ${tokenInfo.symbol}`
                                                            : "—"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={labelBase} htmlFor="claim-drop-decimals">
                                                        Decimals
                                                    </label>
                                                    <input
                                                        id="claim-drop-decimals"
                                                        className={`${inputBase} mt-1`}
                                                        type="number"
                                                        min={0}
                                                        max={24}
                                                        value={decimalsOverride === "" ? tokenInfo.decimals : decimalsOverride}
                                                        onChange={(e) => setDecimalsOverride(e.target.value)}
                                                    />
                                                    <div className="mt-1 text-xs text-slate-400">
                                                        Amounts in the CSV are whole tokens and are converted at
                                                        these decimals. Wrong decimals = wrong allocations, and a
                                                        frozen drop can't be corrected.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </SectionCard>

                                    {/* Step 2 — recipients */}
                                    <SectionCard
                                        step={2}
                                        title="Recipients"
                                        subtitle="A CSV of `address,amount`, or split a total across token holders, an NFT community, voters, Mito vaults or BuyBack participants"
                                    >
                                        <RecipientSources
                                            decimals={decimals}
                                            symbol={tokenInfo?.symbol ?? ""}
                                            network={currentNetwork}
                                            networkConfig={networkConfig}
                                            onChange={onRecipientsChange}
                                        />

                                        {rows.length > 0 && sourceLabel && (
                                            <div className="mt-4 text-xs text-slate-400">
                                                list built from{" "}
                                                <span className="text-slate-200">{sourceLabel}</span>
                                            </div>
                                        )}

                                        {rows.length > 0 && (
                                            <div className="mt-4 grid grid-cols-2 gap-2 text-white md:grid-cols-4">
                                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                                        Recipients
                                                    </div>
                                                    <div className="text-sm font-bold">
                                                        {build.leaves.length.toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                                        Total out
                                                    </div>
                                                    <div className="text-sm font-bold">
                                                        {humanReadableAmount(totalWhole)} {tokenInfo?.symbol ?? ""}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                                        Avg / wallet
                                                    </div>
                                                    <div className="text-sm font-bold">
                                                        {humanReadableAmount(perWallet)}
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
                                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                                        Merkle root
                                                    </div>
                                                    <div className="truncate font-mono text-xs font-bold text-trippyYellow">
                                                        {tree ? `${tree.rootHex.slice(0, 14)}…` : "—"}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(invalidRows.length > 0 ||
                                            build.mergedRows > 0 ||
                                            build.truncatedRows > 0 ||
                                            build.zeroRows > 0 ||
                                            build.blockedRows > 0) && (
                                            <div className="mt-3 space-y-1 text-xs text-amber-400">
                                                {invalidRows.length > 0 && (
                                                    <div>
                                                        {invalidRows.length} row(s) skipped (invalid address or
                                                        amount) — first: row {invalidRows[0].row}{" "}
                                                        {invalidRows[0].reason}.
                                                    </div>
                                                )}
                                                {build.mergedRows > 0 && (
                                                    <div>
                                                        {build.mergedRows} duplicate address(es) merged — one leaf
                                                        each, allocations summed.
                                                    </div>
                                                )}
                                                {build.truncatedRows > 0 && (
                                                    <div>
                                                        {build.truncatedRows} amount(s) rounded down to{" "}
                                                        {decimals} decimals.
                                                    </div>
                                                )}
                                                {build.zeroRows > 0 && (
                                                    <div>{build.zeroRows} allocation(s) rounded to 0 — dropped.</div>
                                                )}
                                                {build.blockedRows > 0 && (
                                                    <div>
                                                        {build.blockedRows} bank-blocked module account(s)
                                                        excluded.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {build.leaves.length > 0 && (
                                            <>
                                                <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-white/10">
                                                    <table className="w-full table-auto text-xs text-white">
                                                        <thead className="sticky top-0 bg-[#04141b] text-left text-slate-400">
                                                            <tr>
                                                                <th className="px-4 py-2">Address</th>
                                                                <th className="px-4 py-2">Claimable</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {build.leaves.slice(0, 500).map((leaf) => (
                                                                <tr
                                                                    key={leaf.address}
                                                                    className="border-b border-white/5 hover:bg-white/5"
                                                                >
                                                                    <td className="whitespace-nowrap px-4 py-1.5 font-mono">
                                                                        {leaf.address}
                                                                    </td>
                                                                    <td className="whitespace-nowrap px-4 py-1.5 text-trippyYellow">
                                                                        {fromBaseUnits(leaf.amount, decimals)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                    {build.leaves.length > 500 && (
                                                        <span>
                                                            showing the first 500 of{" "}
                                                            {build.leaves.length.toLocaleString()}
                                                        </span>
                                                    )}
                                                    <button type="button" className={btnGhost} onClick={downloadLeaves}>
                                                        Export final list
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </SectionCard>

                                    {/* Step 3 — drop details */}
                                    <SectionCard
                                        step={3}
                                        title="Drop details"
                                        subtitle="Stored on-chain with the campaign and shown on the claim page"
                                    >
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                                <label className={labelBase} htmlFor="claim-drop-title">
                                                    Title
                                                </label>
                                                <input
                                                    id="claim-drop-title"
                                                    className={`${inputBase} mt-1`}
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    placeholder="SHROOM holder reward"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelBase} htmlFor="claim-drop-logo">
                                                    Logo URL (optional)
                                                </label>
                                                <input
                                                    id="claim-drop-logo"
                                                    className={`${inputBase} mt-1`}
                                                    value={logo}
                                                    onChange={(e) => setLogo(e.target.value)}
                                                    placeholder="https:// or ipfs://"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className={labelBase} htmlFor="claim-drop-description">
                                                    Description (optional)
                                                </label>
                                                <textarea
                                                    id="claim-drop-description"
                                                    className={`${inputBase} mt-1`}
                                                    rows={2}
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="Who this is for and why"
                                                />
                                            </div>
                                            <div>
                                                <label className={labelBase} htmlFor="claim-drop-expiry">
                                                    Expiry (optional)
                                                </label>
                                                <input
                                                    id="claim-drop-expiry"
                                                    className={`${inputBase} mt-1`}
                                                    type="date"
                                                    min={TODAY_ISO}
                                                    value={expiryDate}
                                                    onChange={(e) => setExpiryDate(e.target.value)}
                                                />
                                                {expiryDate && (
                                                    <button
                                                        type="button"
                                                        className={`${btnGhost} mt-2`}
                                                        onClick={() => setExpiryDate("")}
                                                    >
                                                        Make it perpetual
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {expiryDate ? (
                                                    <>
                                                        Claims close at the end of that day (UTC). After that you
                                                        can claw back whatever wasn't claimed — once. An expiry can
                                                        later be extended, never shortened.
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-slate-300">Perpetual:</span> claimable
                                                        forever. A one-shot drop freezes on publish, which also
                                                        locks the no-expiry promise — you can never claw these
                                                        funds back. Set a date if you want that option.
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {metaTooLong && (
                                            <div className="mt-3 text-xs text-rose-300">
                                                Title + description + logo exceed the contract's 4KB metadata
                                                limit.
                                            </div>
                                        )}
                                    </SectionCard>

                                    {/* Step 4 — review */}
                                    <SectionCard step={4} title="Review & publish">
                                        {tree && (
                                            <div className="space-y-1.5 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
                                                <div>
                                                    <span className="text-slate-400">recipients:</span>{" "}
                                                    {build.leaves.length.toLocaleString()}
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">total funded:</span>{" "}
                                                    {totalWhole} {tokenInfo?.symbol ?? ""}
                                                    {feeBps > 0 && ` (+ ${feeBps} bps contract fee)`}
                                                </div>
                                                <div className="break-all">
                                                    <span className="text-slate-400">leaves_uri:</span>{" "}
                                                    {leavesUriForRoot(currentNetwork, tree.rootHex)}
                                                </div>
                                            </div>
                                        )}
                                        {blockers.length > 0 && (
                                            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-400">
                                                {blockers.map((b) => (
                                                    <li key={b}>{b}</li>
                                                ))}
                                            </ul>
                                        )}
                                        <button
                                            type="button"
                                            className={`${btnPrimary} mt-4 w-full`}
                                            disabled={blockers.length > 0}
                                            onClick={openConfirm}
                                        >
                                            Review claim drop
                                        </button>
                                        <div className="mt-3 text-xs text-slate-400">
                                            One transaction creates, funds and freezes the drop. Recipients pay
                                            their own claim gas, so a wallet that never claims costs you nothing
                                            beyond the funds sitting in the contract.
                                        </div>
                                    </SectionCard>

                                    {loading && <GridLoader color="#f9d73f" className="m-auto" />}
                                    {error && (
                                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-center text-white">
                                    <PiHandCoinsBold className="text-trippyYellow" size={34} />
                                    <div className="font-magic text-3xl">Claim Drops</div>
                                    <p className="max-w-md text-sm text-slate-400">
                                        Publish a merkle drop in one transaction and let recipients claim it
                                        themselves — no 500-wallet multisend chains, no gas for wallets that never
                                        show up.
                                    </p>
                                    <ConnectWallet />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        </>
    );
};

export default ClaimDrop;
