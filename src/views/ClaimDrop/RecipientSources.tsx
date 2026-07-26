// Where a claim drop's recipients come from.
//
// Same six sources the push Airdrop tool offers, but the arithmetic underneath
// is different by necessity: an airdrop rounds each transfer at send time, while
// a claim drop commits every amount to a merkle leaf and must attach funds equal
// to their sum exactly. So this owns the source selection, the refinement
// filters, and the exact BigInt split (see `allocation.ts`), then hands the
// parent a plain `address,amount` list — the same shape a CSV upload produces,
// so everything downstream (leaf building, dedupe, the tree, the confirm modal)
// stays on the single audited path.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { CircleLoader } from "react-spinners";

import TokenUtils from "../../modules/tokenUtils";
import TokenSelect from "../../components/Inputs/TokenSelect";
import useTokenStore from "../../store/useTokenStore";
import useLiquidityPoolStore from "../../store/usePoolStore";
import { CW404_TOKENS, NFT_COLLECTIONS } from "../../constants/contractAddresses";
import { ChainGrpcGovApi } from "@injectivelabs/sdk-ts";
import dayjs from "dayjs";

import DistributionToggle from "../Airdrop/components/DistributionToggle";
import HolderTable from "../Airdrop/components/HolderTable";
import TopNLimiter from "../Airdrop/components/TopNLimiter";
import MinAmountFilter from "../Airdrop/components/MinAmountFilter";
import VoteFilter from "../Airdrop/components/VoteFilter";
import { findBlockBeforeTime } from "../Airdrop/proposalBlock";
import type { AirdropRecipient, DistMode, VoteFilters } from "../Airdrop/types";
import { btnPrimary, btnGhost, inputBase, labelBase, darkSelectStyles } from "../Airdrop/components/ui";

import { parseClaimDropCsv, type ParsedClaimCsv } from "./csv";
import { fromBaseUnits, toBaseUnits, type CsvRow } from "./leaves";
import {
    allocateExact,
    applyMinAmount,
    applyTopN,
    applyVoteFilter,
    type SourceRow,
} from "./allocation";
import {
    SOURCE_OPTIONS,
    WEIGHTED_SOURCES,
    fetchBuybackRows,
    fetchMitoRows,
    fetchNftHolderRows,
    fetchTokenHolderRows,
    fetchVoterRows,
    type ClaimSourceMode,
} from "./sources";

const EXAMPLE_CSV = "address,amount\ninj1...,100\ninj1...,250.5\n";

/** Base units from a whole-token string, or 0 for anything unparseable. */
const parseBase = (whole: string, decimals: number): bigint => {
    try {
        return BigInt(toBaseUnits(whole || "0", decimals).base);
    } catch {
        return 0n;
    }
};

export interface RecipientsChange {
    rows: CsvRow[];
    invalidRows: ParsedClaimCsv["invalidRows"];
    /** Human description of where the list came from, for the drop's title. */
    sourceLabel: string;
}

