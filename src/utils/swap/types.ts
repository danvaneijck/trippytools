// Swap/route types, ported from Choice's utils/types.tsx (the subset the route
// finder + aggregation message builder actually use). Token / TokenInfo are
// reused from trippytools' existing token model.
import type { BigNumber } from '@injectivelabs/utils';
import type { Token, TokenInfo } from '../types';

export type { Token, TokenInfo };

// ── Native orderbook op (new aggregation shape) ──────────────────────────────
export interface OrderbookMarketOp {
  market_id: string;
  target_denom: string;
}

// ── Hop payloads ─────────────────────────────────────────────────────────────
export interface AmmSwapPayload {
  pool_address: string;
  offer_asset_info: TokenInfo;
  ask_asset_info: TokenInfo;
}

export interface OrderbookSwapPayload {
  // Backend-provided spot market for a single-market hop (V3 routing).
  market_id?: string;
  swap_contract: string;
  min_quantity_tick_size: string;
  offer_asset_info: TokenInfo;
  ask_asset_info: TokenInfo;
  // Filled by RouteFinder when USE_NEW_AGGREGATION_SHAPE is on.
  ob_market_ops?: OrderbookMarketOp[];
}

export interface ClmmSwapPayload {
  pool_address: string;
  offer_asset_info: TokenInfo;
  ask_asset_info: TokenInfo;
}

export interface HopV2 {
  amm_swap?: AmmSwapPayload;
  orderbook_swap?: OrderbookSwapPayload;
  clmm_swap?: ClmmSwapPayload;
}

export interface RouteV2Split {
  percent: number;
  path: HopV2[];
}

export interface RouteV2Stage {
  splits: RouteV2Split[];
}

export interface RouteV2 {
  est_output_amount?: string | number;
  stages: RouteV2Stage[];
}

// ── Orderbook routes (Helix-market-derived edges) ────────────────────────────
export interface HelixMarket {
  market_id: string;
  base_asset?: Token;
  quote_asset?: Token;
  min_quantity_tick_size?: string;
  min_price_tick_size?: string;
}

export interface SwapRouteHelixMarket {
  order: number;
  helix_market: HelixMarket;
}

export interface OrderbookSwapRoute {
  id: number;
  atomic_swap_contract: { contract_addr: string };
  input_token: Token;
  output_token: Token;
  swap_route_helix_markets: SwapRouteHelixMarket[];
}

// ── Pools the route finder needs (address + aggregation fee + DEX name) ──────
export interface SwapPool {
  contract_addr: string;
  aggregation_fee_bps?: number;
  // The DEX this pool belongs to (from Hasura `dex.name`), e.g. "Choice",
  // "DojoSwap", "Astroport". Used to label AMM hops in the route view.
  venue?: string;
}

// ── Simulated route shapes (RouteFinder output) ──────────────────────────────
export interface SimulatedHopV2 extends HopV2 {
  amountIn: string;
  amountOut: string;
}

export interface SimulatedSplitV2 {
  percent: number;
  path: SimulatedHopV2[];
  amountIn: BigNumber;
  amountOut: BigNumber;
}

export interface SimulatedStageV2 {
  splits: SimulatedSplitV2[];
  totalInputForStage: string;
  totalOutputFromStage: string;
}

export interface SimulatedRouteV2 {
  amountIn: BigNumber;
  finalQuote: BigNumber;
  simulatedStages: SimulatedStageV2[];
}
