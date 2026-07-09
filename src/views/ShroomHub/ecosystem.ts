// SHROOM + SAI ecosystem data model — sourced from the Choice API.
//
// Token stats (price / market cap / fdv / supply / burn / 24h change) come from
// the Choice GraphQL `tokens_token` + `analytics_tokenstats`. Per-pool liquidity
// for the breakdown comes from Choice's CoinGecko-tickers REST endpoint (carries
// `liquidity_in_usd` per pool); DojoSwap + the Mito MM vault are read on-chain in
// the view, since the tickers feed only covers Choice's own pools.

import { gql } from '@apollo/client';

export const SHROOM_CW = 'inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8';
export const SHROOM_ADAPTER = 'inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk';
export const SHROOM_BANK_DENOM = `factory/${SHROOM_ADAPTER}/${SHROOM_CW}`;
export const SAI_FACTORY = 'inj10aa0h5s0xwzv95a8pjhwluxcm5feeqygdk3lkm';
export const SAI_DENOM = `factory/${SAI_FACTORY}/SAI`;

// Non-Choice venues the tickers feed omits — read on-chain.
export const DOJO_SHROOM_INJ = 'inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl';
export const CHOICE_SHROOM_INJ = 'inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5';
export const MITO_VAULT = 'inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp';

// The Helix SHROOM/INJ orderbook (market id 97) that the Mito vault makes.
// Its trading volume is what we show on the on-chain "Mito" liquidity row.
export const SHROOM_INJ_ORDERBOOK_REF =
    '0xc6b6d6627aeed8b9c29810163bed47d25c695d51a2aa8599fc5e39b2d88ef934';

export const CHOICE_TICKERS_URL =
    'https://api.choice.exchange/api/coingecko/tickers';

// One liquidity source: a pool (or vault) on a single venue.
export interface PoolLiq {
    id: string;
    venue: string; // Choice | DojoSwap | Mito | …
    pair: string; // canonical "SHROOM/INJ"
    base: string;
    quote: string;
    tvlUsd: number;
    vol24hUsd: number | null;
}

export const VENUE_COLORS: Record<string, string> = {
    Choice: '#f6c945',
    DojoSwap: '#fb7185',
    Mito: '#34d399',
    Astroport: '#a78bfa',
    Helix: '#60a5fa',
    Other: '#94a3b8',
};
export const venueColor = (v: string): string =>
    VENUE_COLORS[v] ?? VENUE_COLORS.Other;

export const TOKEN_COLORS: Record<string, string> = {
    SHROOM: '#f59e0b',
    SAI: '#10b981',
};

const VENUE_ORDER = ['Choice', 'DojoSwap', 'Mito', 'Astroport', 'Helix', 'Other'];

// Pair-label ordering: SHROOM and SAI always lead, so the SAI<>SHROOM pool reads
// "SHROOM/SAI" regardless of which side the indexer calls "base".
const RANK: Record<string, number> = { SHROOM: 0, SAI: 1, INJ: 2 };
const rankOf = (s: string) => (s in RANK ? RANK[s] : 9);

// Quote tokens that pair with SHROOM/SAI but whose denom isn't self-describing
// (the CoinGecko feed uses raw addresses) — e.g. EVM USDC is the SHROOM/USDC pool.
const KNOWN_TOKENS: { match: string; symbol: string }[] = [
    { match: '0xa00c59ff5a080d2b954d0c75e46e22a0c371235a', symbol: 'USDC' },
];

export const symbolOf = (currency: string): string => {
    if (!currency) return '?';
    if (currency === 'inj' || currency === 'INJ') return 'INJ';
    if (currency.includes(SHROOM_CW)) return 'SHROOM';
    if (currency.includes(`${SAI_FACTORY}/SAI`)) return 'SAI';
    const lc = currency.toLowerCase();
    for (const k of KNOWN_TOKENS) if (lc.includes(k.match)) return k.symbol;
    if (currency.startsWith('erc20:')) return `0x${currency.slice(8, 12)}…`;
    const seg = currency.split('/').pop() ?? currency;
    return seg.length > 9 ? `${seg.slice(0, 4)}…${seg.slice(-3)}` : seg.toUpperCase();
};

