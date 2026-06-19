// Shared types for the SHROOM / SAI markets explorer (Choice-indexed data).

export type Denom = 'USD' | 'native';

export type MarketKind = 'orderbook' | 'amm' | 'clmm';

export interface Asset {
    symbol: string;
    address: string;
    decimals: number;
}

// Normalized descriptor for one tradeable venue (orderbook market or pool),
// derived from the `analytics_spotmarket` unified view.
export interface MarketDescriptor {
    key: string; // e.g. "orderbook:97" / "amm:inj1..."
    kind: MarketKind;
    venue: string; // Orderbook / Choice / DojoSwap / Astroport
    refId: string; // market hash (orderbook) or pool contract addr (amm/clmm)
    marketPk: number | null; // helix market id, orderbook only
    base: Asset;
    quote: Asset;
    vol24hUsd: number;
}

// One OHLCV candle, denomination-agnostic (carries both native + USD).
export interface Candle {
    t: number;
    label: string;
    open: number;
    high: number;
    low: number;
    close: number;
    highLow: [number, number];
}

// One normalized trade for the combined feed, regardless of source venue.
export interface FeedTrade {
    id: string;
    time: number;
    venue: string;
    pair: string;
    baseSymbol: string;
    side: 'buy' | 'sell';
    amountBase: number;
    priceUsd: number | null;
    valueUsd: number | null;
    trader: string | null;
    tx: string | null;
}
