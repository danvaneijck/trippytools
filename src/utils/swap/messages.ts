// Aggregation execute-message builder, ported from Choice's
// useSwapForm.buildAggregateSwapMsg + the CW20 adapter helpers. Pure functions —
// the hook owns wallet/tx wiring.
import { MsgExecuteContractCompat } from '@injectivelabs/sdk-ts';
import { BigNumber } from '@injectivelabs/utils';
import { CW20_ADAPTER_ADDRESS } from './constants';
import type { HopV2, SimulatedRouteV2, Token, TokenInfo } from './types';

export function isCw20(token: string): boolean {
  // Bare CW20 contract ("inj1…") vs the native "inj" / other bank denoms.
  return token.startsWith('inj') && token !== 'inj';
}

export function buildAssetInfo(assetId: string): TokenInfo {
  return isCw20(assetId) ? { token: { contract_addr: assetId } } : { native_token: { denom: assetId } };
}

export function getAssetId(assetInfo: TokenInfo): string {
  if ('token' in assetInfo && assetInfo.token) return assetInfo.token.contract_addr;
  if ('native_token' in assetInfo && assetInfo.native_token) return assetInfo.native_token.denom;
  throw new Error('Invalid asset_info structure: could not find token or native_token.');
}

export function createTokenMap(tokens: Token[]): Map<string, Token> {
  const map = new Map<string, Token>();
  for (const token of tokens) {
    if (token.address) map.set(token.address, token);
  }
  return map;
}

export function createConvertToCw20Message(
  nativeDenom: string,
  amountOnChain: string,
  recipient: string,
) {
  return MsgExecuteContractCompat.fromJSON({
    sender: recipient,
    contractAddress: CW20_ADAPTER_ADDRESS,
    msg: { redeem_and_transfer: { recipient } },
    funds: [{ denom: nativeDenom, amount: amountOnChain }],
  });
}

export interface AggregateSwapMsg {
  executeMsg: {
    execute_route: {
      stages: { splits: { path: HopV2[]; percent: number }[] }[];
      minimum_receive: string;
    };
  };
  initialFunds: { denom: string; amount: string }[];
}

/**
 * Reconstruct the `execute_route` message + initial funds from a simulated
 * route, matching the new aggregation contract's nested stage/split/path shape.
 */
