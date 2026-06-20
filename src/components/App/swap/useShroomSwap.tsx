import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { gql, useQuery } from '@apollo/client';
import { MsgExecuteContractCompat } from '@injectivelabs/sdk-ts';
import { BigNumber } from '@injectivelabs/utils';
import { Buffer } from 'buffer';
import { toast } from 'react-toastify';
import client from '../../../utils/choiceApolloClient';
import useTokenStore from '../../../store/useTokenStore';
import useWalletStore from '../../../store/useWalletStore';
import useSwapPoolStore from '../../../store/useSwapPoolStore';
import useOrderbookRouteStore from '../../../store/useOrderbookRouteStore';
import { performTransaction } from '../../../utils/walletStrategy';
import RouteFinder from '../../../utils/swap/RouteFinder';
import { getSwapApi } from '../../../utils/swap/SwapApi';
import {
  AGGREGATION_ADDRESS,
  CW20_ADAPTER_ADDRESS,
  DEFAULT_INPUT_ADDRESS,
  DEFAULT_OUTPUT_ADDRESS,
  DEFAULT_SLIPPAGE,
  ECOSYSTEM_TOKEN_ADDRESSES,
  EXPLORER_URL,
  MAX_HOPS,
  ROUTE_FIELD,
} from '../../../utils/swap/constants';
import {
  buildAggregateSwapMsg,
  createConvertToCw20Message,
  createTokenMap,
  getAssetId,
  isCw20,
} from '../../../utils/swap/messages';
import type { RouteV2, SimulatedRouteV2, Token } from '../../../utils/swap/types';

type CalculatedRoute = (SimulatedRouteV2 & { inputTokenAmount: number }) | null;

// Backend route finder. Re-simulated client-side by RouteFinder for the exact
// quote + executable stage structure. `routes_v2` aliases findOptimalRouteV3.
const ROUTE_QUERY = gql`
  query ($input_address: String!, $output_address: String!, $amount_in: numeric!, $max_hops: numeric!) {
    routes_v2: ${ROUTE_FIELD}(asset_in: $input_address, asset_out: $output_address, amount: $amount_in, max_hops: $max_hops) {
      routes {
        est_output_amount
        stages {
          splits {
            percent
            path {
              amm_swap {
                pool_address
                offer_asset_info { native_token { denom } token { contract_addr } }
                ask_asset_info { native_token { denom } token { contract_addr } }
              }
              orderbook_swap {
                market_id
                swap_contract
                min_quantity_tick_size
                offer_asset_info { native_token { denom } token { contract_addr } }
                ask_asset_info { native_token { denom } token { contract_addr } }
              }
              clmm_swap {
                pool_address
                offer_asset_info { native_token { denom } token { contract_addr } }
                ask_asset_info { native_token { denom } token { contract_addr } }
              }
            }
          }
        }
      }
    }
  }
`;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function fetchBalance(token: Token, wallet: string): Promise<number> {
  const api = getSwapApi();
  try {
    if (isCw20(token.address)) {
      const r = await api.queryTokenForBalance(token.address, wallet);
      return new BigNumber(r.balance).shiftedBy(-token.decimals).toNumber();
    }
    const r = await api.getBalanceOfToken(token.address, wallet);
    return new BigNumber(r.amount || 0).shiftedBy(-token.decimals).toNumber();
  } catch (e) {
    console.error('balance fetch failed', token.address, e);
    return 0;
  }
}

export interface UseShroomSwap {
  tokens: Token[];
  inputToken?: Token;
  outputToken?: Token;
  inputAmount: string;
  outputAmount: number;
  minimumReceive: number | null;
  inputBalance: number;
  outputBalance: number;
  inputUsd: number;
  outputUsd: number;
  outputDifference: number | null;
  slippage: number;
  setSlippage: (s: number) => void;
  calculatedRoute: CalculatedRoute;
  progressText: string | null;
  isQuoting: boolean;
  noRoute: boolean;
  swapping: boolean;
  actionState: string;
  canSwap: boolean;
  connectedWallet: string | null;
  setInputToken: (t: Token) => void;
  setOutputToken: (t: Token) => void;
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setAmount: (v: string) => void;
  flip: () => void;
  onMax: () => void;
  onHalf: () => void;
  refresh: () => void;
  performSwap: () => Promise<void>;
}

