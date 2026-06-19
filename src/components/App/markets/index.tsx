import { useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import dayjs from 'dayjs';
import client from '../../../utils/choiceApolloClient';
import choice from '../../../assets/choice.svg';
import CandleChart, { UP, DOWN } from './CandleChart';
import TradeFeed from './TradeFeed';
import { formatPrice, formatUsd, venueLabel } from './format';
import type { Candle, Denom, FeedTrade, MarketDescriptor, MarketKind } from './types';

const SHROOM_CW = 'inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8';
const TRADE_URL = `https://choice.exchange/swap?input=inj&output=${SHROOM_CW}&volumeSplitting=true`;

const INTERVALS = [
    { key: '1h', label: '1H', limit: 72 },
    { key: '4h', label: '4H', limit: 90 },
    { key: '1d', label: '1D', limit: 120 },
    { key: '1w', label: '1W', limit: 60 },
    { key: '1M', label: '1M', limit: 24 },
] as const;

type IntervalKey = (typeof INTERVALS)[number]['key'];

// ---- queries -------------------------------------------------------------

const MARKETS = gql`
    query ShroomSaiMarkets {
        analytics_spotmarket(
            where: {
                _or: [
                    { base_asset: { symbol: { _in: ["SHROOM", "SAI"] } } }
                    { quote_asset: { symbol: { _in: ["SHROOM", "SAI"] } } }
                ]
            }
            order_by: { volume24h_usd: desc_nulls_last }
        ) {
            key
            kind
            venue
            ref_id
            market_pk
            volume24h_usd
            base_asset {
                symbol
                address
                decimals
            }
            quote_asset {
                symbol
                address
                decimals
            }
        }
    }
`;

const CANDLE_FIELDS = `
    bucket_start
    open
    high
    low
    close
    open_usd
    high_usd
    low_usd
    close_usd
`;

const OB_CANDLES = gql`
    query OrderbookCandles($key: bigint!, $interval: String!, $limit: Int!) {
        candles: analytics_orderbookmarketcandle(
            where: { market_id: { _eq: $key }, interval: { _eq: $interval } }
            order_by: { bucket_start: desc }
            limit: $limit
        ) { ${CANDLE_FIELDS} }
    }
`;

const POOL_CANDLES = gql`
    query PoolCandles($key: String!, $interval: String!, $limit: Int!) {
        candles: analytics_poolcandle(
            where: { pool_id: { _eq: $key }, interval: { _eq: $interval } }
            order_by: { bucket_start: desc }
            limit: $limit
        ) { ${CANDLE_FIELDS} }
    }
`;

const CLMM_CANDLES = gql`
    query ClmmCandles($key: String!, $interval: String!, $limit: Int!) {
        candles: analytics_clmmpoolcandle(
            where: { pool_id: { _eq: $key }, interval: { _eq: $interval } }
            order_by: { bucket_start: desc }
            limit: $limit
        ) { ${CANDLE_FIELDS} }
    }
`;

const OB_TRADES = gql`
    query OrderbookTrades($ids: [bigint!], $limit: Int!) {
        analytics_orderbookmarkettrade(
            where: { market_id: { _in: $ids }, is_taker: { _eq: true } }
            order_by: { block_time: desc }
            limit: $limit
        ) {
            raw_id
            market_id
            block_time
            is_buy
            price_usd
            quantity
            notional_usd
            origin_signer
            transaction_hash
        }
    }
`;

const AMM_TRADES = gql`
    query AmmTrades($ids: [String!], $limit: Int!) {
        analytics_choiceswap(
            where: { pool_id: { _in: $ids } }
            order_by: { block_time: desc }
            limit: $limit
        ) {
            raw_id
            pool_id
            block_time
            offer_token_id
            ask_token_id
            offer_amount
            return_amount
            usd_input
            usd_output
            signer_id
        }
    }
`;

// ---- helpers -------------------------------------------------------------

interface RawSpotMarket {
    key: string;
    kind: string;
    venue: string;
    ref_id: string;
    market_pk: number | null;
    volume24h_usd: number | null;
    base_asset: { symbol: string; address: string; decimals: number };
    quote_asset: { symbol: string; address: string; decimals: number };
}

interface RawCandleRow {
    bucket_start: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    open_usd: number | null;
    high_usd: number | null;
    low_usd: number | null;
    close_usd: number | null;
}

interface RawObTrade {
    raw_id: string;
    market_id: number;
    block_time: string;
    is_buy: boolean;
    price_usd: number | null;
    quantity: number;
    notional_usd: number | null;
    origin_signer: string | null;
    transaction_hash: string | null;
}

interface RawAmmTrade {
    raw_id: string;
    pool_id: string;
    block_time: string;
    offer_token_id: string;
    ask_token_id: string;
    offer_amount: number;
    return_amount: number;
    usd_input: number | null;
    usd_output: number | null;
    signer_id: string | null;
}

const toDescriptor = (m: RawSpotMarket): MarketDescriptor => ({
    key: m.key,
    kind: (m.kind as MarketKind) ?? 'amm',
    venue: m.venue,
    refId: m.ref_id,
    marketPk: m.market_pk != null ? Number(m.market_pk) : null,
    base: m.base_asset,
    quote: m.quote_asset,
    vol24hUsd: Number(m.volume24h_usd ?? 0),
});

const pickDefault = (ms: MarketDescriptor[]): MarketDescriptor | undefined =>
    ms.find(
        (m) =>
            m.kind === 'orderbook' &&
            m.base.symbol === 'SHROOM' &&
            m.quote.symbol === 'INJ',
    ) ?? ms[0];

const labelFor = (ms: number, interval: IntervalKey) => {
    const d = dayjs(ms);
    if (interval === '1M') return d.format("MMM 'YY");
    if (interval === '1w' || interval === '1d') return d.format('MMM D');
    return d.format('MMM D HH:mm');
};

// ---- component -----------------------------------------------------------

const ShroomMarkets = () => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [interval, setIntervalKey] = useState<IntervalKey>('1h');
    const [denom, setDenom] = useState<Denom>('USD');
    const [allMarkets, setAllMarkets] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const { data: marketsData } = useQuery<{ analytics_spotmarket: RawSpotMarket[] }>(
        MARKETS,
        {
            client,
            fetchPolicy: 'cache-and-network',
            pollInterval: 300000,
        },
    );

    const markets = useMemo<MarketDescriptor[]>(
        () => (marketsData?.analytics_spotmarket ?? []).map(toDescriptor),
        [marketsData],
    );

    const selected = useMemo<MarketDescriptor | undefined>(() => {
        if (!markets.length) return undefined;
        if (selectedKey) {
            return markets.find((m) => m.key === selectedKey) ?? pickDefault(markets);
        }
        return pickDefault(markets);
    }, [markets, selectedKey]);

    // ---- candles for the selected market ----
    const activeInterval = INTERVALS.find((i) => i.key === interval) ?? INTERVALS[0];
    const candleDoc =
        selected?.kind === 'orderbook'
            ? OB_CANDLES
            : selected?.kind === 'clmm'
              ? CLMM_CANDLES
              : POOL_CANDLES;
    const candleKey =
        selected?.kind === 'orderbook' ? selected.marketPk : selected?.refId;

    const {
        data: candleData,
        loading: candleLoading,
        error: candleError,
    } = useQuery<{ candles: RawCandleRow[] }>(candleDoc, {
        client,
        fetchPolicy: 'cache-and-network',
        pollInterval: 60000,
        skip: !selected || candleKey == null,
        variables: { key: candleKey, interval, limit: activeInterval.limit },
    });

    const candles = useMemo<Candle[]>(() => {
        const rows = candleData?.candles ?? [];
        const parsed = rows
            .map((r): Candle | null => {
                const open = denom === 'USD' ? r.open_usd : r.open;
                const high = denom === 'USD' ? r.high_usd : r.high;
                const low = denom === 'USD' ? r.low_usd : r.low;
                const close = denom === 'USD' ? r.close_usd : r.close;
                if (open == null || high == null || low == null || close == null) {
                    return null;
                }
                if (!(Number(high) > 0)) return null;
                const t = dayjs(r.bucket_start).valueOf();
                return {
                    t,
                    label: labelFor(t, interval),
                    open: Number(open),
                    high: Number(high),
                    low: Number(low),
                    close: Number(close),
                    highLow: [Number(low), Number(high)],
                };
            })
            .filter((c): c is Candle => c !== null)
            .sort((a, b) => a.t - b.t);

        // Chain each candle's open to the previous candle's close so the chart
        // reads continuously — illiquid markets skip empty buckets, which
        // otherwise leaves the next candle's open detached from the prior close
        // (the "gappy" look). Widen the wick to cover the pinned open so the
        // body never spills past it.
        return parsed.map((c, i) => {
            if (i === 0) return c;
            const open = parsed[i - 1].close;
            const high = Math.max(c.high, open);
            const low = Math.min(c.low, open);
            return { ...c, open, high, low, highLow: [low, high] };
        });
    }, [candleData, denom, interval]);

    const stats = useMemo(() => {
        if (!candles.length) return null;
        const last = candles[candles.length - 1];
        const first = candles[0];
        const changePct =
            first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0;
        return { last: last.close, changePct };
    }, [candles]);

    // ---- trade feed (orderbook + AMM, single market or all) ----
    const byPk = useMemo(() => {
        const map = new Map<number, MarketDescriptor>();
        markets.forEach((m) => {
            if (m.marketPk != null) map.set(m.marketPk, m);
        });
        return map;
    }, [markets]);

    const byPool = useMemo(() => {
        const map = new Map<string, MarketDescriptor>();
        markets.forEach((m) => {
            if (m.kind !== 'orderbook') map.set(m.refId, m);
        });
        return map;
    }, [markets]);

    const obMarketIds = useMemo<number[]>(() => {
        if (allMarkets)
            return markets
                .filter((m) => m.marketPk != null)
                .map((m) => m.marketPk as number);
        return selected?.kind === 'orderbook' && selected.marketPk != null
            ? [selected.marketPk]
            : [];
    }, [allMarkets, markets, selected]);

    const ammPoolIds = useMemo<string[]>(() => {
        if (allMarkets)
            return markets.filter((m) => m.kind !== 'orderbook').map((m) => m.refId);
        return selected && selected.kind !== 'orderbook' ? [selected.refId] : [];
    }, [allMarkets, markets, selected]);

    const { data: obTradeData, loading: obLoading } = useQuery<{
        analytics_orderbookmarkettrade: RawObTrade[];
    }>(OB_TRADES, {
        client,
        fetchPolicy: 'cache-and-network',
        pollInterval: 15000,
        skip: obMarketIds.length === 0,
        variables: { ids: obMarketIds, limit: 60 },
    });

    const { data: ammTradeData, loading: ammLoading } = useQuery<{
        analytics_choiceswap: RawAmmTrade[];
    }>(AMM_TRADES, {
        client,
        fetchPolicy: 'cache-and-network',
        pollInterval: 15000,
        skip: ammPoolIds.length === 0,
        variables: { ids: ammPoolIds, limit: 60 },
    });

    const trades = useMemo<FeedTrade[]>(() => {
        const out: FeedTrade[] = [];

        for (const r of obTradeData?.analytics_orderbookmarkettrade ?? []) {
            const m = byPk.get(Number(r.market_id));
            if (!m) continue;
            out.push({
                id: `ob-${r.raw_id}`,
                time: dayjs(r.block_time).valueOf(),
                venue: 'Orderbook',
                pair: `${m.base.symbol}/${m.quote.symbol}`,
                baseSymbol: m.base.symbol,
                side: r.is_buy ? 'buy' : 'sell',
                amountBase: Number(r.quantity),
                priceUsd: r.price_usd != null ? Number(r.price_usd) : null,
                valueUsd: r.notional_usd != null ? Number(r.notional_usd) : null,
                trader: r.origin_signer ?? null,
                tx: r.transaction_hash ?? null,
            });
        }

        for (const r of ammTradeData?.analytics_choiceswap ?? []) {
            const m = byPool.get(r.pool_id);
            if (!m) continue;
            let side: 'buy' | 'sell';
            let amountBase: number;
            let valueUsd: number | null;
            if (r.ask_token_id === m.base.address) {
                side = 'buy';
                amountBase = Number(r.return_amount);
                valueUsd = r.usd_output != null ? Number(r.usd_output) : null;
            } else if (r.offer_token_id === m.base.address) {
                side = 'sell';
                amountBase = Number(r.offer_amount);
                valueUsd = r.usd_input != null ? Number(r.usd_input) : null;
            } else {
                continue;
            }
            out.push({
                id: `amm-${r.raw_id}`,
                time: dayjs(r.block_time).valueOf(),
                venue: m.venue,
                pair: `${m.base.symbol}/${m.quote.symbol}`,
                baseSymbol: m.base.symbol,
                side,
                amountBase,
                priceUsd: valueUsd != null && amountBase > 0 ? valueUsd / amountBase : null,
                valueUsd,
                trader: r.signer_id ?? null,
                tx: r.raw_id ?? null,
            });
        }

        out.sort((a, b) => b.time - a.time);
        return out.slice(0, 60);
    }, [obTradeData, ammTradeData, byPk, byPool]);

    const tradesLoading = obLoading || ammLoading;
    const priceStr = (v: number) =>
        denom === 'USD' ? `$${formatPrice(v)}` : `${formatPrice(v)} ${selected?.quote.symbol ?? ''}`;

    return (
        <div className="mx-auto w-full max-w-5xl font-sans">
            {/* market header + selector */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="relative">
                        <button
                            onClick={() => setPickerOpen((o) => !o)}
                            className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-left hover:border-white/40"
                        >
                            <div>
                                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                                    {selected
                                        ? `${selected.base.symbol}/${selected.quote.symbol}`
                                        : 'Loading…'}
                                    {selected && (
                                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                                            {venueLabel(selected)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className="text-white/50">▾</span>
                        </button>

                        {pickerOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setPickerOpen(false)}
                                />
                                <div className="absolute left-0 z-20 mt-1 max-h-80 w-80 overflow-y-auto rounded-xl border border-white/15 bg-[#04181f] shadow-xl">
                                    {markets.map((m) => {
                                        const isSel = selected?.key === m.key;
                                        return (
                                            <button
                                                key={m.key}
                                                onClick={() => {
                                                    setSelectedKey(m.key);
                                                    setPickerOpen(false);
                                                }}
                                                className={`flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/5 ${
                                                    isSel ? 'bg-white/10' : ''
                                                }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="text-white">
                                                        {m.base.symbol}/{m.quote.symbol}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-wide text-white/40">
                                                        {venueLabel(m)}
                                                    </span>
                                                </span>
                                                <span className="text-xs text-white/50">
                                                    {formatUsd(m.vol24hUsd)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {stats && (
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-white">
                                    {priceStr(stats.last)}
                                </span>
                                <span
                                    className="text-sm font-semibold"
                                    style={{ color: stats.changePct >= 0 ? UP : DOWN }}
                                >
                                    {stats.changePct >= 0 ? '+' : ''}
                                    {stats.changePct.toFixed(2)}%
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex overflow-hidden rounded-lg border border-white/15">
                            {(['USD', 'native'] as Denom[]).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDenom(d)}
                                    className={`px-3 py-1 text-sm transition-colors ${
                                        denom === d
                                            ? 'bg-trippyYellow text-black'
                                            : 'text-white/70 hover:text-white'
                                    }`}
                                >
                                    {d === 'USD' ? 'USD' : selected?.quote.symbol ?? 'Native'}
                                </button>
                            ))}
                        </div>
                        <div className="flex overflow-hidden rounded-lg border border-white/15">
                            {INTERVALS.map((i) => (
                                <button
                                    key={i.key}
                                    onClick={() => setIntervalKey(i.key)}
                                    className={`px-3 py-1 text-sm transition-colors ${
                                        interval === i.key
                                            ? 'bg-trippyYellow text-black'
                                            : 'text-white/70 hover:text-white'
                                    }`}
                                >
                                    {i.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* chart */}
                <div className="mt-4 h-80 w-full md:h-100">
                    {candleError ? (
                        <div className="flex h-full items-center justify-center text-sm text-white/50">
                            Couldn't load market data.
                        </div>
                    ) : candleLoading && !candles.length ? (
                        <div className="flex h-full items-center justify-center text-sm text-white/50">
                            Loading candles…
                        </div>
                    ) : !candles.length ? (
                        <div className="flex h-full items-center justify-center text-sm text-white/50">
                            No trades in this window.
                        </div>
                    ) : (
                        <CandleChart
                            candles={candles}
                            denom={denom}
                            quoteSymbol={selected?.quote.symbol ?? ''}
                        />
                    )}
                </div>

                {/* footer stats + cta */}
                <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
                    <div className="text-sm text-white/60">
                        24h volume:{' '}
                        <span className="text-white">
                            {selected ? formatUsd(selected.vol24hUsd) : '—'}
                        </span>
                    </div>
                    <a
                        href={TRADE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-lg border-2 border-white px-3 py-2 text-sm hover:font-semibold"
                    >
                        Trade on Choice Exchange
                        <img src={choice} className="ml-3 w-5" />
                    </a>
                </div>
            </div>

            {/* combined trade feed */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-base font-semibold text-white">Trades</div>
                    <div className="flex overflow-hidden rounded-lg border border-white/15 text-sm">
                        <button
                            onClick={() => setAllMarkets(false)}
                            className={`px-3 py-1 transition-colors ${
                                !allMarkets
                                    ? 'bg-trippyYellow text-black'
                                    : 'text-white/70 hover:text-white'
                            }`}
                        >
                            This market
                        </button>
                        <button
                            onClick={() => setAllMarkets(true)}
                            className={`px-3 py-1 transition-colors ${
                                allMarkets
                                    ? 'bg-trippyYellow text-black'
                                    : 'text-white/70 hover:text-white'
                            }`}
                        >
                            All markets
                        </button>
                    </div>
                </div>
                <TradeFeed trades={trades} loading={tradesLoading} showVenue={allMarkets} />
            </div>
        </div>
    );
};

export default ShroomMarkets;
