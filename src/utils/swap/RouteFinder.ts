// Ported from Choice's modules/RouteFinder.tsx. Takes candidate routes from the
// backend route finder and simulates each one hop-by-hop on-chain (AMM pair
// simulation, CLMM quote, orderbook get_output_quantity) to pick the best and
// produce the exact stage/split structure the aggregation contract executes.
import {
  CHOICE_FACTORY_ADDRESS,
  CW20_ADAPTER_ADDRESS,
  ORDERBOOK_SWAP_ADDRESS,
  USE_NEW_AGGREGATION_SHAPE,
} from './constants';
import type {
  HopV2,
  OrderbookMarketOp,
  OrderbookSwapRoute,
  RouteV2,
  SimulatedHopV2,
  SimulatedRouteV2,
  SimulatedStageV2,
  SwapPool,
  Token,
  TokenInfo,
} from './types';
import { getSwapApi } from './SwapApi';
import { BigNumber } from '@injectivelabs/utils';

export interface BufferErrorInfo {
  inputTokenAmount?: number | string;
  message: string;
}

export type SetBufferErrorFn = (error: BufferErrorInfo) => void;
export type SetProgressTextFn = (text: string | null) => void;

class RouteFinder {
  tokens: Token[];
  pools: SwapPool[];
  orderbookRoutes: OrderbookSwapRoute[];
  signal: AbortSignal | null;
  multiHops: boolean;
  volumeSplitting: boolean;
  setProgressText: SetProgressTextFn;

  constructor(
    tokens: Token[],
    liquidityPools: SwapPool[],
    orderbookRoutes: OrderbookSwapRoute[],
    signal: AbortSignal | null = null,
    volumeSplitting = false,
    setProgressText: SetProgressTextFn = () => {},
  ) {
    this.tokens = tokens;
    this.pools = liquidityPools;
    this.orderbookRoutes = orderbookRoutes;
    this.signal = signal;
    this.multiHops = true;
    this.volumeSplitting = volumeSplitting;
    this.setProgressText = setProgressText;
  }

  // On-chain fallback used when the backend returns no indexed route.
  public async findDirectOnChainRoute(
    inputToken: Token,
    outputToken: Token,
  ): Promise<RouteV2[] | null> {
    const api = getSwapApi();
    const routes: RouteV2[] = [];

    try {
      const factory = CHOICE_FACTORY_ADDRESS;
      const pairAddress = await api.checkForPair([inputToken.info, outputToken.info], factory);
      const swapRoute = await api.checkForAtomicSwapRoute(inputToken, outputToken);

      if (pairAddress) {
        const path = [
          {
            amm_swap: {
              ask_asset_info: outputToken.info,
              offer_asset_info: inputToken.info,
              pool_address: pairAddress,
            },
          },
        ];
        routes.push({ stages: [{ splits: [{ path, percent: 100 }] }] });
      }
      if (swapRoute && swapRoute.steps.length > 0) {
        let minSize = 1;
        const stepMarkets = await Promise.all(
          swapRoute.steps.map((step: string) => api.fetchSpotMarket(step)),
        );
        const market = stepMarkets[0];
        if (market) {
          if (inputToken.address === market.base_denom) {
            minSize = market.min_quantity_tick_size * Math.pow(10, inputToken.decimals);
          }
        }

        let obMarketOps: OrderbookMarketOp[] | undefined;
        if (USE_NEW_AGGREGATION_SHAPE && stepMarkets.every(Boolean)) {
          const ops: OrderbookMarketOp[] = [];
          let current = this._denomForToken(inputToken.address);
          for (const m of stepMarkets) {
            if (!m) {
              ops.length = 0;
              break;
            }
            const out =
              current === m.base_denom
                ? m.quote_denom
                : current === m.quote_denom
                  ? m.base_denom
                  : null;
            if (!out || !m.market_id) {
              ops.length = 0;
              break;
            }
            ops.push({ market_id: m.market_id, target_denom: out });
            current = out;
          }
          if (ops.length) obMarketOps = ops;
        }

        const path = [
          {
            orderbook_swap: {
              ask_asset_info: outputToken.info,
              offer_asset_info: inputToken.info,
              swap_contract: ORDERBOOK_SWAP_ADDRESS,
              min_quantity_tick_size: minSize.toFixed(0),
              ob_market_ops: obMarketOps,
            },
          },
        ];
        routes.push({ stages: [{ splits: [{ path, percent: 100 }] }] });
      }

      return routes.length > 0 ? routes : null;
    } catch (error) {
      console.error('Error during on-chain route search:', error);
      return null;
    }
  }