const orderPair = (a: string, b: string): [string, string] =>
    rankOf(a) <= rankOf(b) ? [a, b] : [b, a];

// ---- token stats (Choice GraphQL: tokens_token + analytics_tokenstats) ---

// Query by ADDRESS, not symbol — the indexer carries two "SHROOM" rows (the CW
// token and its bank-adapter mirror); the CW address is the canonical one.
export const TOKEN_STATS_QUERY = gql`
    query EcosystemTokenStats($addresses: [String!]) {
        tokens_token(where: { address: { _in: $addresses } }) {
            address
            symbol
            name
            decimals
            logo
            total_supply
            circulating_supply
            stats {
                current_price_usd
                market_cap
                fdv
                total_burned_amount
                price_change_usd_24h
            }
        }
    }
`;

export interface TokenStat {
    symbol: string;
    name: string | null;
    address: string;
    logo: string | null;
    priceUsd: number;
    marketCap: number;
    fdv: number;
    burned: number;
    change24h: number | null;
    circulatingSupply: number;
    totalSupply: number;
}

export const parseTokenStats = (rows: any[]): Record<string, TokenStat> => {
    const out: Record<string, TokenStat> = {};
    for (const r of rows ?? []) {
        const s = Array.isArray(r.stats) ? r.stats[0] : r.stats;
        const dec = Number(r.decimals) || 18;
        const scale = 10 ** dec;
        out[r.symbol] = {
            symbol: r.symbol,
            name: r.name ?? null,
            address: r.address,
            logo: r.logo ?? null,
            priceUsd: Number(s?.current_price_usd) || 0,
            marketCap: Number(s?.market_cap) || 0,
            fdv: Number(s?.fdv) || 0,
            burned: Number(s?.total_burned_amount) || 0,
            change24h:
                s?.price_change_usd_24h != null
                    ? Number(s.price_change_usd_24h)
                    : null,
            circulatingSupply:
                r.circulating_supply != null ? Number(r.circulating_supply) / scale : 0,
            totalSupply: r.total_supply != null ? Number(r.total_supply) / scale : 0,
        };
    }
    return out;
};

// ---- holder counts (trippinj backend: token_tracker / wallet_tracker) ----
//
// Unlike the Choice token/market data above, holder tracking lives on
// trippytools' own Hasura. Query + mutate these through the DEFAULT Apollo
// client (not choiceClient) — same source the standalone Token Holders page uses.

export const SHROOM_HOLDER_IDS = [SHROOM_CW, SHROOM_BANK_DENOM];
export const SAI_HOLDER_IDS = [SAI_DENOM];

export const ECOSYSTEM_HOLDERS_QUERY = gql`
    query EcosystemHolders($shroom: [String!], $sai: [String!]) {
        # SHROOM is tracked as two token rows — the CW20 and its bank (factory)
        # denom — so a plain row count double-counts every wallet holding both.
        # Count DISTINCT wallets instead. (balance table is unique per
        # (wallet, token), so distinct wallet_id == the real holder count.)
        shroom_holders: wallet_tracker_balance_aggregate(
            where: { token_id: { _in: $shroom }, balance: { _gt: 0 } }
        ) {
            aggregate {
                count(columns: [wallet_id], distinct: true)
            }
        }
        # Distinct wallets here too, so it stays correct if SAI ever gains a
        # wrapper denom (harmless for the current single-denom case).
        sai_holders: wallet_tracker_balance_aggregate(
            where: { token_id: { _in: $sai }, balance: { _gt: 0 } }
        ) {
            aggregate {
                count(columns: [wallet_id], distinct: true)
            }
        }
        shroom_token: token_tracker_token(where: { address: { _in: $shroom } }) {
            address
            holders_last_updated
            holders_query_progress
            holders_save_progress
        }
        sai_token: token_tracker_token(where: { address: { _in: $sai } }) {
            address
            holders_last_updated
            holders_query_progress
            holders_save_progress
        }
    }
`;

export const UPDATE_TOKEN_HOLDERS_MUTATION = gql`
    mutation UpdateTokenHolders($address: String!) {
        updateTokenHolders(address: $address) {
            success
        }
    }
`;