export function useShroomSwap(): UseShroomSwap {
  const allTokens = useTokenStore((s) => s.tokens);
  const swapPools = useSwapPoolStore((s) => s.swapPools);
  const orderbookRoutes = useOrderbookRouteStore((s) => s.routes);
  const { connectedWallet, setShowWallets } = useWalletStore();

  // Curated ecosystem universe, resolved (in display order) from the token store.
  const tokens = useMemo(
    () =>
      ECOSYSTEM_TOKEN_ADDRESSES.map((addr) => allTokens.find((t) => t.address === addr)).filter(
        (t): t is Token => !!t,
      ),
    [allTokens],
  );

  const [inputToken, setInputTokenState] = useState<Token | undefined>();
  const [outputToken, setOutputTokenState] = useState<Token | undefined>();
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState(0);
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [inputBalance, setInputBalance] = useState(0);
  const [outputBalance, setOutputBalance] = useState(0);
  const [calculatedRoute, setCalculatedRoute] = useState<CalculatedRoute>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [noRoute, setNoRoute] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const debouncedAmount = useDebounce(inputAmount, 500);

  // Seed the default pair once the curated list is available.
  useEffect(() => {
    if (!tokens.length) return;
    setInputTokenState((prev) => prev ?? tokens.find((t) => t.address === DEFAULT_INPUT_ADDRESS) ?? tokens[0]);
    setOutputTokenState(
      (prev) => prev ?? tokens.find((t) => t.address === DEFAULT_OUTPUT_ADDRESS) ?? tokens[1] ?? tokens[0],
    );
  }, [tokens]);

  // ── Backend candidate routes ───────────────────────────────────────────────
  const validQuery =
    !!inputToken?.address &&
    !!outputToken?.address &&
    inputToken.address !== outputToken.address &&
    !!debouncedAmount &&
    !Number.isNaN(+debouncedAmount) &&
    Number(debouncedAmount) > 0;

  const { data: routeData, loading: routeQueryLoading } = useQuery(ROUTE_QUERY, {
    client,
    skip: !validQuery,
    // Routes are ephemeral and their AssetInfo/Hopv2 shapes are union-ish (only
    // one of native_token/token, one of amm/orderbook/clmm hop per node). Writing
    // them into the normalized cache spams "Missing field" warnings, so don't
    // cache them — we always want a fresh network quote anyway.
    fetchPolicy: 'no-cache',
    nextFetchPolicy: 'no-cache',
    pollInterval: 12000,
    variables: {
      input_address: inputToken?.address,
      output_address: outputToken?.address,
      amount_in: debouncedAmount || '0',
      max_hops: MAX_HOPS,
    },
  });

  const backendRoutes: RouteV2[] | undefined = useMemo(() => {
    const routes = routeData?.routes_v2?.routes;
    return routes && routes.length ? (routes as RouteV2[]) : undefined;
  }, [routeData]);

  // ── RouteFinder instance ───────────────────────────────────────────────────
  const rfRef = useRef<RouteFinder | null>(null);
  useEffect(() => {
    rfRef.current = new RouteFinder(allTokens, swapPools, orderbookRoutes, null, true, setProgressText);
  }, [allTokens, swapPools, orderbookRoutes]);

  // ── Simulate + pick best route ─────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!inputToken || !outputToken || inputToken.address === outputToken.address || !(Number(debouncedAmount) > 0)) {
      setCalculatedRoute(null);
      setOutputAmount(0);
      setNoRoute(false);
      return;
    }

    let cancelled = false;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    void (async () => {
      setSearching(true);
      try {
        const rf = rfRef.current;
        if (!rf) return;
        let routes = backendRoutes;
        if (!routes || routes.length === 0) {
          // The backend (findOptimalRouteV3) is the primary source. Only fall
          // back to a direct on-chain lookup once it has settled with nothing —
          // running it while the query is still in flight just spams the
          // orderbook "no route" probe on every mount/keystroke.
          if (routeQueryLoading) return;
          const onchain = await rf.findDirectOnChainRoute(inputToken, outputToken);
          routes = onchain ?? undefined;
        }
        const best = await rf.findBestRouteV2(ac.signal, () => {}, Number(debouncedAmount), routes);
        if (cancelled || ac.signal.aborted) return;
        if (best && best.finalQuote.isGreaterThan(0)) {
          setCalculatedRoute(best);
          setOutputAmount(best.finalQuote.toNumber());
          setNoRoute(false);
        } else {
          setCalculatedRoute(null);
          setOutputAmount(0);
          setNoRoute(true);
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) console.error('route search failed', e);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [inputToken, outputToken, debouncedAmount, backendRoutes, routeQueryLoading]);

  // Minimum receive derives from the quote + slippage (no re-simulation needed).
  const minimumReceive = useMemo(
    () => (outputAmount > 0 ? outputAmount - outputAmount * (slippage / 100) : null),
    [outputAmount, slippage],
  );

  // ── Balances ───────────────────────────────────────────────────────────────
  const refreshBalances = useCallback(() => {
    if (!connectedWallet) {
      setInputBalance(0);
      setOutputBalance(0);
      return;
    }
    if (inputToken) void fetchBalance(inputToken, connectedWallet).then(setInputBalance);
    if (outputToken) void fetchBalance(outputToken, connectedWallet).then(setOutputBalance);
  }, [connectedWallet, inputToken, outputToken]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // ── USD values ─────────────────────────────────────────────────────────────
  const inputUsd = useMemo(
    () => Number(inputAmount || 0) * Number(inputToken?.price ?? 0),
    [inputAmount, inputToken],
  );
  const outputUsd = useMemo(() => outputAmount * Number(outputToken?.price ?? 0), [outputAmount, outputToken]);
  const outputDifference = useMemo(() => {
    if (inputUsd > 0 && outputUsd > 0) return ((outputUsd - inputUsd) / inputUsd) * 100;
    return null;
  }, [inputUsd, outputUsd]);

  // ── Quote / button state ───────────────────────────────────────────────────
  const isQuoting =
    searching ||
    routeQueryLoading ||
    (Number(inputAmount) > 0 && Number(inputAmount) !== Number(debouncedAmount));

  const actionState = useMemo(() => {
    if (!connectedWallet) return 'Connect Wallet';
    if (!inputAmount || Number(inputAmount) <= 0) return 'Enter an amount';
    if (isQuoting) return 'Finding best route…';
    if (Number(inputBalance) < Number(inputAmount)) return 'Insufficient balance';
    if (!calculatedRoute) return 'No route found';
    return 'Swap';
  }, [connectedWallet, inputAmount, isQuoting, inputBalance, calculatedRoute]);

  const canSwap = actionState === 'Swap' || actionState === 'Connect Wallet';

  // ── Handlers ───────────────────────────────────────────────────────────────
  const onAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/,/g, '');
    if (val === '') {
      setInputAmount('');
      return;
    }
    if (val.length > 1 && val[0] === '0' && val[1] !== '.') {
      val = val.replace(/^0+/, '');
      if (val === '') val = '0';
    }
    if (/^\d*\.?\d*$/.test(val)) setInputAmount(val);
  }, []);

  const setInputToken = useCallback(
    (t: Token) => {
      if (outputToken && t.address === outputToken.address) {
        // Picking the current output as input → flip sides.
        setOutputTokenState(inputToken);
      }
      setInputTokenState(t);
    },
    [inputToken, outputToken],
  );

  const setOutputToken = useCallback(
    (t: Token) => {
      if (inputToken && t.address === inputToken.address) {
        setInputTokenState(outputToken);
      }
      setOutputTokenState(t);
    },
    [inputToken, outputToken],
  );

  const flip = useCallback(() => {
    setInputTokenState(outputToken);
    setOutputTokenState(inputToken);
    setInputAmount('');
  }, [inputToken, outputToken]);

  const onMax = useCallback(() => {
    if (!connectedWallet || !inputToken) return;
    if (inputToken.address === 'inj') {
      setInputAmount(Math.max(inputBalance - 0.02, 0).toString()); // leave gas
    } else {
      setInputAmount(inputBalance.toString());
    }
  }, [connectedWallet, inputToken, inputBalance]);

  const onHalf = useCallback(() => {
    if (!connectedWallet || !inputToken) return;
    setInputAmount((inputBalance / 2).toString());
  }, [connectedWallet, inputToken, inputBalance]);

  const refresh = useCallback(() => {
    setInputAmount((v) => v); // no-op to keep signature; poll handles freshness
    refreshBalances();
  }, [refreshBalances]);

  // ── Execute ────────────────────────────────────────────────────────────────
  const performSwap = useCallback(async () => {
    if (!connectedWallet) {
      setShowWallets(true);
      return;
    }
    if (!inputToken || !outputToken || !calculatedRoute) {
      toast.error('Missing information for swap.', { theme: 'dark' });
      return;
    }

    setSwapping(true);
    try {
      const tokenMap = createTokenMap(allTokens);
      const payload = buildAggregateSwapMsg(calculatedRoute, tokenMap, minimumReceive);
      if (!payload) {
        toast.error('Failed to construct swap message.', { theme: 'dark' });
        return;
      }
      const { executeMsg } = payload;
      const messages: MsgExecuteContractCompat[] = [];

      const firstHop = calculatedRoute.simulatedStages[0].splits[0].path[0];
      const firstOffer =
        firstHop.amm_swap?.offer_asset_info ||
        firstHop.orderbook_swap?.offer_asset_info ||
        firstHop.clmm_swap?.offer_asset_info;
      if (!firstOffer) throw new Error('Could not determine input asset.');
      const initialAssetId = getAssetId(firstOffer).replace(`factory/${CW20_ADAPTER_ADDRESS}/`, '');
      const initialTokenInfo = tokenMap.get(initialAssetId);
      if (!initialTokenInfo) throw new Error('Could not find initial token info.');

      const amountInBase = new BigNumber(calculatedRoute.amountIn)
        .shiftedBy(initialTokenInfo.decimals)
        .integerValue(BigNumber.ROUND_DOWN);

      if (isCw20(initialAssetId)) {
        const api = getSwapApi();
        const cw20Balance = await api.queryTokenForBalance(initialAssetId, connectedWallet);
        const userCw20 = new BigNumber(cw20Balance.balance);
        if (userCw20.isLessThan(amountInBase)) {
          const missing = amountInBase.minus(userCw20);
          const nativeDenom = `factory/${CW20_ADAPTER_ADDRESS}/${initialAssetId}`;
          messages.push(createConvertToCw20Message(nativeDenom, missing.toFixed(0), connectedWallet));
        }
        const encoded = Buffer.from(JSON.stringify(executeMsg)).toString('base64');
        messages.push(
          MsgExecuteContractCompat.fromJSON({
            sender: connectedWallet,
            contractAddress: initialAssetId,
            msg: { send: { contract: AGGREGATION_ADDRESS, amount: amountInBase.toFixed(0), msg: encoded } },
            funds: [],
          }),
        );
      } else {
        messages.push(
          MsgExecuteContractCompat.fromJSON({
            sender: connectedWallet,
            contractAddress: AGGREGATION_ADDRESS,
            msg: executeMsg,
            funds: payload.initialFunds,
          }),
        );
      }

      const response = await performTransaction(connectedWallet, messages);
      if (response && response.txHash) {
        toast.success(
          <div>
            Swap submitted.{' '}
            <a
              href={`${EXPLORER_URL}/transaction/${response.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Explorer
            </a>
          </div>,
          { autoClose: 6000, theme: 'dark' },
        );
        setInputAmount('');
        refreshBalances();
      } else {
        toast.error('Transaction failed or was rejected.', { theme: 'dark' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error during swap.';
      if (msg.includes('Minimum receive amount not met')) {
        toast.error('Price moved beyond your slippage tolerance. Increase slippage and retry.', {
          autoClose: 8000,
          theme: 'dark',
        });
      } else {
        console.error('swap failed', error);
        toast.error(msg, { autoClose: 7000, theme: 'dark' });
      }
    } finally {
      setSwapping(false);
    }
  }, [
    connectedWallet,
    inputToken,
    outputToken,
    calculatedRoute,
    allTokens,
    minimumReceive,
    setShowWallets,
    refreshBalances,
  ]);

  return {
    tokens,
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    minimumReceive,
    inputBalance,
    outputBalance,
    inputUsd,
    outputUsd,
    outputDifference,
    slippage,
    setSlippage,
    calculatedRoute,
    progressText,
    isQuoting,
    noRoute,
    swapping,
    actionState,
    canSwap,
    connectedWallet,
    setInputToken,
    setOutputToken,
    onAmountChange,
    setAmount: setInputAmount,
    flip,
    onMax,
    onHalf,
    refresh,
    performSwap,
  };
}
