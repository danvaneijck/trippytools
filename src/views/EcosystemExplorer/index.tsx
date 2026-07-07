// Ecosystem Explorer — a sortable, filterable comparison table of every token in
// the Injective/Choice ecosystem: price, price change, cross-venue volume, unique
// traders, swaps, liquidity, market cap and holders, with the activity columns
// switchable between 24h / 7d / 30d / 90d windows.
//
// Data: Choice public GraphQL (token registry + TokenMarketStats windowed rollup)
// merged with trippinj's holder tracker. See ./data.ts for the source split.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { toast } from 'react-toastify';
import { ClipLoader } from 'react-spinners';
import { FiSearch } from 'react-icons/fi';

import Footer from '../../components/App/Footer';
import choiceClient from '../../utils/choiceApolloClient';
import { resolveImageUrl } from '../../utils/img';
import {
    formatAmount,
    formatPrice,
    formatUsd,
    shortAddr,
    timeAgo,
} from '../../components/App/markets/format';
import { SectionHeader } from '../ShroomHub/ui';
import { PANEL, TOGGLE_WRAP, toggleBtn } from '../ShroomHub/styles';
import {
    buildRows,
    ECOSYSTEM_TOKENS_QUERY,
    type EcoTokenRow,
    HOLDER_COUNTS_QUERY,
    MARKET_STATS_QUERY,
    STAT_WINDOWS,
    type StatWindow,
} from './data';

const MAX_RENDERED_ROWS = 300;

type SortKey =
    | 'symbol'
    | 'price'
    | 'change'
    | 'volume'
    | 'traders'
    | 'swaps'
    | 'liquidity'
    | 'marketCap'
    | 'fdv'
    | 'holders';

interface Prefs {
    window: StatWindow;
    sortKey: SortKey;
    sortAsc: boolean;
    listedOnly: boolean;
    minLiquidity: number;
}

const DEFAULT_PREFS: Prefs = {
    window: '24h',
    sortKey: 'volume',
    sortAsc: false,
    listedOnly: true,
    minLiquidity: 0,
};

const PREFS_KEY = 'ecosystem-explorer-prefs';

const loadPrefs = (): Prefs => {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
        /* corrupted prefs -> defaults */
    }
    return DEFAULT_PREFS;
};

const sortValue = (r: EcoTokenRow, key: SortKey, w: StatWindow): number | string => {
    switch (key) {
        case 'symbol':
            return r.symbol.toLowerCase();
        case 'price':
            return r.priceUsd;
        case 'change':
            return r.change[w] ?? Number.NEGATIVE_INFINITY;
        case 'volume':
            return r.volume[w];
        case 'traders':
            return r.traders[w];
        case 'swaps':
            return r.swaps[w];
        case 'liquidity':
            return r.liquidityUsd;
        case 'marketCap':
            return r.marketCap;
        case 'fdv':
            return r.fdv;
        case 'holders':
            return r.holders ?? -1;
    }
};

const ChangeCell = ({ value }: { value: number | null }) => {
    if (value == null) return <span className="text-white/30">—</span>;
    const up = value >= 0;
    return (
        <span className={up ? 'text-emerald-400' : 'text-rose-400'}>
            {up ? '+' : ''}
            {value.toFixed(2)}%
        </span>
    );
};

