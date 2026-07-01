// Shared types for the Airdrop tool.

export type DistMode = "fair" | "proportionate";

export type DropMode = "NFT" | "TOKEN" | "CSV" | "GOV" | "MITO" | "BUYBACK";

export type VoteOption =
    | "VOTE_OPTION_YES"
    | "VOTE_OPTION_ABSTAIN"
    | "VOTE_OPTION_NO"
    | "VOTE_OPTION_NO_WITH_VETO";

export type VoteFilters = Record<VoteOption, boolean>;

/**
 * One row in a planned airdrop. `balance` is the source weight (tokens held,
 * NFTs owned, LP balance, or vote weight) and is absent for raw CSV uploads.
 */
export interface AirdropRecipient {
    address: string;
    balance?: number;
    amountToAirdrop: number;
    percentToAirdrop: number;
    percentageHeld?: number;
    includeInDrop: boolean;
    vote_option?: string;
}
