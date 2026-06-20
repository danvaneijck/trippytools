// Loads the extra Choice data the route finder needs that the existing
// Token/Pool initializers don't carry: AMM pools with their aggregation fee, and
// Helix-market-derived orderbook edges. Rendered (as null) only where the swap
// widget lives, so it doesn't fetch on every page.
import { useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import client from '../../../utils/choiceApolloClient';
import useSwapPoolStore from '../../../store/useSwapPoolStore';
import useOrderbookRouteStore from '../../../store/useOrderbookRouteStore';
import { AGGREGATION_ADDRESS, CHOICE_FACTORY_ADDRESS, CW20_ADAPTER_ADDRESS } from '../../../utils/swap/constants';
import type { OrderbookSwapRoute, Token, TokenInfo } from '../../../utils/swap/types';

// ── Routable AMM pools (Choice + tracked Dojo/Astroport) ─────────────────────
// The aggregator can route an AMM hop through any compatible pair, not just
// Choice's — so we load Choice-factory pools (for their aggregation fee) plus
// every price-tracked pool, and carry each pool's DEX name so the route view
// can label a hop as "DojoSwap"/"Astroport"/"Choice" rather than a generic AMM.
const SWAP_POOLS_QUERY = gql`
  query swapPools($factory: String!) {
    liquidity_liquiditypool(
      where: { _or: [{ dex: { factory_address: { _eq: $factory } } }, { track_price: { _eq: true } }] }
    ) {
      contract_addr
      aggregation_fee_bps
      dex {
        name
      }
    }
  }
`;

interface SwapPoolRow {
  contract_addr: string;
  aggregation_fee_bps: number | null;
  dex: { name: string | null } | null;
}

// ── Active spot Helix markets → synthetic orderbook edges ────────────────────
const HELIX_MARKETS_QUERY = gql`
  query allHelixMarkets {
    liquidity_helixmarket(where: { market_type: { _eq: "spot" }, market_status: { _eq: "active" } }) {
      market_id
      min_price_tick_size
      min_quantity_tick_size
      base_asset {
        address
        symbol
        decimals
      }
      quote_asset {
        address
        symbol
        decimals
      }
    }
  }
`;

interface HelixAssetRow {
  address: string;
  symbol: string;
  decimals: number;
}

interface HelixMarketRow {
  market_id: string;
  min_price_tick_size: string | number | null;
  min_quantity_tick_size: string | number | null;
  base_asset: HelixAssetRow | null;
  quote_asset: HelixAssetRow | null;
}

const canonicalAssetAddress = (address: string): string =>
  address.replace(`factory/${CW20_ADAPTER_ADDRESS}/`, '');

const infoForAddress = (address: string): TokenInfo =>
  address === 'inj' ||
  address.includes('peggy') ||
  address.includes('factory/') ||
  address.includes('ibc/') ||
  address.includes('erc20:')
    ? { native_token: { denom: address } }
    : { token: { contract_addr: address } };

const toRouteToken = (canonicalAddr: string, symbol: string, decimals: number): Token => ({
  name: symbol,
  symbol,
  denom: canonicalAddr,
  address: canonicalAddr,
  info: infoForAddress(canonicalAddr),
  icon: '',
  decimals,
  show_on_ui: true,
});

const routeFromHelixMarket = (m: HelixMarketRow, id: number): OrderbookSwapRoute | null => {
  if (!m.market_id || !m.base_asset?.address || !m.quote_asset?.address) return null;
  const baseAddr = canonicalAssetAddress(m.base_asset.address);
  const quoteAddr = canonicalAssetAddress(m.quote_asset.address);
  if (!baseAddr || !quoteAddr || baseAddr === quoteAddr) return null;

  return {
    id,
    atomic_swap_contract: { contract_addr: AGGREGATION_ADDRESS },
    input_token: toRouteToken(baseAddr, m.base_asset.symbol, m.base_asset.decimals),
    output_token: toRouteToken(quoteAddr, m.quote_asset.symbol, m.quote_asset.decimals),
    swap_route_helix_markets: [
      {
        order: 0,
        helix_market: {
          market_id: m.market_id,
          min_price_tick_size: m.min_price_tick_size == null ? undefined : String(m.min_price_tick_size),
          min_quantity_tick_size:
            m.min_quantity_tick_size == null ? undefined : String(m.min_quantity_tick_size),
          base_asset: toRouteToken(baseAddr, m.base_asset.symbol, m.base_asset.decimals),
          quote_asset: toRouteToken(quoteAddr, m.quote_asset.symbol, m.quote_asset.decimals),
        },
      },
    ],
  };
};

const SwapDataInit = () => {
  const setSwapPools = useSwapPoolStore((s) => s.setSwapPools);
  const setRoutes = useOrderbookRouteStore((s) => s.setRoutes);

  const { data: poolData } = useQuery(SWAP_POOLS_QUERY, {
    client,
    fetchPolicy: 'network-only',
    pollInterval: 120000,
    variables: { factory: CHOICE_FACTORY_ADDRESS },
  });

  const { data: helixData } = useQuery(HELIX_MARKETS_QUERY, {
    client,
    fetchPolicy: 'network-only',
    pollInterval: 120000,
  });

  useEffect(() => {
    const rows: SwapPoolRow[] = poolData?.liquidity_liquiditypool ?? [];
    if (!rows.length) return;
    setSwapPools(
      rows.map((p) => ({
        contract_addr: p.contract_addr,
        aggregation_fee_bps: p.aggregation_fee_bps ?? undefined,
        venue: p.dex?.name ?? undefined,
      })),
    );
  }, [poolData, setSwapPools]);

  useEffect(() => {
    const markets: HelixMarketRow[] = helixData?.liquidity_helixmarket ?? [];
    if (!markets.length) return;
    setRoutes(
      markets
        .map((m, i) => routeFromHelixMarket(m, i + 1))
        .filter((r): r is OrderbookSwapRoute => r !== null),
    );
  }, [helixData, setRoutes]);

  return null;
};

export default SwapDataInit;
