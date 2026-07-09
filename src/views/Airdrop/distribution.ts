// Pure allocation math for the Airdrop tool. No React, no side effects — every
// helper returns a fresh array so callers can drop the result straight into
// state. This replaces the fair/proportionate/top-N blocks that used to be
// copy-pasted (and mutated in place) across every drop mode.

import type { AirdropRecipient, DistMode, VoteFilters } from "./types";

// A tiny fraction of the entered amount is held back as a rounding buffer so the
// sum of per-recipient amounts can never exceed the sender's balance after the
// chain rounds each transfer to the token's decimals.
export const DUST_HAIRCUT = 0.00001;

// Recipients per transaction. Sized from on-chain gas simulation (2026-07-09,
// mainnet): a native/factory MsgMultiSend costs a dead-linear ~44,010 gas per
// output, so with the 1.3x airdrop gas buffer, gasWanted ≈ 57,213 · n. Measured:
//   n=1000 → 57.3M gasWanted (38% of the 150M block gas limit)  ← chosen default
//   n=1500 → 85.9M (57%)     n=2000 → 114.5M (76%)     n=2500 → 143.2M (95%)
//   n≥3000 → >150M: can never fit a block. Simulate itself also dies ~3,500.
// Hard ceiling is ~2,600 outputs. 1000 halves the tx count (a 36k drop: 74 → 37)
// while staying comfortably under any plausible node `max-tx-gas-wanted` mempool
// cap (57M is a routine Injective tx size) so chunks land first-try. Push higher
// (→1500/2000) only after confirming a run lands without bisecting — the send
// loop bisects any rejected chunk, so an over-estimate is self-correcting but
// wastes a retry round per chunk before it splits.
export const NATIVE_CHUNK_SIZE = 1000;

// CW20 transfers are one contract-execute *per recipient* (~3-4x the gas of a
// bank output), so they need a much smaller batch. Left at the previously-shipped
// value — CW20-token drops are rare (launchpad tokens are native factory denoms).
export const CW20_CHUNK_SIZE = 500;

// Back-compat default (native). Prefer chunkSizeForDenom() when the denom is known.
export const CHUNK_SIZE = NATIVE_CHUNK_SIZE;

// Native/bank denoms go out as a single MsgMultiSend; everything else (a CW20
// contract address) goes out as one execute per recipient. Mirrors the check in
// the confirm modal's send loop so the tx-count estimate matches execution.
export function isNativeDenomSend(denom: string): boolean {
    return (
        denom.includes("factory") ||
        denom.includes("peggy") ||
        denom.includes("ibc") ||
        denom === "inj"
    );
}

export function chunkSizeForDenom(denom: string): number {
    return isNativeDenomSend(denom) ? NATIVE_CHUNK_SIZE : CW20_CHUNK_SIZE;
}

export function netSupply(total: number): number {
    const n = Number(total) || 0;
    return n - n * DUST_HAIRCUT;
}

function weightOf(r: AirdropRecipient): number {
    return Number(r.balance) || 0;
}

/**
 * Recompute `amountToAirdrop` / `percentToAirdrop` for the current include set.
 * - fair: equal split across included recipients.
 * - proportionate: split by source weight (balance) across included recipients.
 */
export function allocate(
    recipients: AirdropRecipient[],
    distMode: DistMode,
    total: number,
): AirdropRecipient[] {
    const supply = netSupply(total);
    const numTotal = Number(total) || 0;
    const included = recipients.filter((r) => r.includeInDrop);

    if (distMode === "fair") {
        const per = included.length ? supply / included.length : 0;
        return recipients.map((r) =>
            r.includeInDrop
                ? {
                      ...r,
                      amountToAirdrop: per,
                      percentToAirdrop: numTotal ? (per / numTotal) * 100 : 0,
                  }
                : { ...r, amountToAirdrop: 0, percentToAirdrop: 0 },
        );
    }

    // proportionate
    const totalWeight = included.reduce((sum, r) => sum + weightOf(r), 0);
    return recipients.map((r) => {
        if (!r.includeInDrop || totalWeight === 0) {
            return { ...r, amountToAirdrop: 0, percentToAirdrop: 0, percentageHeld: 0 };
        }
        const share = weightOf(r) / totalWeight;
        return {
            ...r,
            amountToAirdrop: share * supply,
            percentToAirdrop: share * 100,
            percentageHeld: share * 100,
        };
    });
}