export interface HolderInfo {
    count: number | null;
    lastUpdated: string | null;
    inProgress: boolean;
    progressPct: number | null; // 0..100 while a refresh is running
}

// Fold the aggregate count + per-token tracker rows into one display model,
// mirroring the Token Holders page's progress semantics: `save` progress is
// already a percent, `query` progress is a fraction of the holder count.
export const parseHolderInfo = (countAgg: any, tokenRows: any[]): HolderInfo => {
    const count = countAgg?.aggregate?.count ?? null;
    let lastUpdated: string | null = null;
    const saves: number[] = [];
    const queries: number[] = [];
    for (const r of tokenRows ?? []) {
        if (
            r.holders_last_updated &&
            (!lastUpdated || r.holders_last_updated > lastUpdated)
        ) {
            lastUpdated = r.holders_last_updated;
        }
        if (r.holders_save_progress != null) saves.push(Number(r.holders_save_progress));
        if (r.holders_query_progress != null)
            queries.push(Number(r.holders_query_progress));
    }
    let inProgress = false;
    let progressPct: number | null = null;
    if (saves.length) {
        inProgress = true;
        progressPct = Math.min(...saves);
    } else if (queries.length) {
        inProgress = true;
        progressPct = count
            ? Math.min(...queries.map((q) => Math.min((q / count) * 100, 100)))
            : null;
    }
    return { count, lastUpdated, inProgress, progressPct };
};

// ---- per-pool liquidity (Choice tickers REST) ----------------------------

interface RawTicker {
    base_currency: string;
    target_currency: string;
    base_volume: string;
    target_volume: string;
    pool_id: string;
    liquidity_in_usd: string;
}

// Per-pool metadata resolved from Choice's GraphQL index, keyed by the same
// identifiers the coingecko tickers feed uses:
//   • friendly token symbols — launchpad tokens (factory/<launchpad>/shroom_<id>_<hash>)
//     aren't self-describing, so we look them up rather than showing "shro…cad".
//   • authoritative CLMM pool TVL — the coingecko adapter can't price a
//     concentrated-liquidity launchpad pool and reports a NEGATIVE
//     liquidity_in_usd; the indexer's clmm snapshot carries the real tvl_usd.
const CHOICE_GRAPHQL_URL = import.meta.env.VITE_CHOICE_URL as string | undefined;

const POOL_META_QUERY = `
    query EcosystemPoolMeta($addrs: [String!], $pools: [String!]) {
        tokens_token(where: { address: { _in: $addrs } }) {
            address
            symbol
        }
        liquidity_clmmpoolsnapshot(
            where: { pool_id: { _in: $pools } }
            order_by: [{ pool_id: asc }, { time: desc }]
            distinct_on: pool_id
        ) {
            pool_id
            tvl_usd
        }
    }`;

export interface ChoicePoolMeta {
    symbols: Record<string, string>; // denom -> symbol, e.g. "factory/…/shroom_11_…" -> "BERB"
    tvl: Record<string, number>; // pool_id -> authoritative CLMM tvl_usd
}

// Best-effort: any failure (feed down, unknown denom/pool) yields empty maps, so
// the caller falls back to symbolOf + the coingecko liquidity figure.
export const fetchChoicePoolMeta = async (
    denoms: string[],
    poolIds: string[],
): Promise<ChoicePoolMeta> => {
    const empty: ChoicePoolMeta = { symbols: {}, tvl: {} };
    if (!CHOICE_GRAPHQL_URL || (!denoms.length && !poolIds.length)) return empty;
    try {
        const res = await fetch(CHOICE_GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: POOL_META_QUERY,
                variables: { addrs: denoms, pools: poolIds },
            }),
        });
        if (!res.ok) return empty;
        const json = await res.json();
        const symbols: Record<string, string> = {};
        for (const r of json?.data?.tokens_token ?? [])
            if (r?.address && r?.symbol) symbols[r.address] = String(r.symbol);
        const tvl: Record<string, number> = {};
        for (const r of json?.data?.liquidity_clmmpoolsnapshot ?? []) {
            const v = Number(r?.tvl_usd);
            if (r?.pool_id && Number.isFinite(v)) tvl[r.pool_id] = v;
        }
        return { symbols, tvl };
    } catch {
        return empty;
    }
};

