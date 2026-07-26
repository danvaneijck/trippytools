import type { NetworkKey } from "../../store/useNetworkStore";

/**
 * `choice-claim-drops` instance addresses, per network. Empty until the contract
 * is uploaded (with `InstantiatePermission: Everybody`) and instantiated — the
 * tool is disabled while blank. Testnet first for QA, then mainnet.
 */
export const CLAIM_DROPS_CONTRACT: Record<NetworkKey, string> = {
    // code id 2066 (InstantiatePermission: Everybody), fee_bps 0, owner
    // inj1q2m26…jgz, fee_collector = Choice treasury inj1c2yleau…6zv4, wasm
    // admin = Choice Admin Timelock inj14tm9kjh… (48h queued migrations).
    // Deployed 2026-07-27.
    mainnet: "inj1nwqzch964chy8k0ptnajm3pa6907s5yhflw82n",
    // code id 39733 (InstantiatePermission: Everybody), fee_bps 0, owner +
    // fee_collector inj1q2m26…jgz. Deployed 2026-07-26 for the end-to-end QA run.
    testnet: "inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53",
};

const LEAVES_BASE_DEFAULT = "https://api.trippyinj.xyz/claim-drops/leaves";

/**
 * Testnet-only override, for QA against a locally-run trippinj
 * (`VITE_CLAIM_DROPS_LEAVES_BASE="http://localhost:9000/claim-drops/leaves"`) so
 * test rows never touch the production table.
 *
 * Deliberately NOT honoured on mainnet. This string is written ON-CHAIN as the
 * campaign's `leaves_uri` and a one-shot drop freezes on its first publish, so a
 * stray override reaching production would mint immutable drops pointing at a
 * host nobody can read — unclaimable, unfixable. Gating it to testnet means the
 * override lives in a gitignored `.env` and still cannot break mainnet.
 *
 * Optional-chained because this module is also imported by node scripts (smoke
 * tests), where `import.meta.env` doesn't exist.
 */
const leavesBaseOverride = import.meta.env?.VITE_CLAIM_DROPS_LEAVES_BASE as string | undefined;

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
    mainnet: LEAVES_BASE_DEFAULT,
    testnet: leavesBaseOverride || LEAVES_BASE_DEFAULT,
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