/** Toggle a single recipient's inclusion, then re-allocate. */
export function toggleInclude(
    recipients: AirdropRecipient[],
    address: string,
    distMode: DistMode,
    total: number,
): AirdropRecipient[] {
    const next = recipients.map((r) =>
        r.address === address ? { ...r, includeInDrop: !r.includeInDrop } : r,
    );
    return allocate(next, distMode, total);
}

/** Include/exclude every recipient, then re-allocate. */
export function setIncludeAll(
    recipients: AirdropRecipient[],
    include: boolean,
    distMode: DistMode,
    total: number,
): AirdropRecipient[] {
    const next = recipients.map((r) => ({ ...r, includeInDrop: include }));
    return allocate(next, distMode, total);
}

/** Keep only the top-N recipients by source weight (0/empty = keep all). */
export function applyTopN(
    recipients: AirdropRecipient[],
    n: number,
    distMode: DistMode,
    total: number,
): AirdropRecipient[] {
    const limit = Number(n) || 0;
    if (limit <= 0) return setIncludeAll(recipients, true, distMode, total);

    const ranked = [...recipients].sort((a, b) => weightOf(b) - weightOf(a));
    const keep = new Set(ranked.slice(0, limit).map((r) => r.address));
    const next = recipients.map((r) => ({ ...r, includeInDrop: keep.has(r.address) }));
    return allocate(next, distMode, total);
}

/** Include only recipients whose vote_option is enabled, then re-allocate. */
export function applyVoteFilter(
    recipients: AirdropRecipient[],
    voteFilters: VoteFilters,
    distMode: DistMode,
    total: number,
): AirdropRecipient[] {
    const next = recipients.map((r) => ({
        ...r,
        includeInDrop: !!voteFilters[r.vote_option as keyof VoteFilters],
    }));
    return allocate(next, distMode, total);
}

/**
 * Exclude recipients whose computed amount falls below `min`, then re-allocate
 * so the freed supply spreads across the survivors. Iterates a few times to
 * settle (re-allocating can push borderline recipients back under the floor).
 */
export function applyMinAmount(
    recipients: AirdropRecipient[],
    min: number,
    distMode: DistMode,
    total: number,
): AirdropRecipient[] {
    const floor = Number(min) || 0;
    if (floor <= 0) return allocate(recipients, distMode, total);

    let current = allocate(recipients, distMode, total);
    for (let pass = 0; pass < 5; pass++) {
        const next = current.map((r) =>
            r.includeInDrop && r.amountToAirdrop < floor
                ? { ...r, includeInDrop: false }
                : r,
        );
        const reallocated = allocate(next, distMode, total);
        const stable =
            reallocated.filter((r) => r.includeInDrop).length ===
            current.filter((r) => r.includeInDrop).length;
        current = reallocated;
        if (stable) break;
    }
    return current;
}

export interface AirdropSummary {
    recipientCount: number;
    totalOut: number;
    reserved: number;
    txCount: number;
}

/**
 * Summarise the drop for the pre-flight review: how many recipients actually
 * receive a non-zero amount (after rounding to `decimals`), how much leaves the
 * wallet, how much is held back as the rounding buffer, and how many
 * transactions it takes.
 */
export function summarize(
    recipients: AirdropRecipient[],
    total: number,
    decimals: number,
    chunkSize: number = NATIVE_CHUNK_SIZE,
): AirdropSummary {
    const paid = recipients.filter(
        (r) => r.includeInDrop && Number(Number(r.amountToAirdrop).toFixed(decimals)) > 0,
    );
    const totalOut = paid.reduce(
        (sum, r) => sum + Number(Number(r.amountToAirdrop).toFixed(decimals)),
        0,
    );
    return {
        recipientCount: paid.length,
        totalOut,
        reserved: Math.max(0, (Number(total) || 0) - totalOut),
        txCount: Math.ceil(paid.length / chunkSize),
    };
}