// ---- 24h volume for the on-chain venues (Choice indexer) -----------------
//
// The DojoSwap AMM pool and the Helix SHROOM/INJ orderbook (market-made by the
// Mito vault) are read on-chain for TVL, but the CoinGecko tickers feed only
// carries Choice's own pools — so those rows have no 24h volume. Choice's
// indexer DOES track their trades, so pull their volume from
// `analytics_spotmarket` (keyed by ref_id: the pool address / the market hash).
export interface OnchainVolumes {
    dojoShroomInj: number | null; // DojoSwap SHROOM/INJ pool 24h vol
    shroomInjOrderbook: number | null; // Helix orderbook (Mito) 24h vol
}

const ONCHAIN_VOL_QUERY = `
    query ShroomOnchainVolumes($refs: [String!]) {
        analytics_spotmarket(where: { ref_id: { _in: $refs } }) {
            ref_id
            volume24h_usd
        }
    }`;

// Best-effort: any failure yields nulls, so the rows just render "—" as before.
export const fetchOnchainVolumes = async (): Promise<OnchainVolumes> => {
    const empty: OnchainVolumes = { dojoShroomInj: null, shroomInjOrderbook: null };
    if (!CHOICE_GRAPHQL_URL) return empty;
    try {
        const res = await fetch(CHOICE_GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: ONCHAIN_VOL_QUERY,
                variables: { refs: [DOJO_SHROOM_INJ, SHROOM_INJ_ORDERBOOK_REF] },
            }),
        });
        if (!res.ok) return empty;
        const json = await res.json();
        const byRef: Record<string, number> = {};
        for (const r of json?.data?.analytics_spotmarket ?? []) {
            const v = Number(r?.volume24h_usd);
            if (r?.ref_id && Number.isFinite(v)) byRef[r.ref_id] = v;
        }
        return {
            dojoShroomInj: byRef[DOJO_SHROOM_INJ] ?? null,
            shroomInjOrderbook: byRef[SHROOM_INJ_ORDERBOOK_REF] ?? null,
        };
    } catch {
        return empty;
    }
};

// Keep only the SHROOM/SAI Choice pools. 24h USD volume = the token-unit
// `base_volume`/`target_volume` priced off whichever leg we know a USD price for
// (SHROOM / SAI / INJ) — every SHROOM/SAI pool has at least one such leg.
export const parseChoiceTickers = (
    results: RawTicker[],
    priceUsd: Record<string, number>,
    meta: ChoicePoolMeta = { symbols: {}, tvl: {} },
): PoolLiq[] => {
    const resolve = (currency: string): string =>
        meta.symbols[currency] ?? symbolOf(currency);
    const pools: PoolLiq[] = [];
    for (const t of results) {
        const baseSym = resolve(t.base_currency);
        const quoteSym = resolve(t.target_currency);
        const touches = (s: string) => s === 'SHROOM' || s === 'SAI';
        if (!touches(baseSym) && !touches(quoteSym)) continue;

        const bp = priceUsd[baseSym];
        const qp = priceUsd[quoteSym];
        let vol: number | null = null;
        if (bp) vol = Number(t.base_volume) * bp;
        else if (qp) vol = Number(t.target_volume) * qp;

        // Prefer the indexer's CLMM snapshot TVL: the coingecko adapter can't
        // price a concentrated-liquidity launchpad pool and returns a negative
        // liquidity_in_usd. Fall back to the coingecko figure (correct for the
        // XYK pools, which have no clmm snapshot), floored at 0 for safety.
        const snapshotTvl = meta.tvl[t.pool_id];
        const tvlUsd =
            snapshotTvl != null ? snapshotTvl : Math.max(0, Number(t.liquidity_in_usd) || 0);

        const [base, quote] = orderPair(baseSym, quoteSym);
        pools.push({
            id: t.pool_id,
            venue: 'Choice',
            pair: `${base}/${quote}`,
            base,
            quote,
            tvlUsd,
            vol24hUsd: vol,
        });
    }
    return pools;
};

