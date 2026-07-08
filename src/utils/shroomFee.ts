// Shared SHROOM fee + quote helpers.
//
// The site charges a SHROOM fee for several actions (airdrops, whitelisting,
// mito market-make). SHROOM can be held either as the CW20 token or as its
// bank (factory-wrapped) denom, so these helpers:
//   1. quote a sell value via Choice's optimal router, and
//   2. build the fee messages, auto-converting bank → CW20 when the wallet's
//      CW20 balance can't cover the fee.
import { gql } from '@apollo/client';
import { MsgExecuteContractCompat } from '@injectivelabs/sdk-ts';
import { BigNumber } from '@injectivelabs/utils';
import client from './choiceApolloClient';
import { getSwapApi } from './swap/SwapApi';
import { createConvertToCw20Message } from './swap/messages';
import { CW20_ADAPTER_ADDRESS, MAX_HOPS, ROUTE_FIELD, SHROOM_CW20, USDC } from './swap/constants';

export const SHROOM_TOKEN_ADDRESS = SHROOM_CW20;
export const SHROOM_FEE_COLLECTION_ADDRESS = 'inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d';
export const SHROOM_BURN_WALLET_ADDRESS = 'inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49';

// Bank (factory-wrapped) denom the CW20 adapter mints for SHROOM.
export const SHROOM_BANK_DENOM = `factory/${CW20_ADAPTER_ADDRESS}/${SHROOM_CW20}`;

const SHROOM_DECIMALS = 18;

// Choice backend optimal-route quote. Input `amount` and `est_output_amount`
// are both human-readable (verified against the live endpoint), so quoting into
// USDC gives the dollar sell value directly.
const SELL_QUOTE_QUERY = gql`
  query ($input_address: String!, $output_address: String!, $amount_in: numeric!, $max_hops: numeric!) {
    routes: ${ROUTE_FIELD}(asset_in: $input_address, asset_out: $output_address, amount: $amount_in, max_hops: $max_hops) {
      routes {
        est_output_amount
      }
    }
  }
`;

/**
 * USD value the wallet would receive selling `shroomAmount` (human SHROOM) into
 * USDC through Choice's best route. USDC is dollar-pegged, so the top route's
 * estimated output is the USD sell value. Returns 0 for a non-positive amount
 * and null when Choice finds no route.
 */
export async function quoteShroomSellUsd(shroomAmount: number): Promise<number | null> {
  if (!(shroomAmount > 0)) return 0;
  try {
    const { data } = await client.query({
      query: SELL_QUOTE_QUERY,
      fetchPolicy: 'no-cache',
      variables: {
        input_address: SHROOM_CW20,
        output_address: USDC,
        amount_in: String(shroomAmount),
        max_hops: MAX_HOPS,
      },
    });
    const routes: { est_output_amount?: string | number }[] = data?.routes?.routes ?? [];
    if (!routes.length) return null;
    return routes.reduce((best, r) => Math.max(best, Number(r.est_output_amount) || 0), 0);
  } catch (e) {
    console.error('shroom sell quote failed', e);
    return null;
  }
}

/**
 * Ensure the wallet holds at least `requiredCw20Base` (1e18-scaled) CW20 SHROOM,
 * returning a single convert-from-bank message when the CW20 balance is short
 * (topping up the shortfall from the wallet's bank/factory-wrapped SHROOM), or
 * an empty array when no conversion is needed.
 *
 * If the CW20 balance can't be read we skip the top-up rather than convert
 * blindly — redeeming bank tokens the user may not hold would just fail the tx.
 */
export async function ensureCw20ShroomMessages(
  wallet: string,
  requiredCw20Base: BigNumber.Value,
): Promise<MsgExecuteContractCompat[]> {
  const required = new BigNumber(requiredCw20Base);
  if (!required.isFinite() || required.isLessThanOrEqualTo(0)) return [];

  let held: BigNumber;
  try {
    const bal = await getSwapApi().queryTokenForBalance(SHROOM_TOKEN_ADDRESS, wallet);
    held = new BigNumber(bal?.balance ?? 0);
  } catch (e) {
    console.error('shroom cw20 balance lookup failed', e);
    return [];
  }

  if (held.isGreaterThanOrEqualTo(required)) return [];
  const missing = required.minus(held).integerValue(BigNumber.ROUND_CEIL);
  return [createConvertToCw20Message(SHROOM_BANK_DENOM, missing.toFixed(0), wallet)];
}

/**
 * Build the SHROOM fee messages for a whole-token `shroomCost`. When `burn` is
 * set the fee splits 90% to the collector / 10% to the burn wallet (matching the
 * airdrop fee); otherwise the full amount goes to the collector. A
 * convert-from-bank message is prepended when the wallet's CW20 balance can't
 * cover the fee.
 */
export async function buildShroomFeeMessages(
  wallet: string,
  shroomCost: number,
  opts: { burn?: boolean } = {},
): Promise<MsgExecuteContractCompat[]> {
  const { burn = false } = opts;
  const totalBase = new BigNumber(shroomCost).shiftedBy(SHROOM_DECIMALS).integerValue(BigNumber.ROUND_DOWN);
  if (totalBase.isLessThanOrEqualTo(0)) return [];

  const feeBase = burn ? totalBase.times(0.9).integerValue(BigNumber.ROUND_DOWN) : totalBase;
  const burnBase = totalBase.minus(feeBase);

  const messages = await ensureCw20ShroomMessages(wallet, totalBase);

  messages.push(
    MsgExecuteContractCompat.fromJSON({
      sender: wallet,
      contractAddress: SHROOM_TOKEN_ADDRESS,
      msg: { transfer: { recipient: SHROOM_FEE_COLLECTION_ADDRESS, amount: feeBase.toFixed(0) } },
      funds: [],
    }),
  );

  if (burnBase.isGreaterThan(0)) {
    messages.push(
      MsgExecuteContractCompat.fromJSON({
        sender: wallet,
        contractAddress: SHROOM_TOKEN_ADDRESS,
        msg: { transfer: { recipient: SHROOM_BURN_WALLET_ADDRESS, amount: burnBase.toFixed(0) } },
        funds: [],
      }),
    );
  }

  return messages;
}
