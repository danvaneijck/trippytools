/**
 * Hasura persistence for claim-drop leaves and a lightweight campaign registry.
 *
 * Leaves are CONTENT-ADDRESSED BY MERKLE ROOT: the same tree always maps to the
 * same row, the `leaves_uri` is known before the create tx, and re-publishing is
 * idempotent. The claim page resolves a campaign id → root (on-chain) → leaves
 * (here), rebuilds the tree locally, and derives its own proof.
 *
 * Backing schema — `trippinj_hasura/migrations/trippinj/*_claim_drops/up.sql`,
 * tracked with insert+select permissions for the `anon` role (the same public
 * access the airdrop log uses):
 *
 *   claim_drop_leaves(root text PK, total text, leaves jsonb, created_by text,
 *                     created_at timestamptz default now())
 *   claim_drop_campaign(network text, contract text, campaign_id bigint,
 *                       root text, denom text, symbol text, decimals int,
 *                       meta jsonb, creator text, tx_hash text,
 *                       created_at timestamptz default now(),
 *                       PRIMARY KEY (network, contract, campaign_id))
 *
 * Both upserts below are ON CONFLICT DO NOTHING (`update_columns: []`). That's
 * deliberate: `anon` has no update grant, so a published row — someone else's
 * leaves, or their campaign's root/tx_hash — can never be rewritten by a later
 * insert. A conflicting insert returns `null` instead of the row.
 *
 * Leaves JSON is also served publicly at `${LEAVES_BASE}/{root}.json` (the
 * on-chain `leaves_uri`) by `claim_drops.views.LeavesJsonView` in trippinj.
 */
import { gql } from "@apollo/client";
import type { LeafInput } from "./merkle";

export const UPSERT_LEAVES = gql`
  mutation UpsertClaimDropLeaves(
    $root: String!
    $total: String!
    $leaves: jsonb!
    $created_by: String!
  ) {
    insert_claim_drop_leaves_one(
      object: { root: $root, total: $total, leaves: $leaves, created_by: $created_by }
      on_conflict: { constraint: claim_drop_leaves_pkey, update_columns: [] }
    ) {
      root
    }
  }
`;

export const INSERT_CAMPAIGN = gql`
  mutation InsertClaimDropCampaign(
    $contract: String!
    $campaign_id: bigint!
    $root: String!
    $denom: String!
    $symbol: String
    $decimals: Int
    $meta: jsonb
    $creator: String!
    $tx_hash: String
    $network: String!
  ) {
    insert_claim_drop_campaign_one(
      object: {
        contract: $contract
        campaign_id: $campaign_id
        root: $root
        denom: $denom
        symbol: $symbol
        decimals: $decimals
        meta: $meta
        creator: $creator
        tx_hash: $tx_hash
        network: $network
      }
      on_conflict: { constraint: claim_drop_campaign_pkey, update_columns: [] }
    ) {
      campaign_id
    }
  }
`;

export const GET_LEAVES_BY_ROOT = gql`
  query GetClaimDropLeaves($root: String!) {
    claim_drop_leaves_by_pk(root: $root) {
      root
      total
      leaves
    }
  }
`;

export const GET_CAMPAIGNS_BY_CREATOR = gql`
  query GetClaimDropCampaignsByCreator($creator: String!, $network: String!) {
    claim_drop_campaign(
      where: { creator: { _eq: $creator }, network: { _eq: $network } }
      order_by: { campaign_id: desc }
    ) {
      contract
      campaign_id
      root
      denom
      symbol
      decimals
      meta
      tx_hash
      created_at
    }
  }
`;

export interface LeavesRow {
    root: string;
    total: string;
    leaves: LeafInput[];
}