  public async findBestRouteV2(
    signal: AbortSignal,
    setBufferError: SetBufferErrorFn,
    inputTokenAmount: number,
    backendRoutes: RouteV2[] | undefined,
  ): Promise<(SimulatedRouteV2 & { inputTokenAmount: number }) | null> {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    this.signal = signal;
    getSwapApi().updateSignal(signal);

    if (!backendRoutes || backendRoutes.length === 0) {
      return null;
    }

    this.setProgressText(`Quoting ${backendRoutes.length} routes...`);

    const tokenMap = new Map<string, Token>(this.tokens.map((t) => [t.address || t.denom, t]));
    const initialAmount = new BigNumber(inputTokenAmount);

    const quotePromises = backendRoutes.map((route) =>
      this.fetchStagedRouteQuote(route, initialAmount, tokenMap, setBufferError),
    );

    const quoteResults = await Promise.allSettled(quotePromises);

    const validQuotes = quoteResults
      .filter(
        (result): result is PromiseFulfilledResult<SimulatedRouteV2> =>
          result.status === 'fulfilled' &&
          !!result.value &&
          result.value.finalQuote.isGreaterThan(0),
      )
      .map((result) => result.value)
      .sort((a, b) => b.finalQuote.minus(a.finalQuote).toNumber());

    this.setProgressText(`Found ${validQuotes.length} valid quotes.`);

    if (validQuotes.length === 0) {
      this.setProgressText(null);
      return null;
    }

    const bestQuote = validQuotes[0];
    this.setProgressText(null);

    if (signal.aborted) throw new DOMException('aborted', 'AbortError');

    return { inputTokenAmount, ...bestQuote };
  }

  _getAssetId(assetInfo: TokenInfo): string {
    if ('token' in assetInfo && assetInfo.token) {
      return assetInfo.token.contract_addr;
    }
    if ('native_token' in assetInfo && assetInfo.native_token) {
      return assetInfo.native_token.denom;
    }
    throw new Error('Invalid asset_info structure: could not find token or native_token.');
  }

  private _denomForToken(addr: string): string {
    const bare = addr.replace(`factory/${CW20_ADAPTER_ADDRESS}/`, '');
    return bare.startsWith('inj') && bare !== 'inj'
      ? `factory/${CW20_ADAPTER_ADDRESS}/${bare}`
      : bare;
  }

  private _resolveOrderbookOps(
    offerInfo: TokenInfo,
    askInfo: TokenInfo,
  ): OrderbookMarketOp[] | undefined {
    const adapterPrefix = `factory/${CW20_ADAPTER_ADDRESS}/`;
    const offerAddr = this._getAssetId(offerInfo).replace(adapterPrefix, '');
    const askAddr = this._getAssetId(askInfo).replace(adapterPrefix, '');

    const route = this.orderbookRoutes.find((r) => {
      const input = r.input_token.address;
      const output = r.output_token.address;
      return (input === offerAddr && output === askAddr) || (input === askAddr && output === offerAddr);
    });
    if (!route || !route.swap_route_helix_markets?.length) return undefined;

    const sorted = [...route.swap_route_helix_markets].sort((a, b) => a.order - b.order);
    const forward = route.input_token.address === offerAddr;
    const ordered = forward ? sorted : [...sorted].reverse();

    const ops: OrderbookMarketOp[] = [];
    let current = offerAddr;
    for (const entry of ordered) {
      const market = entry.helix_market;
      const base = market.base_asset?.address;
      const quote = market.quote_asset?.address;
      if (!base || !quote || !market.market_id) return undefined;
      const out = current === base ? quote : base;
      ops.push({ market_id: market.market_id, target_denom: this._denomForToken(out) });
      current = out;
    }
    return ops;
  }

