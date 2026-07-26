import type { NetworkKey } from "../../store/useNetworkStore";

/**
 * `choice-claim-drops` instance addresses, per network. Empty until the contract
 * is uploaded (with `InstantiatePermission: Everybody`) and instantiated — the
 * tool is disabled while blank. Testnet first for QA, then mainnet.
 */
export const CLAIM_DROPS_CONTRACT: Record<NetworkKey, string> = {
    mainnet: "",
    testnet: "",
};

/**
 * Public base URL that serves a drop's leaves JSON, content-addressed by merkle
 * root: `${LEAVES_BASE}/${root}.json`. This is the value written into the
 * on-chain `leaves_uri` and the drop's public audit URL.
 *
 * Served by the trippinj backend (`claim_drops.views.LeavesJsonView`) out of the
 * same `claim_drop_leaves` table the tool writes through Hasura — CORS-open and
 * cached immutably, since a root is a commitment over its own leaves. One store
 * for both networks: a root is network-independent.
 */
export const LEAVES_BASE: Record<NetworkKey, string> = {
    mainnet: "https://api.trippyinj.xyz/claim-drops/leaves",
    testnet: "https://api.trippyinj.xyz/claim-drops/leaves",
};

export const claimDropsContract = (network: NetworkKey): string =>
    CLAIM_DROPS_CONTRACT[network];

export const leavesUriForRoot = (network: NetworkKey, rootHex: string): string =>
    `${LEAVES_BASE[network]}/${rootHex}.json`;

/** ceil(total * fee_bps / 10_000) — mirrors the contract's `ceil_fee`. */
export function ceilFee(total: string, feeBps: number): string {
    if (feeBps <= 0) return "0";
    const t = BigInt(total);
    if (t === 0n) return "0";
    const num = t * BigInt(feeBps);
    const denom = 10_000n;
    return ((num + denom - 1n) / denom).toString();
}

/** Exact funds to attach when publishing `total`: total + ceil platform fee. */
export function fundingRequired(total: string, feeBps: number): string {
    return (BigInt(total) + BigInt(ceilFee(total, feeBps))).toString();
}

const NANOS_PER_SEC = 1_000_000_000n;
const NANOS_PER_MS = 1_000_000n;

export const secondsToNanos = (seconds: number): string =>
    (BigInt(Math.floor(seconds)) * NANOS_PER_SEC).toString();

export const nanosToDate = (nanos: string): Date =>
    new Date(Number(BigInt(nanos) / NANOS_PER_MS));
