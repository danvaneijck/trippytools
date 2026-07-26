// What a wallet may take out of a drop, and why not when it can't.
//
// Kept pure and IO-free so the answers can be tested without a chain: the claim
// page's whole job is to tell someone the truth about their allocation, and
// "nothing to claim" has several very different meanings (not in the drop /
// already taken / campaign closed) that must not be collapsed into one.
//
// The status order mirrors `apply_claim` in the contract (paused → swept →
// expired) so the reason shown matches the error the chain would return.
import type { Campaign } from "../../utils/claimDrops/types";
import type { DropMeta } from "../../utils/claimDrops/types";

export type DropStatus =
    | { kind: "live" }
    /** No root published yet — nothing is claimable and no proof can exist. */
    | { kind: "unpublished" }
    /** The whole instance is paused by its owner. */
    | { kind: "contract_paused" }
    | { kind: "paused" }
    /** Expired and already clawed back by the creator. */
    | { kind: "swept" }
    | { kind: "expired"; at: Date };

const NANOS_PER_MS = 1_000_000n;

export function dropStatus(campaign: Campaign, nowMs: number, contractPaused = false): DropStatus {
    if (contractPaused) return { kind: "contract_paused" };
    if (campaign.paused) return { kind: "paused" };
    if (campaign.swept) return { kind: "swept" };
    if (campaign.expiry !== null) {
        const expiryMs = BigInt(campaign.expiry) / NANOS_PER_MS;
        if (BigInt(Math.floor(nowMs)) >= expiryMs) {
            return { kind: "expired", at: new Date(Number(expiryMs)) };
        }
    }
    if (campaign.root === null) return { kind: "unpublished" };
    return { kind: "live" };
}

export type Entitlement =
    /** This wallet has no leaf in the published tree. */
    | { kind: "not_included" }
    | { kind: "claimable"; allocation: string; claimed: string; claimable: string }
    | { kind: "fully_claimed"; allocation: string; claimed: string }
    /** Owed something, but the campaign won't pay right now. */
    | { kind: "blocked"; allocation: string; claimed: string; claimable: string; status: DropStatus };

/**
 * Combine the wallet's leaf (its LIFETIME cumulative allocation) with what it has
 * already withdrawn. Amounts are base-unit decimal strings throughout — a leaf
 * hash commits to those exact bytes, so nothing here goes near a float.
 */
export function entitlement(
    leafAmount: string | null,
    claimedBase: string,
    status: DropStatus,
): Entitlement {
    if (leafAmount === null) return { kind: "not_included" };

    const allocation = BigInt(leafAmount);
    const claimed = BigInt(claimedBase);
    // Cumulative semantics: a republished root can only ever raise a leaf, but
    // clamp anyway so a hand-edited leaves file can't render a negative balance.
    const claimable = allocation > claimed ? allocation - claimed : 0n;

    if (claimable === 0n) {
        return { kind: "fully_claimed", allocation: leafAmount, claimed: claimedBase };
    }
    if (status.kind !== "live") {
        return {
            kind: "blocked",
            allocation: leafAmount,
            claimed: claimedBase,
            claimable: claimable.toString(),
            status,
        };
    }
    return {
        kind: "claimable",
        allocation: leafAmount,
        claimed: claimedBase,
        claimable: claimable.toString(),
    };
}

/**
 * Decode the campaign's `meta` blob. It's an arbitrary creator-supplied string,
 * so treat every field as untrusted: bad JSON, a JSON scalar, or a missing title
 * must degrade to a usable page rather than throw on render.
 */
export function parseMeta(meta: string): Partial<DropMeta> {
    try {
        const parsed: unknown = JSON.parse(meta);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
        const { title, symbol, decimals, description, logo } = parsed as Record<string, unknown>;
        return {
            ...(typeof title === "string" ? { title } : {}),
            ...(typeof symbol === "string" ? { symbol } : {}),
            ...(typeof decimals === "number" && Number.isInteger(decimals) && decimals >= 0 && decimals <= 30
                ? { decimals }
                : {}),
            ...(typeof description === "string" ? { description } : {}),
            ...(typeof logo === "string" ? { logo } : {}),
        };
    } catch {
        return {};
    }
}

/**
 * Which of a campaign's two live roots the published leaves reproduce.
 *
 * The contract accepts a proof against the current OR previous root (that's what
 * kills the proof-fetch race on a streaming update), so a leaves file matching
 * either is legitimately claimable. Matching neither means the document does not
 * describe this campaign, and no proof derived from it can ever be paid.
 */
export function rootMatch(
    rebuiltRoot: string,
    campaign: Campaign,
): "root" | "prev_root" | null {
    const rebuilt = rebuiltRoot.toLowerCase();
    if (campaign.root?.toLowerCase() === rebuilt) return "root";
    if (campaign.prev_root?.toLowerCase() === rebuilt) return "prev_root";
    return null;
}
