// Ecosystem Explorer data model — a comparison table of every token Choice
// indexes, with per-window activity stats.
//
// Three independent sources, merged by token address so each degrades alone:
//   1. Choice GraphQL `tokens_token` + nested `analytics_tokenstats` — identity,
//      price, mcap/fdv, liquidity, price change over all five windows.
//   2. Choice GraphQL `analytics_tokenmarketstats` — cross-venue volume / swaps /
//      unique traders over 24h/7d/30d/90d (backend PR #221). Queried separately
//      so the page still renders if the field isn't deployed yet.
//   3. trippinj Hasura `token_tracker_token` — holder counts, only for tokens the
//      holder tracker has indexed (same source as the Token Holders page).

import { gql } from '@apollo/client';

export type StatWindow = '24h' | '7d' | '30d' | '90d';
export const STAT_WINDOWS: StatWindow[] = ['24h', '7d', '30d', '90d'];

export const ECOSYSTEM_TOKENS_QUERY = gql`
    query EcosystemTokens {
        tokens_token(limit: 5000) {
            address
            symbol
            name
            decimals
            logo
            show_on_ui
            stats {
                current_price_usd
                market_cap
                fdv
                total_liquidity_usd
                price_change_usd_24h
                price_change_usd_7d
                price_change_usd_30d
                price_change_usd_90d
                updated_at
            }
        }
    }
`;

// Kept separate from the token query: until the TokenMarketStats backend ships,
// this query validation-fails and the rest of the table must keep working.
export const MARKET_STATS_QUERY = gql`
    query EcosystemMarketStats {
        analytics_tokenmarketstats {
            token_id
            volume_usd_24h
            volume_usd_7d
            volume_usd_30d
            volume_usd_90d
            swaps_24h
            swaps_7d
            swaps_30d
            swaps_90d
            traders_24h
            traders_7d
            traders_30d
            traders_90d
            updated_at
        }
    }
`;

// trippinj backend (DEFAULT Apollo client, not choiceClient): per-token holder
// counts via the nested balances aggregate, for every tracked token at once.
export const HOLDER_COUNTS_QUERY = gql`
    query EcosystemHolderCounts {
        token_tracker_token {
            address
            holders_last_updated
            holder_count: balances_aggregate(where: { balance: { _gt: 0 } }) {
                aggregate {
                    count
                }
            }
        }
    }
`;

export type PerWindow = Record<StatWindow, number>;

export interface EcoTokenRow {
    address: string;
    symbol: string;
    name: string | null;
    logo: string | null;
    listed: boolean;
    priceUsd: number;
    marketCap: number;
    fdv: number;
    liquidityUsd: number;
    /** price change % keyed by window (null = not enough history) */
    change: Record<StatWindow, number | null>;
    volume: PerWindow;
    swaps: PerWindow;
    traders: PerWindow;
    holders: number | null;
    holdersUpdated: string | null;
    /** true once a TokenMarketStats row backed the volume/traders columns */
    hasMarketStats: boolean;
}

const zeroWindows = (): PerWindow => ({ '24h': 0, '7d': 0, '30d': 0, '90d': 0 });

export const buildRows = (
    tokens: any[] | undefined,
    marketStats: any[] | undefined,
    holderRows: any[] | undefined,
): EcoTokenRow[] => {
    const byAddress = new Map<string, EcoTokenRow>();

    for (const t of tokens ?? []) {
        const s = Array.isArray(t.stats) ? t.stats[0] : t.stats;
        byAddress.set(t.address, {
            address: t.address,
            symbol: t.symbol || '?',
            name: t.name ?? null,
            logo: t.logo ?? null,
            listed: !!t.show_on_ui,
            priceUsd: Number(s?.current_price_usd) || 0,
            marketCap: Number(s?.market_cap) || 0,
            fdv: Number(s?.fdv) || 0,
            liquidityUsd: Number(s?.total_liquidity_usd) || 0,
            change: {
                '24h': s?.price_change_usd_24h != null ? Number(s.price_change_usd_24h) : null,
                '7d': s?.price_change_usd_7d != null ? Number(s.price_change_usd_7d) : null,
                '30d': s?.price_change_usd_30d != null ? Number(s.price_change_usd_30d) : null,
                '90d': s?.price_change_usd_90d != null ? Number(s.price_change_usd_90d) : null,
            },
            volume: zeroWindows(),
            swaps: zeroWindows(),
            traders: zeroWindows(),
            holders: null,
            holdersUpdated: null,
            hasMarketStats: false,
        });
    }

    for (const m of marketStats ?? []) {
        const row = byAddress.get(m.token_id);
        if (!row) continue;
        row.hasMarketStats = true;
        for (const w of STAT_WINDOWS) {
            const suffix = w;
            row.volume[w] = Number(m[`volume_usd_${suffix}`]) || 0;
            row.swaps[w] = Number(m[`swaps_${suffix}`]) || 0;
            row.traders[w] = Number(m[`traders_${suffix}`]) || 0;
        }
    }

    for (const h of holderRows ?? []) {
        const row = byAddress.get(h.address);
        if (!row) continue;
        const count = h.holder_count?.aggregate?.count;
        if (count != null) {
            row.holders = Number(count);
            row.holdersUpdated = h.holders_last_updated ?? null;
        }
    }

    return [...byAddress.values()];
};