const RecipientSources = ({
    decimals,
    symbol,
    network,
    networkConfig,
    onChange,
}: {
    decimals: number;
    symbol: string;
    network: string;
    networkConfig: any;
    onChange: (change: RecipientsChange) => void;
}) => {
    const { tokens } = useTokenStore();
    const { pools } = useLiquidityPoolStore();

    const [mode, setMode] = useState<{ value: ClaimSourceMode; label: string }>(SOURCE_OPTIONS[0]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState<string | null>(null);

    // CSV mode carries its own amounts, so it bypasses the allocator entirely.
    const fileInput = useRef<HTMLInputElement>(null);
    const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
    const [csvInvalid, setCsvInvalid] = useState<ParsedClaimCsv["invalidRows"]>([]);
    const [csvName, setCsvName] = useState<string | null>(null);

    // Everything else: a weighted wallet list plus how much to split across it.
    const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
    const [sourceLabel, setSourceLabel] = useState("");
    const [amountWhole, setAmountWhole] = useState("");
    const [dist, setDist] = useState<DistMode>("fair");

    // Refinements. Each narrows the wallet set; the total is then re-split across
    // whoever is left, so trimming never leaves the drop under-allocated.
    const [excluded, setExcluded] = useState<Set<string>>(new Set());
    const [topN, setTopN] = useState<number | null>(null);
    const [minWhole, setMinWhole] = useState<string | null>(null);
    const [voteAllowed, setVoteAllowed] = useState<Set<string>>(new Set());

    // Per-source inputs.
    const [nftCollection, setNftCollection] = useState<any>(NFT_COLLECTIONS[0]);
    const [sourceToken, setSourceToken] = useState<any>(null);
    const [proposalNumber, setProposalNumber] = useState("417");
    const [blockHeight, setBlockHeight] = useState(76938079);
    const [autoBlock, setAutoBlock] = useState(true);
    const [mitoVaults, setMitoVaults] = useState<any[]>([]);
    const [mitoVault, setMitoVault] = useState<any>(null);
    const [mitoHolderType, setMitoHolderType] = useState<"stake" | "non-stake">("non-stake");
    const [buybackRounds, setBuybackRounds] = useState<
        { value: number; label: string; total: number }[]
    >([]);
    const [buybackRound, setBuybackRound] = useState<{
        value: number;
        label: string;
        total: number;
    } | null>(null);

    const isCsv = mode.value === "CSV";
    const weighted = WEIGHTED_SOURCES.includes(mode.value);

    const resetList = useCallback(() => {
        setSourceRows([]);
        setExcluded(new Set());
        setTopN(null);
        setMinWhole(null);
        setVoteAllowed(new Set());
        setError(null);
    }, []);

    // Switching source starts from a clean list — a half-filtered holder set
    // carried across modes would silently shape the next drop.
    useEffect(() => {
        resetList();
        setCsvRows([]);
        setCsvInvalid([]);
        setCsvName(null);
        // Voters are one-wallet-one-share by convention; holdings-based sources
        // default to weighting by what people hold.
        setDist(mode.value === "GOV" ? "fair" : "proportionate");
    }, [mode, resetList]);

    const totalBase = parseBase(amountWhole, decimals);
    const minBase = minWhole === null ? 0n : parseBase(minWhole, decimals);

    // Source list → refinements → exact split. Recomputed from scratch whenever
    // any input moves so what the table shows is always what gets published.
    const kept = useMemo(() => {
        let rows = sourceRows.filter((r) => !excluded.has(r.address));
        if (mode.value === "GOV") rows = applyVoteFilter(rows, voteAllowed);
        if (topN !== null) rows = applyTopN(rows, topN);
        if (minBase > 0n) rows = applyMinAmount(rows, totalBase, dist, minBase);
        return rows;
    }, [sourceRows, excluded, mode.value, voteAllowed, topN, minBase, totalBase, dist]);

    const alloc = useMemo(
        () => allocateExact(kept, totalBase, dist),
        [kept, totalBase, dist],
    );

    const rows: CsvRow[] = useMemo(
        () =>
            isCsv
                ? csvRows
                : alloc.allocations.map((a) => ({
                      address: a.address,
                      // Back to a whole-token string, which the leaf builder
                      // converts straight back to these same base units.
                      amount: fromBaseUnits(a.amountBase, decimals),
                  })),
        [isCsv, csvRows, alloc.allocations, decimals],
    );

    const label = isCsv ? (csvName ? `CSV (${csvName})` : "CSV") : sourceLabel;

    useEffect(() => {
        onChange({ rows, invalidRows: isCsv ? csvInvalid : [], sourceLabel: label });
    }, [rows, csvInvalid, isCsv, label, onChange]);

    // ------------------------------------------------------------------ loading
    const run = useCallback(
        async (label: string, fn: () => Promise<void>) => {
            resetList();
            setLoading(true);
            setProgress("");
            try {
                await fn();
                setSourceLabel(label);
            } catch (e) {
                console.error("claim-drop recipient source failed", e);
                setError((e as Error).message || "Could not load that list");
            } finally {
                setLoading(false);
                setProgress("");
            }
        },
        [resetList],
    );

    const loadNft = useCallback(
        () =>
            run(`holders of ${nftCollection?.label ?? "an NFT collection"}`, async () => {
                const module = new TokenUtils(networkConfig);
                const is404 = CW404_TOKENS.some((t) => t.value === nftCollection.value);
                const { rows: found } = await fetchNftHolderRows(
                    module,
                    nftCollection.value,
                    is404,
                    setProgress,
                );
                setSourceRows(found);
            }),
        [run, nftCollection, networkConfig],
    );

    const loadToken = useCallback(
        () =>
            run(`holders of ${sourceToken?.label ?? "a token"}`, async () => {
                if (!sourceToken) throw new Error("Pick a token first");
                const module = new TokenUtils(networkConfig);
                const { rows: found } = await fetchTokenHolderRows(
                    module,
                    sourceToken.value,
                    {
                        tokenAddresses: tokens.map((t) => t.address),
                        poolAddresses: pools.map((p) => p.contract_addr),
                    },
                    setProgress,
                );
                setSourceRows(found);
            }),
        [run, sourceToken, networkConfig, tokens, pools],
    );

    const loadVoters = useCallback(
        () =>
            run(`voters on proposal ${proposalNumber}`, async () => {
                const module = new TokenUtils(networkConfig);
                let height = blockHeight;
                if (autoBlock) {
                    setProgress("Finding the block voting closed on");
                    const api = new ChainGrpcGovApi(networkConfig.grpc);
                    const proposal = await api.fetchProposal(Number(proposalNumber));
                    height = await findBlockBeforeTime(dayjs.unix(proposal!.votingEndTime).toDate());
                    setBlockHeight(height);
                }
                setSourceRows(await fetchVoterRows(module, proposalNumber, height, setProgress));
            }),
        [run, proposalNumber, networkConfig, blockHeight, autoBlock],
    );

    const loadMitoList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const module = new TokenUtils(networkConfig);
            const [spotMarkets, vaults] = await Promise.all([
                module.fetchSpotMarkets(),
                module.fetchMitoVaults(),
            ]);
            const options: any[] = [];
            for (const market of spotMarkets) {
                const vault = vaults
                    .slice()
                    .reverse()
                    .find((v: any) => v.marketId === (market as any).marketId);
                if (!vault) continue;
                options.push({
                    value: { ...market, matchingVault: vault },
                    label: `${(market as any).baseToken?.name ?? (market as any).marketId} vault`,
                });
            }
            setMitoVaults(options);
        } catch (e) {
            setError((e as Error).message || "Could not load the Mito vault list");
        } finally {
            setLoading(false);
        }
    }, [networkConfig]);

    const loadMito = useCallback(
        () =>
            run(
                `${mitoHolderType === "stake" ? "stakers" : "holders"} of ${
                    mitoVault?.label ?? "a Mito vault"
                }`,
                async () => {
                    if (!mitoVault) throw new Error("Pick a vault first");
                    const module = new TokenUtils(networkConfig);
                    const vaultAddress = mitoVault.value.matchingVault.contractAddress;
                    setSourceRows(
                        await fetchMitoRows(module, vaultAddress, mitoHolderType, setProgress),
                    );
                },
            ),
        [run, mitoVault, mitoHolderType, networkConfig],
    );

    const loadBuybackRounds = useCallback(async () => {
        if (buybackRounds.length > 0) return;
        setLoading(true);
        try {
            const module = new TokenUtils(networkConfig);
            const rounds = await module.fetchBuybackRounds();
            setBuybackRounds(
                rounds.map((r) => ({
                    value: r.round,
                    label: `Round ${r.round} — ${r.totalDeposit.toLocaleString()} INJ, ${r.usedSlots} wallets`,
                    total: r.totalDeposit,
                })),
            );
        } catch (e) {
            setError((e as Error).message || "Could not load the buyback rounds");
        } finally {
            setLoading(false);
        }
    }, [buybackRounds.length, networkConfig]);

    const loadBuyback = useCallback(
        () =>
            run(`Community BuyBack round ${buybackRound?.value ?? "?"} participants`, async () => {
                if (!buybackRound) throw new Error("Pick a round first");
                const module = new TokenUtils(networkConfig);
                setSourceRows(
                    await fetchBuybackRows(
                        module,
                        buybackRound.value,
                        buybackRound.total,
                        setProgress,
                    ),
                );
            }),
        [run, buybackRound, networkConfig],
    );

    // Buyback rounds and Mito vaults are lists the user picks from, so they load
    // when the mode is first opened rather than behind another button.
    useEffect(() => {
        if (mode.value === "BUYBACK") void loadBuybackRounds();
        if (mode.value === "MITO" && mitoVaults.length === 0) void loadMitoList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode.value]);

    const onCsv = useCallback((file: File) => {
        setError(null);
        setCsvName(file.name);
        parseClaimDropCsv(file)
            .then(({ rows: parsed, invalidRows }) => {
                setCsvRows(parsed);
                setCsvInvalid(invalidRows);
            })
            .catch((e: Error) => setError(e.message));
    }, []);

    // ------------------------------------------------------------------ display
    const keptSet = useMemo(() => new Set(kept.map((r) => r.address)), [kept]);
    const amountByAddress = useMemo(
        () => new Map(alloc.allocations.map((a) => [a.address, a.amountBase])),
        [alloc.allocations],
    );
    const allocatedTotal = BigInt(alloc.totalBase);

    const display: AirdropRecipient[] = useMemo(
        () =>
            sourceRows.map((r) => {
                const base = amountByAddress.get(r.address) ?? "0";
                return {
                    address: r.address,
                    balance: r.weight,
                    amountToAirdrop: Number(fromBaseUnits(base, decimals)),
                    percentToAirdrop:
                        allocatedTotal > 0n
                            ? Number((BigInt(base) * 1_000_000n) / allocatedTotal) / 10_000
                            : 0,
                    includeInDrop: keptSet.has(r.address),
                    ...(r.voteOption ? { vote_option: r.voteOption } : {}),
                };
            }),
        [sourceRows, amountByAddress, decimals, allocatedTotal, keptSet],
    );

    const toggleInclude = useCallback((address: string) => {
        setExcluded((prev) => {
            const next = new Set(prev);
            if (next.has(address)) next.delete(address);
            else next.add(address);
            return next;
        });
    }, []);

    const setIncludeAll = useCallback(
        (include: boolean) => {
            setExcluded(include ? new Set() : new Set(sourceRows.map((r) => r.address)));
        },
        [sourceRows],
    );

    return (
        <>
            <label className={labelBase} htmlFor="claim-drop-source">
                Recipient source
            </label>
            <Select
                inputId="claim-drop-source"
                options={SOURCE_OPTIONS}
                value={mode}
                onChange={(v) => setMode(v as { value: ClaimSourceMode; label: string })}
                styles={darkSelectStyles}
                isSearchable={false}
            />

            <div className="mt-4">
                {isCsv && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            ref={fileInput}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onCsv(file);
                            }}
                        />
                        <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => fileInput.current?.click()}
                        >
                            Upload CSV
                        </button>
                        <button
                            type="button"
                            className={btnGhost}
                            onClick={() => {
                                const blob = new Blob([EXAMPLE_CSV], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "claim-drop-template.csv";
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            Download template
                        </button>
                        {csvName && <span className="text-xs text-slate-400">{csvName}</span>}
                    </div>
                )}

                {mode.value === "TOKEN" && (
                    <>
                        <TokenSelect
                            dark
                            styles={darkSelectStyles}
                            placeholder="Search or paste the token whose holders get the drop"
                            options={[
                                {
                                    label: "TOKENS",
                                    options: tokens
                                        .filter((t) => t.show_on_ui)
                                        .map((t) => ({
                                            label: `${t.name} (${t.symbol})`,
                                            value: t.address,
                                            img: t.icon,
                                        })),
                                },
                            ]}
                            selectedOption={sourceToken}
                            setSelectedOption={setSourceToken}
                        />
                        <button
                            type="button"
                            disabled={loading || !sourceToken}
                            className={`${btnPrimary} mt-3`}
                            onClick={() => void loadToken()}
                        >
                            Load holders
                        </button>
                    </>
                )}

                {mode.value === "NFT" && (
                    <>
                        <Select
                            options={[...NFT_COLLECTIONS, ...CW404_TOKENS]}
                            value={nftCollection}
                            onChange={setNftCollection}
                            styles={darkSelectStyles}
                        />
                        <button
                            type="button"
                            disabled={loading || !nftCollection}
                            className={`${btnPrimary} mt-3`}
                            onClick={() => void loadNft()}
                        >
                            Load holders
                        </button>
                    </>
                )}

                {mode.value === "GOV" && (
                    <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className={labelBase} htmlFor="claim-drop-proposal">
                                    Proposal number
                                </label>
                                <input
                                    id="claim-drop-proposal"
                                    className={inputBase}
                                    value={proposalNumber}
                                    onChange={(e) => setProposalNumber(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={labelBase} htmlFor="claim-drop-height">
                                    Snapshot block
                                </label>
                                <input
                                    id="claim-drop-height"
                                    className={inputBase}
                                    disabled={autoBlock}
                                    value={blockHeight}
                                    onChange={(e) => setBlockHeight(Number(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-white">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-trippyYellow"
                                checked={autoBlock}
                                onChange={(e) => setAutoBlock(e.target.checked)}
                            />
                            Find the block voting closed on automatically
                        </label>
                        <button
                            type="button"
                            disabled={loading}
                            className={`${btnPrimary} block`}
                            onClick={() => void loadVoters()}
                        >
                            Load voters
                        </button>
                    </div>
                )}

                {mode.value === "MITO" && (
                    <div className="space-y-3">
                        <Select
                            options={mitoVaults}
                            value={mitoVault}
                            onChange={setMitoVault}
                            styles={darkSelectStyles}
                            placeholder={mitoVaults.length ? "Pick a vault" : "Loading vaults…"}
                        />
                        <div className="flex flex-wrap gap-2">
                            {(["non-stake", "stake"] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setMitoHolderType(t)}
                                    className={
                                        mitoHolderType === t
                                            ? "rounded-lg border border-trippyYellow/60 bg-trippyYellow/15 px-3 py-1.5 text-sm text-white"
                                            : "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300"
                                    }
                                >
                                    {t === "stake" ? "Stakers only" : "All LP holders"}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={loading || !mitoVault}
                            className={`${btnPrimary} block`}
                            onClick={() => void loadMito()}
                        >
                            Load holders
                        </button>
                    </div>
                )}

                {mode.value === "BUYBACK" && (
                    <div className="space-y-3">
                        <Select
                            options={buybackRounds}
                            value={buybackRound}
                            onChange={setBuybackRound}
                            styles={darkSelectStyles}
                            placeholder={buybackRounds.length ? "Pick a round" : "Loading rounds…"}
                        />
                        <button
                            type="button"
                            disabled={loading || !buybackRound}
                            className={`${btnPrimary} block`}
                            onClick={() => void loadBuyback()}
                        >
                            Load participants
                        </button>
                    </div>
                )}
            </div>

            {loading && (
                <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                    <CircleLoader color="#f9d73f" size={20} />
                    {progress || "Loading…"}
                </div>
            )}
            {error && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {error}
                </div>
            )}

            {!isCsv && sourceRows.length > 0 && (
                <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className={labelBase} htmlFor="claim-drop-amount">
                                Total to drop ({symbol || "tokens"})
                            </label>
                            <input
                                id="claim-drop-amount"
                                className={inputBase}
                                inputMode="decimal"
                                placeholder="0.0"
                                value={amountWhole}
                                onChange={(e) => setAmountWhole(e.target.value)}
                            />
                        </div>
                        {weighted ? (
                            <DistributionToggle value={dist} onChange={setDist} />
                        ) : (
                            <div className="self-end text-xs text-slate-400">
                                Voters get an equal share each — one wallet, one allocation.
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-slate-400">
                        {kept.length.toLocaleString()} of {sourceRows.length.toLocaleString()} wallets
                        included · allocating{" "}
                        <span className="text-trippyYellow">
                            {fromBaseUnits(alloc.totalBase, decimals)} {symbol}
                        </span>
                        {alloc.droppedZero > 0 && (
                            <> · {alloc.droppedZero} share(s) rounded to 0 and were dropped</>
                        )}
                        {totalBase > 0n && allocatedTotal !== totalBase && (
                            <>
                                {" "}
                                · {fromBaseUnits((totalBase - allocatedTotal).toString(), decimals)}{" "}
                                left unallocated as dust
                            </>
                        )}
                    </div>

                    <div>
                        <TopNLimiter onApply={(n) => setTopN(n)} onReset={() => setTopN(null)} />
                        {mode.value === "GOV" && (
                            <VoteFilter
                                onApply={(filters: VoteFilters) =>
                                    setVoteAllowed(
                                        new Set(
                                            Object.entries(filters)
                                                .filter(([, on]) => on)
                                                .map(([k]) => k),
                                        ),
                                    )
                                }
                                onReset={() => setVoteAllowed(new Set())}
                            />
                        )}
                        {weighted && dist === "proportionate" && (
                            <MinAmountFilter
                                symbol={symbol}
                                onApply={(min) => setMinWhole(String(min))}
                                onReset={() => setMinWhole(null)}
                            />
                        )}
                    </div>

                    <HolderTable
                        recipients={display}
                        onToggleInclude={toggleInclude}
                        onSetIncludeAll={setIncludeAll}
                        tokenSymbol={symbol}
                        tokenDecimals={decimals}
                        columns={{
                            include: true,
                            position: true,
                            balance: true,
                            vote: mode.value === "GOV",
                        }}
                        network={network}
                    />
                </div>
            )}
        </>
    );
};

export default RecipientSources;
