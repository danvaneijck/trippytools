// Minimal on-chain query layer for swap route simulation. This is the subset of
// Choice's modules/InjectiveAPI.tsx that RouteFinder + the swap hook actually
// call, ported verbatim in behavior. Mainnet-only (the trippytools swap widget
// is mainnet).
import {
  ChainGrpcWasmApi,
  ChainGrpcBankApi,
  ChainRestWasmApi,
} from '@injectivelabs/sdk-ts';
import { Buffer } from 'buffer';
import { BigNumber } from '@injectivelabs/utils';
import { NETWORKS } from '../constants';
import {
  CW20_ADAPTER_ADDRESS,
  ORDERBOOK_SWAP_ADDRESS,
} from './constants';
import type { Token, TokenInfo } from '../types';

interface SwapEndpoints {
  grpc: string;
  rest: string;
}

class SwapApi {
  endpoints: SwapEndpoints;
  chainGrpcWasmApi: ChainGrpcWasmApi;
  chainGrpcBankApi: ChainGrpcBankApi;
  chainRestWasmApi: ChainRestWasmApi;
  signal: AbortSignal | null;

  constructor(endpoints: SwapEndpoints, signal: AbortSignal | null = null) {
    this.endpoints = endpoints;
    this.signal = signal;
    this.chainGrpcWasmApi = new ChainGrpcWasmApi(endpoints.grpc);
    this.chainGrpcBankApi = new ChainGrpcBankApi(endpoints.grpc);
    this.chainRestWasmApi = new ChainRestWasmApi(endpoints.rest);
    if (signal) this.chainRestWasmApi.setConfig({ signal });
  }

  updateSignal(signal: AbortSignal | null | undefined) {
    this.signal = signal ?? null;
    this.chainRestWasmApi.setConfig({ signal: signal ?? undefined });
  }

  // CW20 balance via smart query (gRPC). Returns `{ balance: string }`.
  async queryTokenForBalance(tokenAddress: string, wallet: string): Promise<{ balance: string }> {
    const query = Buffer.from(
      JSON.stringify({ balance: { address: wallet } }),
    ).toString('base64');
    const info = await this.chainGrpcWasmApi.fetchSmartContractState(tokenAddress, query);
    return JSON.parse(new TextDecoder().decode(info.data));
  }

  // Native/bank balance for a denom.
  async getBalanceOfToken(denom: string, wallet: string): Promise<{ amount: string; denom: string }> {
    return this.chainGrpcBankApi.fetchBalance({ accountAddress: wallet, denom });
  }

  // AMM pair simulation → human-readable output amount.
  async simulatePairSwap(
    amount: number,
    offer_asset: Token,
    ask_asset: Token,
    pairAddress: string,
  ): Promise<number> {
    const offerAmount = Math.round(amount * Math.pow(10, offer_asset.decimals));
    const simulationQuery = {
      simulation: {
        offer_asset: {
          info: offer_asset.info,
          amount: offerAmount.toLocaleString('fullwide', { useGrouping: false }),
        },
      },
    };
    const query = Buffer.from(JSON.stringify(simulationQuery)).toString('base64');
    const sim = (await this.chainRestWasmApi.fetchSmartContractState(pairAddress, query)) as {
      data: unknown;
    };
    const decoded = sim.data as { return_amount: string };
    return new BigNumber(decoded.return_amount).shiftedBy(-ask_asset.decimals).toNumber();
  }

  // CLMM pool quote (base units in/out).
  async queryClmmQuote(
    poolAddress: string,
    tokenIn: TokenInfo,
    amountIn: string,
  ): Promise<{ amount_out: string; amount_in_consumed: string; fee_amount: string }> {
    const cleanTokenIn: TokenInfo =
      'native_token' in tokenIn && tokenIn.native_token
        ? { native_token: { denom: tokenIn.native_token.denom } }
        : { token: { contract_addr: (tokenIn as { token: { contract_addr: string } }).token.contract_addr } };

    const quoteQuery = { quote: { token_in: cleanTokenIn, amount_in: amountIn } };
    const query = Buffer.from(JSON.stringify(quoteQuery)).toString('base64');
    const result = (await this.chainRestWasmApi.fetchSmartContractState(poolAddress, query)) as {
      data: unknown;
    };
    return result.data as { amount_out: string; amount_in_consumed: string; fee_amount: string };
  }