const TokenAvatar = ({ logo, symbol }: { logo: string | null; symbol: string }) => {
    const [stage, setStage] = useState(0);
    // Graduated shroompad tokens arrive with logos already served by the
    // launchpad's own resizing webp proxy (…trippyinj.xyz/img). Re-wrapping
    // those in wsrv.nl 400s — it refuses the nested postimg.cc source by
    // policy — so already-proxied URLs go direct. Everything else tries the
    // wsrv proxy first, then the raw source (rescues other wsrv-blocked
    // hosts), then the letter fallback.
    const sources: string[] = [];
    if (logo) {
        if (logo.includes('trippyinj.xyz/img')) {
            sources.push(logo);
        } else {
            const proxied = resolveImageUrl(logo, 64);
            if (proxied) sources.push(proxied);
            if (/^https?:\/\//i.test(logo) && logo !== proxied) sources.push(logo);
        }
    }
    const src = sources[stage];
    if (!src) {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                {symbol.slice(0, 1).toUpperCase()}
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={symbol}
            className="h-7 w-7 shrink-0 rounded-full bg-white/10 object-cover"
            onError={() => setStage((s) => s + 1)}
        />
    );
};

const LIQ_FILTERS = [
    { label: 'Any liq', value: 0 },
    { label: '>$100', value: 100 },
    { label: '>$1k', value: 1_000 },
    { label: '>$10k', value: 10_000 },
] as const;

const Th = ({
    label,
    k,
    align = 'right',
    sortKey,
    sortAsc,
    onSort,
}: {
    label: string;
    k?: SortKey;
    align?: 'left' | 'right';
    sortKey: SortKey;
    sortAsc: boolean;
    onSort: (k: SortKey) => void;
}) => (
    <th
        className={`whitespace-nowrap px-3 py-2 ${align === 'left' ? 'text-left' : 'text-right'} text-[11px] font-medium uppercase tracking-wide text-white/40 ${
            k ? 'cursor-pointer select-none hover:text-white/70' : ''
        }`}
        onClick={k ? () => onSort(k) : undefined}
    >
        {label}
        {k && sortKey === k && <span className="ml-1 text-trippyYellow">{sortAsc ? '▲' : '▼'}</span>}
    </th>
);

const EcosystemExplorer = () => {
    const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
    const [search, setSearch] = useState('');
    const { window: win, sortKey, sortAsc, listedOnly, minLiquidity } = prefs;

    // Render-safe clock for the "x ago" labels (react-hooks/purity forbids
    // calling Date.now() during render).
    const [nowTs, setNowTs] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNowTs(Date.now()), 60_000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch {
            /* storage full/blocked — prefs just won't persist */
        }
    }, [prefs]);

    // Backend refreshes TokenStats every minute — 60s keeps price/Δ%/liquidity
    // near-live without re-pulling the 500KB all-tokens payload too often.
    const tokensQ = useQuery(ECOSYSTEM_TOKENS_QUERY, {
        client: choiceClient,
        fetchPolicy: 'cache-and-network',
        pollInterval: 60_000,
    });
    // Separate query + errorPolicy so the table keeps rendering while the
    // TokenMarketStats backend (windowed volume/traders) isn't deployed yet.
    // The backend's fast lane rewrites the *_24h columns every minute; a 30s
    // poll on this small (~400-row) table keeps the page within ~90s of chain.
    const marketQ = useQuery(MARKET_STATS_QUERY, {
        client: choiceClient,
        fetchPolicy: 'cache-and-network',
        pollInterval: 30_000,
        errorPolicy: 'all',
    });
    const holdersQ = useQuery(HOLDER_COUNTS_QUERY, {
        fetchPolicy: 'cache-and-network',
        pollInterval: 300_000,
        errorPolicy: 'all',
    });

    const rows = useMemo(
        () =>
            buildRows(
                tokensQ.data?.tokens_token,
                marketQ.data?.analytics_tokenmarketstats,
                holdersQ.data?.token_tracker_token,
            ),
        [tokensQ.data, marketQ.data, holdersQ.data],
    );

    const marketStatsLive = rows.some((r) => r.hasMarketStats);
    const marketStatsUpdated: string | null =
        marketQ.data?.analytics_tokenmarketstats?.[0]?.updated_at ?? null;

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = rows.filter((r) => {
            if (listedOnly && !r.listed) return false;
            if (r.liquidityUsd < minLiquidity) return false;
            if (!q) return true;
            return (
                r.symbol.toLowerCase().includes(q) ||
                (r.name ?? '').toLowerCase().includes(q) ||
                r.address.toLowerCase().includes(q)
            );
        });
        const dir = sortAsc ? 1 : -1;
        filtered.sort((a, b) => {
            const va = sortValue(a, sortKey, win);
            const vb = sortValue(b, sortKey, win);
            if (va < vb) return -dir;
            if (va > vb) return dir;
            // Stable, meaningful tie-break (e.g. volume all-zero pre-deploy).
            return b.liquidityUsd - a.liquidityUsd;
        });
        return filtered;
    }, [rows, search, listedOnly, minLiquidity, sortKey, sortAsc, win]);

    const setSort = (key: SortKey) =>
        setPrefs((p) =>
            p.sortKey === key
                ? { ...p, sortAsc: !p.sortAsc }
                : { ...p, sortKey: key, sortAsc: key === 'symbol' },
        );

    const copyAddress = (address: string) => {
        navigator.clipboard
            .writeText(address)
            .then(() => toast.success('Address copied'))
            .catch(() => toast.error('Copy failed'));
    };

    const loading = tokensQ.loading && !tokensQ.data;
    const thProps = { sortKey, sortAsc, onSort: setSort };

    return (
        <>
            <div className="flex min-h-screen flex-col bg-customGray">
                <div className="mx-auto w-full max-w-7xl space-y-4 px-3 pt-20 pb-16 sm:px-5 md:pt-24">
                    <SectionHeader
                        eyebrow="Injective ecosystem"
                        title="Ecosystem Explorer"
                        sub="Compare every token's activity across Choice AMM, CLMM and Helix orderbook markets."
                    >
                        <div className={TOGGLE_WRAP}>
                            {STAT_WINDOWS.map((w) => (
                                <button
                                    key={w}
                                    className={toggleBtn(win === w)}
                                    onClick={() => setPrefs((p) => ({ ...p, window: w }))}
                                >
                                    {w.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </SectionHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <FiSearch className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-white/40" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search symbol, name or address"
                                className="w-64 rounded-lg border border-white/10 bg-black/20 py-1.5 pr-3 pl-8 text-sm text-white placeholder-white/30 focus:border-trippyYellow/60 focus:outline-hidden"
                            />
                        </div>
                        <div className={TOGGLE_WRAP}>
                            <button
                                className={toggleBtn(listedOnly)}
                                onClick={() => setPrefs((p) => ({ ...p, listedOnly: true }))}
                            >
                                Listed
                            </button>
                            <button
                                className={toggleBtn(!listedOnly)}
                                onClick={() => setPrefs((p) => ({ ...p, listedOnly: false }))}
                            >
                                All tokens
                            </button>
                        </div>
                        <div className={TOGGLE_WRAP}>
                            {LIQ_FILTERS.map((f) => (
                                <button
                                    key={f.value}
                                    className={toggleBtn(minLiquidity === f.value)}
                                    onClick={() =>
                                        setPrefs((p) => ({ ...p, minLiquidity: f.value }))
                                    }
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="ml-auto text-xs text-white/40">
                            {visible.length} tokens
                            {marketStatsUpdated && (
                                <>
                                    {' '}
                                    · stats{' '}
                                    {timeAgo(new Date(marketStatsUpdated).getTime(), nowTs)} ago
                                </>
                            )}
                        </div>
                    </div>

                    {!marketStatsLive && !marketQ.loading && (
                        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/80">
                            Windowed volume &amp; trader stats aren&apos;t live on the Choice API
                            yet — those columns will populate once the backend rollup is deployed.
                        </div>
                    )}

                    <div className={`${PANEL} overflow-x-auto`}>
                        {loading ? (
                            <div className="flex items-center justify-center py-24">
                                <ClipLoader size={28} color="#facc15" />
                            </div>
                        ) : (
                            <table className="w-full min-w-265 text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <Th label="#" {...thProps} />
                                        <Th label="Token" k="symbol" align="left" {...thProps} />
                                        <Th label="Price" k="price" {...thProps} />
                                        <Th label={`Δ ${win}`} k="change" {...thProps} />
                                        <Th label={`Vol ${win}`} k="volume" {...thProps} />
                                        <Th label={`Traders ${win}`} k="traders" {...thProps} />
                                        <Th label={`Swaps ${win}`} k="swaps" {...thProps} />
                                        <Th label="Liquidity" k="liquidity" {...thProps} />
                                        <Th label="Mcap" k="marketCap" {...thProps} />
                                        <Th label="FDV" k="fdv" {...thProps} />
                                        <Th label="Holders" k="holders" {...thProps} />
                                    </tr>
                                </thead>
                                <tbody className="tabular-nums">
                                    {visible.slice(0, MAX_RENDERED_ROWS).map((r, i) => (
                                        <tr
                                            key={r.address}
                                            className="border-b border-white/5 hover:bg-white/2"
                                        >
                                            <td className="px-3 py-2 text-right text-white/30">
                                                {i + 1}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2.5">
                                                    <TokenAvatar logo={r.logo} symbol={r.symbol} />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 font-semibold text-white">
                                                            {r.symbol}
                                                            {!r.listed && (
                                                                <span className="rounded bg-white/10 px-1 py-px text-[9px] font-medium text-white/40 uppercase">
                                                                    unlisted
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="block max-w-40 truncate text-left text-[11px] text-white/35 hover:text-white/70"
                                                            title={`${r.name ?? r.symbol} — click to copy ${r.address}`}
                                                            onClick={() => copyAddress(r.address)}
                                                        >
                                                            {r.name || shortAddr(r.address)}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right text-white">
                                                ${formatPrice(r.priceUsd)}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <ChangeCell value={r.change[win]} />
                                            </td>
                                            <td className="px-3 py-2 text-right text-white">
                                                {r.hasMarketStats ? (
                                                    formatUsd(r.volume[win])
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-white/80">
                                                {r.hasMarketStats ? (
                                                    formatAmount(r.traders[win])
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-white/60">
                                                {r.hasMarketStats ? (
                                                    formatAmount(r.swaps[win])
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-white/80">
                                                {r.liquidityUsd > 0 ? (
                                                    formatUsd(r.liquidityUsd)
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-white/80">
                                                {r.marketCap > 0 ? (
                                                    formatUsd(r.marketCap)
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-white/60">
                                                {r.fdv > 0 ? (
                                                    formatUsd(r.fdv)
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                            <td
                                                className="px-3 py-2 text-right text-white/80"
                                                title={
                                                    r.holdersUpdated
                                                        ? `Holder snapshot ${timeAgo(new Date(r.holdersUpdated).getTime(), nowTs)} ago (trippy tracker)`
                                                        : 'Not tracked yet — index it via the Holder tool'
                                                }
                                            >
                                                {r.holders != null ? (
                                                    formatAmount(r.holders)
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {visible.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={11}
                                                className="px-3 py-10 text-center text-white/40"
                                            >
                                                No tokens match the current filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                        {visible.length > MAX_RENDERED_ROWS && (
                            <div className="border-t border-white/5 px-3 py-2 text-center text-xs text-white/40">
                                Showing top {MAX_RENDERED_ROWS} of {visible.length} — refine the
                                filters to narrow down.
                            </div>
                        )}
                    </div>

                    <p className="text-[11px] leading-relaxed text-white/30">
                        Volume, traders and swaps are unioned across Choice AMM, CLMM and Helix
                        spot orderbook markets. A trade counts toward both sides of its pair, so
                        quote tokens (INJ, USDT…) carry everything traded against them. Traders
                        are unique wallets, deduplicated across venues. Liquidity is the sum of
                        every venue the Choice indexer values — XYK pool reserves, CLMM pool TVL
                        and Mito vaults — also credited to both sides. Holder counts come from
                        the trippy holder tracker and only exist for tokens it has indexed —
                        hover for snapshot age.
                    </p>
                </div>
                <Footer />
            </div>
        </>
    );
};

export default EcosystemExplorer;
