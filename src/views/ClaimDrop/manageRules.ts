// Which management actions a campaign will actually accept, and why not.
//
// Every rule here is a restatement of one in the contract (`set_expiry`,
// `clawback`, `freeze`, `set_campaign_paused`). Duplicating them is deliberate:
// the alternative is offering a button that spends gas to discover a revert, and
// several of these actions are irreversible, so the creator needs to be told what
// they can't undo BEFORE signing rather than after.
//
// Pure and IO-free so the rules can be tested without a chain.
import type { Campaign } from "../../utils/claimDrops/types";

export interface Availability {
    enabled: boolean;
    /** User-facing explanation when disabled — mirrors the contract's error. */
    reason?: string;
}

/** 7 * 24 * 60 * 60 — the contract's MIN_WIND_DOWN_SECONDS, in ms. */
export const MIN_WIND_DOWN_MS = 7 * 24 * 60 * 60 * 1000;

const NANOS_PER_MS = 1_000_000n;

export const expiryMs = (campaign: Campaign): number | null =>
    campaign.expiry === null ? null : Number(BigInt(campaign.expiry) / NANOS_PER_MS);

export const isExpired = (campaign: Campaign, nowMs: number): boolean => {
    const at = expiryMs(campaign);
    return at !== null && nowMs >= at;
};

export interface ManageActions {
    freeze: Availability;
    /** Toggle: `paused` tells you which way. */
    pause: Availability;
    setExpiry: Availability & {
        /**
         * Earliest expiry the contract will accept, in ms — extend-only for a dated
         * campaign, now + 7 days when winding down a perpetual one. Null when the
         * action is unavailable at all.
         */
        earliestMs: number | null;
    };
    clawback: Availability & { amount: string };
    updateLeavesUri: Availability;
}

export function manageActions(
    campaign: Campaign,
    remaining: string,
    nowMs: number,
    isCreator: boolean,
): ManageActions {
    // Every one of these is `info.sender != campaign.creator → Unauthorized`.
    // Ownership of the instance grants nothing over someone else's campaign.
    const notCreator = isCreator ? undefined : "Only the campaign's creator can do this.";
    const swept = campaign.swept
        ? "This campaign was already clawed back — it's closed for good."
        : undefined;

    const expired = isExpired(campaign, nowMs);
    const dated = campaign.expiry !== null;

    const freezeReason =
        notCreator ??
        (campaign.frozen ? "Already frozen — the recipient list can never change." : undefined) ??
        (campaign.root === null ? "Nothing published yet, so there's no root to freeze." : undefined);

    let expiryReason = notCreator ?? swept;
    let earliestMs: number | null = null;
    if (!expiryReason) {
        if (dated) {
            // `expiry <= current` is rejected: an announced window only extends.
            earliestMs = (expiryMs(campaign) as number) + 1;
        } else if (campaign.frozen) {
            expiryReason =
                "This drop is frozen and perpetual — it promised recipients no deadline, " +
                "and that promise is permanent. It can never be given an expiry or clawed back.";
        } else {
            earliestMs = nowMs + MIN_WIND_DOWN_MS;
        }
    }

    const clawbackReason =
        notCreator ??
        swept ??
        (!dated
            ? "A perpetual drop has nothing to claw back — set an expiry first (7 days' notice)."
            : undefined) ??
        (!expired ? "Only after the expiry passes." : undefined);

    return {
        freeze: { enabled: !freezeReason, ...(freezeReason ? { reason: freezeReason } : {}) },
        pause: { enabled: !(notCreator ?? swept), ...((notCreator ?? swept) ? { reason: notCreator ?? swept } : {}) },
        setExpiry: {
            enabled: !expiryReason,
            ...(expiryReason ? { reason: expiryReason } : {}),
            earliestMs,
        },
        clawback: {
            enabled: !clawbackReason,
            ...(clawbackReason ? { reason: clawbackReason } : {}),
            amount: remaining,
        },
        // Allowed even when frozen, and safe: the ROOT is the commitment, so
        // re-pointing the list can only ever fix a dead host, never change who
        // gets what. It's the repair for a leaves_uri nobody can read.
        updateLeavesUri: {
            enabled: !(notCreator ?? swept),
            ...((notCreator ?? swept) ? { reason: notCreator ?? swept } : {}),
        },
    };
}

/** `<input type="date">` min attribute for the expiry picker. */
export const dateInputValue = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * A picked calendar date becomes the END of that day (23:59:59 local), so
 * "expires on the 5th" means recipients still have the 5th — and a same-day pick
 * can't land in the past and be rejected as un-extended.
 */
export const endOfDayMs = (dateIso: string): number => {
    const [y, m, d] = dateIso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 0).getTime();
};