  // Atomic orderbook swap simulation (base units in/out).
  async queryOrderBookSwap(
    inputDenom: string,
    outputDenom: string,
    inputAmount: number,
  ): Promise<{ result_quantity: string | number }> {
    let inputToken = inputDenom;
    let outputToken = outputDenom;
    if (inputToken.startsWith('inj') && inputToken !== 'inj') {
      inputToken = `factory/${CW20_ADAPTER_ADDRESS}/${inputToken}`;
    }
    if (outputToken.startsWith('inj') && outputToken !== 'inj') {
      outputToken = `factory/${CW20_ADAPTER_ADDRESS}/${outputToken}`;
    }
    const query = Buffer.from(
      JSON.stringify({
        get_output_quantity: {
          from_quantity: inputAmount.toLocaleString('fullwide', { useGrouping: false }),
          source_denom: inputToken,
          target_denom: outputToken,
        },
      }),
    ).toString('base64');
    const info = (await this.chainRestWasmApi.fetchSmartContractState(
      ORDERBOOK_SWAP_ADDRESS,
      query,
    )) as { data: unknown };
    return info.data as { result_quantity: string | number };
  }

  // Direct Choice AMM pair lookup for an asset pair (on-chain fallback).
  async checkForPair(assetInfos: TokenInfo[], factory: string): Promise<string | undefined> {
    const query = Buffer.from(JSON.stringify({ pair: { asset_infos: assetInfos } })).toString('base64');
    try {
      const result = await this.chainGrpcWasmApi.fetchSmartContractState(factory, query);
      const decoded = JSON.parse(new TextDecoder().decode(result.data));
      return decoded.contract_addr;
    } catch {
      // "pair not found" is an expected miss for a probe — stay quiet.
      return undefined;
    }
  }

  // Direct atomic-orderbook route lookup (on-chain fallback).
  async checkForAtomicSwapRoute(
    inputToken: Token,
    outputToken: Token,
  ): Promise<{ steps: string[] } | undefined> {
    const query = Buffer.from(
      JSON.stringify({
        get_route: { source_denom: inputToken.address, target_denom: outputToken.address },
      }),
    ).toString('base64');
    try {
      const result = await this.chainGrpcWasmApi.fetchSmartContractState(ORDERBOOK_SWAP_ADDRESS, query);
      return JSON.parse(new TextDecoder().decode(result.data));
    } catch {
      // "no swap route" is an expected miss for a probe — stay quiet.
      return undefined;
    }
  }

  // Spot market metadata (base/quote denom + tick size) for the on-chain fallback.
  async fetchSpotMarket(marketId: string): Promise<{
    base_denom: string;
    quote_denom: string;
    market_id: string;
    min_quantity_tick_size: number;
  } | null> {
    try {
      const endpoint = `https://sentry.lcd.injective.network/injective/exchange/v2/spot/markets/${marketId}`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      const j = await res.json();
      return j.market;
    } catch (e) {
      console.error(e);
      return null;
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
function build(): SwapApi {
  const net = NETWORKS.mainnet;
  return new SwapApi({ grpc: net.grpc, rest: net.rest });
}

const api = build();

export function getSwapApi(signal?: AbortSignal): SwapApi {
  if (!signal) {
    api.updateSignal(undefined);
    return api;
  }
  const net = NETWORKS.mainnet;
  return new SwapApi({ grpc: net.grpc, rest: net.rest }, signal);
}

export default SwapApi;