// The tickers endpoint returns a DRF page `{count,next,previous,results}` (all
// pools fit one page); tolerate a bare array too in case that changes.
export const fetchChoicePools = async (
    priceUsd: Record<string, number>,
): Promise<PoolLiq[]> => {
    const res = await fetch(CHOICE_TICKERS_URL);
    if (!res.ok) throw new Error(`choice tickers ${res.status}`);
    const json = await res.json();
    const results: RawTicker[] = Array.isArray(json) ? json : (json?.results ?? []);

    // For every SHROOM/SAI-touching pool, collect its pool_id (to fetch the real
    // CLMM tvl_usd) and any leg symbolOf can't name (to fetch a friendly symbol,
    // so pairs read "SAI/BERB" not "SAI/shro…cad"), then resolve both in one call.
    const touches = (s: string) => s === 'SHROOM' || s === 'SAI';
    const unresolved = new Set<string>();
    const poolIds = new Set<string>();
    for (const t of results) {
        const b = symbolOf(t.base_currency);
        const q = symbolOf(t.target_currency);
        if (!touches(b) && !touches(q)) continue;
        poolIds.add(t.pool_id);
        if (b.includes('…')) unresolved.add(t.base_currency);
        if (q.includes('…')) unresolved.add(t.target_currency);
    }
    const meta = await fetchChoicePoolMeta([...unresolved], [...poolIds]);
    return parseChoiceTickers(results, priceUsd, meta);
};

// ---- aggregations for the three breakdown views -------------------------

export interface PairRow {
    pair: string;
    total: number;
    [venue: string]: number | string;
}

export const venuesOf = (pools: PoolLiq[]): string[] => {
    const set = new Set(pools.map((p) => p.venue));
    return VENUE_ORDER.filter((v) => set.has(v));
};

export const byPair = (pools: PoolLiq[]): PairRow[] => {
    const map = new Map<string, PairRow>();
    for (const p of pools) {
        let row = map.get(p.pair);
        if (!row) {
            row = { pair: p.pair, total: 0 };
            map.set(p.pair, row);
        }
        row[p.venue] = ((row[p.venue] as number) ?? 0) + p.tvlUsd;
        row.total += p.tvlUsd;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
};

export const byVenue = (
    pools: PoolLiq[],
): { name: string; value: number }[] => {
    const map = new Map<string, number>();
    for (const p of pools) map.set(p.venue, (map.get(p.venue) ?? 0) + p.tvlUsd);
    return [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
};

export const byToken = (
    pools: PoolLiq[],
): { name: string; value: number; pools: number }[] => {
    const acc: Record<string, { value: number; pools: number }> = {
        SHROOM: { value: 0, pools: 0 },
        SAI: { value: 0, pools: 0 },
    };
    for (const p of pools) {
        if (p.base === 'SHROOM' || p.quote === 'SHROOM') {
            acc.SHROOM.value += p.tvlUsd;
            acc.SHROOM.pools += 1;
        }
        if (p.base === 'SAI' || p.quote === 'SAI') {
            acc.SAI.value += p.tvlUsd;
            acc.SAI.pools += 1;
        }
    }
    return [
        { name: 'SHROOM', value: acc.SHROOM.value, pools: acc.SHROOM.pools },
        { name: 'SAI', value: acc.SAI.value, pools: acc.SAI.pools },
    ];
};

export const totalTvl = (pools: PoolLiq[]): number =>
    pools.reduce((s, p) => s + p.tvlUsd, 0);

// Total TVL of every pool a token participates in (the SHROOM<>SAI pool counts
// toward both, as it is liquidity for each).
export const tokenTvl = (pools: PoolLiq[], symbol: string): number =>
    pools
        .filter((p) => p.base === symbol || p.quote === symbol)
        .reduce((s, p) => s + p.tvlUsd, 0);

export const tokenVol24h = (pools: PoolLiq[], symbol: string): number =>
    pools
        .filter((p) => p.base === symbol || p.quote === symbol)
        .reduce((s, p) => s + (p.vol24hUsd ?? 0), 0);