  private _enrichHopForNewShape(hop: HopV2): HopV2 {
    if (!USE_NEW_AGGREGATION_SHAPE || !hop.orderbook_swap || hop.orderbook_swap.ob_market_ops) {
      return hop;
    }
    const action = hop.orderbook_swap;

    if (action.market_id) {
      const adapterPrefix = `factory/${CW20_ADAPTER_ADDRESS}/`;
      const askAddr = this._getAssetId(action.ask_asset_info).replace(adapterPrefix, '');
      const ob_market_ops: OrderbookMarketOp[] = [
        { market_id: action.market_id, target_denom: this._denomForToken(askAddr) },
      ];
      return { ...hop, orderbook_swap: { ...action, ob_market_ops } };
    }

    const ob_market_ops = this._resolveOrderbookOps(action.offer_asset_info, action.ask_asset_info);
    if (!ob_market_ops) {
      console.warn('Could not resolve orderbook market ops for new aggregation shape:', action);
      return hop;
    }
    return { ...hop, orderbook_swap: { ...action, ob_market_ops } };
  }

  async fetchStagedRouteQuote(
    route: RouteV2,
    initialAmount: BigNumber,
    tokens: Map<string, Token>,
    setBufferError: SetBufferErrorFn,
  ): Promise<SimulatedRouteV2 | null> {
    try {
      let currentInputAmount = initialAmount;
      const finalSimulatedStages: SimulatedStageV2[] = [];

      const totalStages = route.stages.length;
      if (totalStages === 0) {
        return null;
      }

      for (const stage of route.stages) {
        const splitDetailPromises = stage.splits.map(async (split) => {
          const splitInitialAmount = currentInputAmount.times(split.percent).div(100);

          let pathInputAmount = splitInitialAmount;
          const simulatedPath: SimulatedHopV2[] = [];

          for (const hop of split.path) {
            const hopOutputAmount = await this._simulateSingleHop(hop, pathInputAmount, tokens);
            simulatedPath.push({
              ...this._enrichHopForNewShape(hop),
              amountIn: pathInputAmount.toString(),
              amountOut: hopOutputAmount.toString(),
            });
            pathInputAmount = hopOutputAmount;
          }

          const splitOutputAmount = pathInputAmount;
          return {
            ...split,
            path: simulatedPath,
            amountIn: splitInitialAmount,
            amountOut: splitOutputAmount,
          };
        });

        const simulatedSplits = await Promise.all(splitDetailPromises);

        const stageOutputAmount = simulatedSplits.reduce(
          (sum, currentSplit) => sum.plus(currentSplit.amountOut),
          new BigNumber(0),
        );

        if (stageOutputAmount.isZero() && !currentInputAmount.isZero()) {
          console.warn('A stage resulted in zero output, aborting quote for this route.', stage);
          return null;
        }

        finalSimulatedStages.push({
          ...stage,
          splits: simulatedSplits,
          totalInputForStage: currentInputAmount.toString(),
          totalOutputFromStage: stageOutputAmount.toString(),
        });

        currentInputAmount = stageOutputAmount;
      }

      const finalQuote = currentInputAmount;
      return { amountIn: initialAmount, finalQuote, simulatedStages: finalSimulatedStages };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error quoting staged route:', message, route);
      if (message.includes('Swap amount too high')) {
        setBufferError({ message: 'WARNING: Buffer limit exceeded, swap may not be optimal.' });
      }
      return null;
    }
  }

