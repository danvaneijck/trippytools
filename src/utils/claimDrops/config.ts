import type { NetworkKey } from "../../store/useNetworkStore";

/**
 * A `choice-claim-drops` instance this tool is allowed to talk to.
 *
 * Anyone can instantiate code 2066, so this registry is an **allowlist**, not a
 * convenience list. Every path that turns user input into a contract address
 * (today: the `?c=` on a claim link) resolves through it, so a stranger can
 * never get their own instance rendered inside trippytools' chrome — which would
 * be a ready-made phishing page, complete with a real working claim button.
 *
 * Keyed by ROLE rather than by address so the same key names the equivalent
 * instance on both networks; the per-network address is the thing that varies.
 */
export type InstanceKey = "public" | "rewards";

export interface ClaimDropInstance {
    label: string;
    /** One line, shown under the picker — says who owns it and what it's for. */
    note: string;
    /** Per-network address. Empty string = not deployed there yet. */
    address: Record<NetworkKey, string>;
}

export const CLAIM_DROPS_INSTANCES: Record<InstanceKey, ClaimDropInstance> = {
    public: {
        label: "Public drops",
        note: "The shared instance — anyone may create a one-shot drop on it.",
        address: {
            // code id 2066 (InstantiatePermission: Everybody), fee_bps 0, owner
            // inj1q2m26…jgz, fee_collector = Choice treasury inj1c2yleau…6zv4,
            // wasm admin = Choice Admin Timelock inj14tm9kjh… (48h queued
            // migrations). Deployed 2026-07-27.
            mainnet: "inj1nwqzch964chy8k0ptnajm3pa6907s5yhflw82n",
            // code id 39733, fee_bps 0, owner + fee_collector inj1q2m26…jgz.
            // Deployed 2026-07-26 for the end-to-end QA run.
            testnet: "inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53",
        },
    },
    rewards: {
        label: "Trippy Terminal rewards",
        note: "Powers the terminal's Rewards page. Drops here are indexed by Choice but never listed there.",
        address: {
            // ⚠️ FILL IN AT INSTANTIATE TIME, then commit — deliberately not an
            // env var. On mainnet a wrong address here funds a STRANGER'S
            // instance with real money, and the create flow freezes a one-shot
            // drop the moment it publishes, so there is no undo. A reviewed
            // one-line commit is the right amount of friction for that.
            // See trippy_terminal/docs/PLAN_rewards_missions.md §6.
            mainnet: "",
            testnet: "",
        },
    },
};

/**
 * The instance a bare `/claim/:id` and a fresh create flow mean.
 *
 * Must stay `public`: every drop created before the registry existed lives
 * there, and their links carry no instance at all.
 */
export const DEFAULT_INSTANCE: InstanceKey = "public";

/** Address of one instance on one network, or "" when not deployed there. */
export const instanceAddress = (key: InstanceKey, network: NetworkKey): string =>
    CLAIM_DROPS_INSTANCES[key].address[network] ?? "";

/** Instances actually deployed on `network`, in picker order. */
export function listInstances(
    network: NetworkKey,
): { key: InstanceKey; address: string; label: string; note: string }[] {
    return (Object.keys(CLAIM_DROPS_INSTANCES) as InstanceKey[])
        .map((key) => ({ key, ...CLAIM_DROPS_INSTANCES[key], address: instanceAddress(key, network) }))
        .filter((i) => i.address !== "")
        .map(({ key, address, label, note }) => ({ key, address, label, note }));
}

/**
 * Resolve the `?c=` on a claim link to an instance key.
 *
 * The param carries the ADDRESS, not the key. An address is what a recipient can
 * check against an explorer, and — more importantly — if an instance is ever
 * rotated, old links break loudly (unknown address) instead of silently
 * resolving to a different contract where the same campaign id is a different
 * drop entirely. Loud beats silently-wrong when the page ends in a signature.
 *
 * Returns null for anything not in the registry: unknown addresses are REFUSED,
 * never defaulted, or `?c=<attacker instance>` would render a stranger's drop as
 * if trippytools vouched for it.
 */
export function resolveInstance(network: NetworkKey, param: string | null): InstanceKey | null {
    if (!param) return DEFAULT_INSTANCE;
    const wanted = param.trim().toLowerCase();
    for (const key of Object.keys(CLAIM_DROPS_INSTANCES) as InstanceKey[]) {
        const addr = instanceAddress(key, network);
        if (addr && addr.toLowerCase() === wanted) return key;
    }
    return null;
}

/**
 * Shareable claim link. The instance rides as `?c=<address>` for anything but
 * the default, so links minted before the registry (and every future link to a
 * public drop) stay exactly as they were.
 */
export function claimUrl(
    origin: string,
    network: NetworkKey,
    key: InstanceKey,
    campaignId: number | string,
): string {
    const base = `${origin}/claim/${campaignId}`;
    if (key === DEFAULT_INSTANCE) return base;
    return `${base}?c=${instanceAddress(key, network)}`;
}

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

/**
 * Address of the DEFAULT instance. Named for what it is so no call site can use
 * it while meaning "whichever instance the user picked" — that ambiguity is the
 * whole bug class this registry exists to prevent.
 */
export const defaultInstanceAddress = (network: NetworkKey): string =>
    instanceAddress(DEFAULT_INSTANCE, network);

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
