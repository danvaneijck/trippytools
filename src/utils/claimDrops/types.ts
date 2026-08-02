/**
 * TypeScript mirror of the `choice-claim-drops` contract's query responses
 * (`contracts/choice_claim_drops/src/msg.rs` / `state.rs`).
 *
 * Serialization notes:
 * - `Uint128` amounts serialize as decimal STRINGS.
 * - `Timestamp` (expiry) serializes as a NANOSECOND decimal string, or null.
 * - `u64` ids serialize as JSON numbers (campaign ids stay small).
 */

export interface Config {
    owner: string;
    pending_owner: string | null;
    fee_bps: number;
    fee_collector: string;
    paused: boolean;
}

export interface Campaign {
    creator: string;
    pending_creator: string | null;
    keeper: string | null;
    streaming: boolean;
    denom: string;
    /** JSON string set by the tool: { title, symbol, decimals, description, logo }. */
    meta: string;
    leaves_uri: string;
    root: string | null;
    total: string;
    prev_root: string | null;
    prev_total: string;
    claimed_total: string;
    claimants: number;
    frozen: boolean;
    /** Nanosecond decimal string, or null for a perpetual campaign. */
    expiry: string | null;
    paused: boolean;
    swept: boolean;
}

export interface CampaignResponse {
    id: number;
    campaign: Campaign;
    remaining: string;
}

export interface ClaimEntry {
    address: string;
    claimed: string;
}

export interface ClaimsResponse {
    claims: ClaimEntry[];
}

export interface ClaimableResponse {
    valid: boolean;
    payable: string;
}

export interface ClaimedResponse {
    /** Cumulative amount this address has already taken out of the campaign. */
    claimed: string;
}

export interface FundingRequiredResponse {
    delta: string;
    fee: string;
    required: string;
    denom: string;
}

export interface LiabilitiesResponse {
    owed: string;
}

/** Decoded `meta` blob the tool writes into a campaign. */
export interface DropMeta {
    title: string;
    symbol: string;
    decimals: number;
    description?: string;
    logo?: string;
    /**
     * Who published it, when it was not a person at a keyboard. trippy-mcp
     * writes `trippy-mcp:<agent-name>` here so an agent-created drop says so on
     * its claim page. Creator-supplied text like every other meta field, so it
     * is a label, not a credential — render it, never trust it.
     */
    createdBy?: string;
}