  private async _simulateSingleHop(
    hop: HopV2,
    amountIn: BigNumber,
    tokens: Map<string, Token>,
  ): Promise<BigNumber> {
    if (amountIn.isZero() || amountIn.isNaN() || amountIn.isLessThan(0)) {
      return new BigNumber(0);
    }

    const api = getSwapApi();

    // AMM
    if (hop.amm_swap) {
      const action = hop.amm_swap;
      const offerAssetId = this._getAssetId(action.offer_asset_info);
      const askAssetId = this._getAssetId(action.ask_asset_info);
      const offerToken = tokens.get(offerAssetId);
      const askToken = tokens.get(askAssetId);
      if (!offerToken || !askToken) {
        throw new Error(`Token info missing for AMM swap: ${offerAssetId} -> ${askAssetId}`);
      }

      const grossOutputString = await api.simulatePairSwap(
        amountIn.toNumber(),
        offerToken,
        askToken,
        action.pool_address,
      );
      let finalOutput = new BigNumber(grossOutputString);

      const matchingPool = this.pools.find((pool) => pool.contract_addr === action.pool_address);
      if (matchingPool && matchingPool.aggregation_fee_bps && matchingPool.aggregation_fee_bps > 0) {
        const feeMultiplier = new BigNumber(matchingPool.aggregation_fee_bps).div(10000);
        finalOutput = finalOutput.minus(finalOutput.times(feeMultiplier));
      }
      return finalOutput;
    }

    // Orderbook
    if (hop.orderbook_swap) {
      const adapterPrefix = `factory/${CW20_ADAPTER_ADDRESS}/`;
      const action = hop.orderbook_swap;
      const offerAssetId = this._getAssetId(action.offer_asset_info);
      const askAssetId = this._getAssetId(action.ask_asset_info);
      const offerToken = tokens.get(offerAssetId.replace(adapterPrefix, ''));
      const askToken = tokens.get(askAssetId.replace(adapterPrefix, ''));
      if (!offerToken || !askToken) {
        throw new Error(`Token info missing for Orderbook swap: ${offerAssetId} -> ${askAssetId}`);
      }

      let adjustedAmountIn = amountIn;
      const matchingRoute = this.orderbookRoutes.find((route) => {
        const inputAddr = route.input_token.address;
        const outputAddr = route.output_token.address;
        return (
          (inputAddr === offerToken.address && outputAddr === askToken.address) ||
          (inputAddr === askToken.address && outputAddr === offerToken.address)
        );
      });

      if (matchingRoute && matchingRoute.swap_route_helix_markets?.length > 0) {
        const marketInfo = matchingRoute.swap_route_helix_markets[0].helix_market;
        if (marketInfo.base_asset?.address === offerToken.address) {
          const minQuantityTickSize = new BigNumber(marketInfo.min_quantity_tick_size ?? '');
          if (minQuantityTickSize.isGreaterThan(0)) {
            adjustedAmountIn = amountIn
              .div(minQuantityTickSize)
              .integerValue(BigNumber.ROUND_DOWN)
              .times(minQuantityTickSize);
          }
        } else if (marketInfo.quote_asset?.address === offerToken.address) {
          const minPriceTickSize = new BigNumber(marketInfo.min_price_tick_size ?? '');
          if (minPriceTickSize.isGreaterThan(0)) {
            adjustedAmountIn = amountIn
              .div(minPriceTickSize)
              .integerValue(BigNumber.ROUND_DOWN)
              .times(minPriceTickSize);
          }
        }
      }
      const amountInBaseUnits = adjustedAmountIn.shiftedBy(offerToken.decimals);
      if (amountInBaseUnits.isZero()) {
        return new BigNumber(0);
      }

      const result = await api.queryOrderBookSwap(
        offerAssetId,
        askAssetId,
        amountInBaseUnits.toNumber(),
      );
      return new BigNumber(result.result_quantity).shiftedBy(-askToken.decimals);
    }

    // CLMM
    if (hop.clmm_swap) {
      const action = hop.clmm_swap;
      const offerAssetId = this._getAssetId(action.offer_asset_info);
      const askAssetId = this._getAssetId(action.ask_asset_info);
      const offerToken = tokens.get(offerAssetId);
      const askToken = tokens.get(askAssetId);
      if (!offerToken || !askToken) {
        throw new Error(`Token info missing for CLMM swap: ${offerAssetId} -> ${askAssetId}`);
      }

      const amountInBaseUnits = amountIn
        .shiftedBy(offerToken.decimals)
        .integerValue(BigNumber.ROUND_DOWN)
        .toFixed(0);
      if (amountInBaseUnits === '0') {
        return new BigNumber(0);
      }

      const quoteResult = await api.queryClmmQuote(
        action.pool_address,
        action.offer_asset_info,
        amountInBaseUnits,
      );
      return new BigNumber(quoteResult.amount_out).shiftedBy(-askToken.decimals);
    }

    throw new Error('Unknown or unsupported hop type in route path');
  }
}

export default RouteFinder;
