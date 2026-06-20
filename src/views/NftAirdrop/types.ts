// Shared types for the NFT airdrop tool.

/** One NFT held by the connected wallet, with best-effort display metadata. */
export interface OwnedNft {
    tokenId: string;
    name: string | null;
    image: string | null;
}

/** A planned 1-NFT-to-1-wallet assignment. */
export interface NftPair {
    tokenId: string;
    name: string | null;
    image: string | null;
    recipient: string;
}