export function buildAggregateSwapMsg(
  simulatedRoute: SimulatedRouteV2,
  tokenMap: Map<string, Token>,
  minimumReceive: number | null,
): AggregateSwapMsg | null {
  if (!simulatedRoute?.simulatedStages?.length) {
    console.error('Cannot build message from empty or invalid simulated route.');
    return null;
  }

  const finalStages: { splits: { path: HopV2[]; percent: number }[] }[] = [];

  for (const stage of simulatedRoute.simulatedStages) {
    const stageSplits: { path: HopV2[]; percent: number }[] = [];

    for (const split of stage.splits) {
      const operationsPath: HopV2[] = [];

      for (const hop of split.path) {
        let operation: HopV2;

        if (hop.amm_swap) {
          const action = hop.amm_swap;
          operation = {
            amm_swap: {
              pool_address: action.pool_address,
              offer_asset_info: buildAssetInfo(getAssetId(action.offer_asset_info)),
              ask_asset_info: buildAssetInfo(getAssetId(action.ask_asset_info)),
            },
          };
        } else if (hop.orderbook_swap) {
          const action = hop.orderbook_swap;
          // New aggregation shape: emit one native op per resolved market.
          const obOps = action.ob_market_ops;
          if (!obOps?.length) {
            throw new Error('Missing resolved orderbook market(s) for the aggregation shape.');
          }
          for (const obOp of obOps) {
            operationsPath.push({
              orderbook_swap: {
                market_id: obOp.market_id,
                target_denom: obOp.target_denom,
              },
            } as unknown as HopV2);
          }
          continue;
        } else if (hop.clmm_swap) {
          const action = hop.clmm_swap;
          operation = {
            clmm_swap: {
              pool_address: action.pool_address,
              offer_asset_info: buildAssetInfo(getAssetId(action.offer_asset_info)),
              ask_asset_info: buildAssetInfo(getAssetId(action.ask_asset_info)),
            },
          };
        } else {
          continue;
        }
        operationsPath.push(operation);
      }

      stageSplits.push({ path: operationsPath, percent: split.percent });
    }

    finalStages.push({ splits: stageSplits });
  }

  // Final output asset → scale minimum_receive into base units.
  const lastStage = simulatedRoute.simulatedStages[simulatedRoute.simulatedStages.length - 1];
  const finalSplitPath = lastStage.splits[0].path;
  const finalHop = finalSplitPath[finalSplitPath.length - 1];
  const finalAction = finalHop.amm_swap || finalHop.orderbook_swap || finalHop.clmm_swap;
  if (!finalAction) throw new Error('Could not determine final hop action for route.');
  const finalAssetId = getAssetId(finalAction.ask_asset_info);
  const finalTokenInfo = tokenMap.get(finalAssetId.replace(`factory/${CW20_ADAPTER_ADDRESS}/`, ''));
  if (!finalTokenInfo) throw new Error(`Could not find final token info for asset: ${finalAssetId}`);

  const executeMsg = {
    execute_route: {
      stages: finalStages,
      minimum_receive: Math.floor((minimumReceive ?? 0) * Math.pow(10, finalTokenInfo.decimals)).toLocaleString(
        'fullwide',
        { useGrouping: false },
      ),
    },
  };

  // Native input → funds; CW20 input is sent via the token's own send message.
  const initialFunds: { denom: string; amount: string }[] = [];
  const firstStage = simulatedRoute.simulatedStages[0];
  const firstHop = firstStage.splits[0].path[0];
  const initialAction = firstHop.amm_swap || firstHop.orderbook_swap || firstHop.clmm_swap;
  if (!initialAction) throw new Error('Could not determine initial hop action for route.');
  const initialAsset = getAssetId(initialAction.offer_asset_info);
  const initialAssetId = initialAsset.replace(`factory/${CW20_ADAPTER_ADDRESS}/`, '');

  if (!isCw20(initialAssetId)) {
    const initialTokenInfo = tokenMap.get(initialAssetId);
    if (!initialTokenInfo) throw new Error(`Could not find initial token info for asset: ${initialAssetId}`);
    const initialAmountInBaseUnits = new BigNumber(simulatedRoute.amountIn)
      .shiftedBy(initialTokenInfo.decimals)
      .integerValue(BigNumber.ROUND_DOWN)
      .toFixed(0);
    initialFunds.push({ denom: initialAssetId, amount: initialAmountInBaseUnits });
  }

  return { executeMsg, initialFunds };
}

// Resolve a single hop to a human venue label. AMM hops are looked up in the
// pool→DEX map so a DojoSwap/Astroport pool isn't mislabeled as Choice; CLMM and
// orderbook hops are labeled directly.
export function hopVenueLabel(hop: HopV2, poolVenueByAddr: Map<string, string>): string {
  if (hop.amm_swap) return poolVenueByAddr.get(hop.amm_swap.pool_address) ?? 'AMM';
  if (hop.clmm_swap) return 'Choice CLMM';
  if (hop.orderbook_swap) return 'Helix Orderbook';
  return 'Swap';
}

// Ordered, de-duplicated list of venues a simulated route touches, for display.
export function routeVenueLabels(route: SimulatedRouteV2, poolVenueByAddr: Map<string, string>): string[] {
  const venues: string[] = [];
  for (const stage of route.simulatedStages) {
    for (const split of stage.splits) {
      for (const hop of split.path) {
        const v = hopVenueLabel(hop, poolVenueByAddr);
        if (!venues.includes(v)) venues.push(v);
      }
    }
  }
  return venues;
}

// Count the number of hops on the route's primary path (first split per stage).
export function routeHopCount(route: SimulatedRouteV2): number {
  return route.simulatedStages.reduce((n, stage) => n + (stage.splits[0]?.path.length ?? 0), 0);
}
