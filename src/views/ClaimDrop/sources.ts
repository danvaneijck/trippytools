// Recipient sources for a claim drop — the same set the push Airdrop tool
// offers, adapted to the shape the exact allocator wants.
//
// Every fetcher already lives on TokenUtils and is shared with the airdrop; all
// this module does is normalise their various result shapes down to
// `SourceRow { address, weight }` and apply the exclusions that would otherwise
// hand an allocation to a pool contract or a burn address. Keeping that mapping
// here (rather than in the view) means the weights that feed the merkle tree are
// derived in one readable place.

import type TokenUtils from "../../modules/tokenUtils";
import type { SourceRow } from "./allocation";

export type ClaimSourceMode = "CSV" | "TOKEN" | "NFT" | "GOV" | "MITO" | "BUYBACK";

export const SOURCE_OPTIONS: { value: ClaimSourceMode; label: string }[] = [
    { value: "CSV", label: "Custom CSV file upload" },
    { value: "TOKEN", label: "Token or liquidity (LP) token holders" },
    { value: "NFT", label: "NFT community" },
    { value: "GOV", label: "Proposal voters" },
    { value: "MITO", label: "Mito vault holders / stakers" },
    { value: "BUYBACK", label: "Community BuyBack participants" },
];

/** Sources that carry a per-wallet weight, so a proportionate split is meaningful. */
export const WEIGHTED_SOURCES: ClaimSourceMode[] = ["TOKEN", "NFT", "MITO", "BUYBACK"];

// Never allocate to these: the CW20 adapter, the two burn addresses, the Mito
// module, and (added below) every known pool and token contract. They hold real
// balances but no keys that would ever claim — in a push airdrop that's wasted
// tokens, in a claim drop it's float frozen in the contract forever.
const INJ_CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk";
const DOJO_BURN_ADDRESS = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const INJ_BURN_ADDRESS = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";
const MITO_ADDRESS = "inj14vnmw2wee3xtrsqfvpcqg35jg9v7j2vdpzx0kk";

export const MITO_STAKING_CONTRACT = "inj1gtze7qm07nky47n7mwgj4zatf2s77xqvh3k2n8";

// The vault and its own staking contract hold LP on everyone's behalf.
const MITO_EXCLUDED_WALLETS = [
    MITO_STAKING_CONTRACT,
    "inj1vcqkkvqs7prqu70dpddfj7kqeqfdz5gg662qs3",
];

const isNativeDenom = (denom: string) =>
    denom.includes("factory") || denom.includes("peggy") || denom.includes("ibc") || denom === "inj";

type Progress = React.Dispatch<React.SetStateAction<string>>;

/** NFT / CW404 collection holders, weighted by how many they hold. */
export async function fetchNftHolderRows(
    module: TokenUtils,
    collectionAddress: string,
    is404: boolean,
    setProgress: Progress,
): Promise<{ rows: SourceRow[]; info: any }> {
    const info = is404
        ? await module.getCW404TokenInfo(collectionAddress)
        : await module.getNFTCollectionInfo(collectionAddress);
    const holders = is404
        ? await module.getCW404Holders(collectionAddress, setProgress)
        : await module.getNFTHolders(collectionAddress, setProgress);

    const rows: SourceRow[] = holders.map((h) => ({
        address: h.address,
        weight: Number(h.balance) || 0,
    }));
    return { rows, info };
}

/**
 * Token holders, weighted by balance. A CW20 is read twice — as the CW20 itself
 * and as its factory-wrapped denom — and the two balances summed, because the
 * same wallet can hold both halves of the same token.
 */
export async function fetchTokenHolderRows(
    module: TokenUtils,
    tokenAddress: string,
    known: { tokenAddresses: string[]; poolAddresses: string[] },
    setProgress: Progress,
): Promise<{ rows: SourceRow[]; info: any }> {
    const excluded = new Set([
        INJ_CW20_ADAPTER,
        DOJO_BURN_ADDRESS,
        INJ_BURN_ADDRESS,
        MITO_ADDRESS,
        ...known.poolAddresses,
        ...known.tokenAddresses,
    ]);

    const native = isNativeDenom(tokenAddress);
    let rows: SourceRow[];
    let info: any;

    if (native) {
        info = await module.getDenomExtraMetadata(tokenAddress);
        const holders = await module.getTokenFactoryTokenHolders(tokenAddress, setProgress);
        rows = holders
            .filter((h) => !excluded.has(h.address))
            .map((h) => ({ address: h.address, weight: Number(h.balance) || 0 }));
    } else {
        const meta = await module.getTokenInfo(tokenAddress);
        info = { ...meta, denom: tokenAddress };

        const cw20Holders = await module.getCW20TokenHolders(tokenAddress, setProgress);
        const factoryHolders = await module.getTokenFactoryTokenHolders(
            `factory/${INJ_CW20_ADAPTER}/${tokenAddress}`,
            setProgress,
        );

        const byAddress = new Map<string, number>();
        for (const { address, balance } of cw20Holders) {
            byAddress.set(address, (byAddress.get(address) ?? 0) + (Number(balance) || 0));
        }
        // The wrapped side is reported in base units; the CW20 side in whole
        // tokens, so scale before summing or the wrapper dominates the weights.
        const scale = Math.pow(10, Number(meta.decimals) || 0);
        for (const { address, balance } of factoryHolders) {
            byAddress.set(address, (byAddress.get(address) ?? 0) + (Number(balance) || 0) / scale);
        }

        rows = [...byAddress.entries()]
            .filter(([address]) => !excluded.has(address))
            .map(([address, weight]) => ({ address, weight }));
    }

    rows.sort((a, b) => b.weight - a.weight);
    return { rows, info };
}

/**
 * Everyone who voted on a proposal, as of the snapshot height.
 *
 * The weight is their voting power, but governance drops are conventionally an
 * equal split (one wallet, one share) — the view defaults these to `fair`, and
 * the weight is kept only so the table can show it.
 */
export async function fetchVoterRows(
    module: TokenUtils,
    proposalId: string,
    blockHeight: number,
    setProgress: Progress,
): Promise<SourceRow[]> {
    const voters = await module.fetchProposalVoters(proposalId, blockHeight, setProgress);
    return (voters as any[]).map((v) => ({
        address: v.address,
        weight: Number(v.weight) || 0,
        ...(v.vote_option ? { voteOption: v.vote_option as string } : {}),
    }));
}

/** Mito vault LP holders, either staked-only or every holder. */
export async function fetchMitoRows(
    module: TokenUtils,
    vaultAddress: string,
    holderType: "stake" | "non-stake",
    setProgress: Progress,
): Promise<SourceRow[]> {
    const holders = await module.fetchMitoVaultHolders(
        vaultAddress,
        MITO_STAKING_CONTRACT,
        setProgress,
    );
    return holders
        .filter((h) => !MITO_EXCLUDED_WALLETS.includes(h.holderAddress))
        .map((h) => ({
            address: h.holderAddress,
            weight: Number(holderType === "stake" ? h.stakedAmount : h.amount) || 0,
        }));
}

/** Community BuyBack committers for one round, weighted by INJ committed. */
export async function fetchBuybackRows(
    module: TokenUtils,
    round: number,
    expectedTotalInj: number | undefined,
    setProgress: Progress,
): Promise<SourceRow[]> {
    const participants = await module.fetchBuybackParticipants(round, expectedTotalInj, setProgress);
    return (participants as any[])
        .map((p) => ({ address: p.address, weight: Number(p.deposit) || 0 }))
        .sort((a, b) => b.weight - a.weight);
}
