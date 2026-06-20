// Choice Exchange swap/aggregation config (mainnet).
//
// trippytools talks to Choice's production Hasura (VITE_CHOICE_URL) for route
// finding and uses Choice's deployed mainnet contracts for execution. These
// values mirror choice_exchange_app/.env.mainnet — keep them in sync if Choice
// redeploys. The swap widget is mainnet-only by design (the trippytools site is
// a mainnet tool), so unlike Choice these are hardcoded rather than env-driven.

export const AGGREGATION_ADDRESS = 'inj1520rsss9aykhkfmuf89nh5hp2jww770z4u3eu0';
export const CHOICE_FACTORY_ADDRESS = 'inj1k9lcqtn3y92h4t3tdsu7z8qx292mhxhgsssmxg';
export const CHOICE_ROUTER_ADDRESS = 'inj1ne2durmsx2jurvy4wgnhegv3xt6789up8xgum3';
export const ORDERBOOK_SWAP_ADDRESS = 'inj1tcl59pywlnkjgx33pempyluy8fyunmp02jdn6a';
export const CW20_ADAPTER_ADDRESS = 'inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk';
export const CLMM_FACTORY_ADDRESS = 'inj1k58yqvsww97asl6eajx0lja6np03naddfc6cs7';

// New aggregation shape: orderbook hops are native `{ market_id, target_denom }`
// ops resolved by the contract; the router chains single Helix markets. Matches
// VITE_USE_NEW_AGGREGATION_SHAPE=true on mainnet.
export const USE_NEW_AGGREGATION_SHAPE = true;

// V3 backend route finder (Helix-market-derived single-hop edges).
export const USE_V3_ROUTING = true;
export const ROUTE_FIELD = USE_V3_ROUTING ? 'findOptimalRouteV3' : 'findOptimalRoute';

// Max hops the backend route finder may chain. Choice derives this per-wallet;
// 3 is the standard default and is plenty for the SHROOM ecosystem pairs.
export const MAX_HOPS = 3;

// Canonical mainnet quote-asset denoms.
export const INJ = 'inj';
export const USDC = 'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a';
export const USDT = 'peggy0xdAC17F958D2ee523a2206206994597C13D831ec7';

// SHROOM ecosystem tokens.
export const SHROOM_CW20 = 'inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8';
export const SAI_DENOM = 'factory/inj10aa0h5s0xwzv95a8pjhwluxcm5feeqygdk3lkm/SAI';

// Curated swap universe (the "SHROOM ecosystem only" token set). Addresses are
// the canonical `tokens_token.address` values from the Choice token list, so the
// widget resolves each entry directly out of the existing token store. Order is
// the display order in the picker.
export const ECOSYSTEM_TOKEN_ADDRESSES: string[] = [
  SHROOM_CW20,
  SAI_DENOM,
  INJ,
  USDC,
  USDT,
];

// Default pair the widget opens on: buy SHROOM with INJ.
export const DEFAULT_INPUT_ADDRESS = INJ;
export const DEFAULT_OUTPUT_ADDRESS = SHROOM_CW20;

// Slippage options (percent) offered in the settings popover.
export const SLIPPAGE_PRESETS = [0.5, 1, 2, 5];
export const DEFAULT_SLIPPAGE = 1;

export const EXPLORER_URL = 'https://injscan.com';

// Deep link to Choice's full swap UI for features the embed doesn't cover.
export const choiceSwapUrl = (inputAddr: string, outputAddr: string) =>
  `https://choice.exchange/swap?input=${encodeURIComponent(inputAddr)}&output=${encodeURIComponent(outputAddr)}&volumeSplitting=true`;
