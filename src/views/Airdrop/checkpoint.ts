// Durable, resumable checkpoint for the push-airdrop flow.
//
// A push airdrop is N sequential signed transactions (one per 500-recipient
// chunk). Before this, all progress lived in a component-local Set: if the run
// died on chunk 18/36 the 17 landed txs were forgotten, and clicking "Do
// Airdrop" again re-sent to *everyone* from chunk 0 — double-paying the first
// 8,500 recipients.
//
// This module persists the set of addresses that have actually been paid (plus
// the landed tx hashes and whether the SHROOM fee was paid) to localStorage,
// keyed by a hash of the plan. On the next attempt the sender skips anyone
// already paid, so a run can be resumed — even after a page reload — and can
// never double-pay.
//
// Why the *paid-address set* and not "completed chunk indices": chunk indices
// are only stable if the recipient list keeps byte-identical ordering. A holder
// query can return the same wallets in a different order across reloads, which
// would shift the chunk boundaries and skip the wrong people. The paid-set is
// order-independent and therefore correct regardless of how the plan is rebuilt.

export interface AirdropCheckpoint {
    v: number;
    sender: string;
    token: string;
    /** Addresses confirmed paid (a landed tx included them). */
    paid: string[];
    /** Landed tx hashes, in the order they confirmed. */
    txHashes: string[];
    /** SHROOM fee already paid for this plan (don't charge again on resume). */
    feePaid: boolean;
    /** Total payable recipients in the plan — for progress display only. */
    total: number;
    updatedAt: number;
}

const PREFIX = "trippy.airdrop.ckpt.";
const INDEX_KEY = "trippy.airdrop.ckpt.index";
// Keep only the most recent few checkpoints so a big paid-set (17k addresses ≈
// ~800KB) can't accumulate and blow the ~5MB iOS localStorage cap.
const MAX_CHECKPOINTS = 3;

const CURRENT_VERSION = 1;

// cyrb53 — a fast, well-distributed 53-bit string hash. Not cryptographic; we
// only need a stable, collision-resistant key for the plan.
function cyrb53(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Deterministic key for a plan. Built from the sender, the token, and the
 * *sorted* set of `address:amount` pairs, so the same drop always maps to the
 * same checkpoint no matter what order the recipient list is built in — and any
 * change to who gets what (or how much) starts a fresh, independent checkpoint.
 */
export function planKey(
    sender: string,
    token: string,
    records: { address: string; amount: string }[],
): string {
    const body = records
        .map((r) => `${r.address}:${r.amount}`)
        .sort()
        .join("|");
    return cyrb53(`${sender}|${token}|${records.length}|${body}`);
}

function storageKey(key: string): string {
    return PREFIX + key;
}

function readIndex(): string[] {
    try {
        const raw = localStorage.getItem(INDEX_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

// Track this key as most-recently-used and evict the oldest checkpoints beyond
// MAX_CHECKPOINTS so storage stays bounded.
function touchIndex(key: string): void {
    try {
        const idx = readIndex().filter((k) => k !== key);
        idx.push(key);
        while (idx.length > MAX_CHECKPOINTS) {
            const evict = idx.shift();
            if (evict) localStorage.removeItem(storageKey(evict));
        }
        localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
    } catch {
        // best effort — pruning is not correctness-critical
    }
}

export function loadCheckpoint(key: string): AirdropCheckpoint | null {
    try {
        const raw = localStorage.getItem(storageKey(key));
        if (!raw) return null;
        const cp = JSON.parse(raw) as AirdropCheckpoint;
        if (!cp || cp.v !== CURRENT_VERSION) return null;
        return cp;
    } catch {
        return null;
    }
}

// Persist a checkpoint. Never throws: on a quota/security error (iOS private
// mode, over-quota) we simply keep going in memory — the caller's live Set
// still prevents double-pays within the session, we just lose cross-reload
// resume for this plan.
function persist(key: string, cp: AirdropCheckpoint): void {
    try {
        localStorage.setItem(storageKey(key), JSON.stringify(cp));
        touchIndex(key);
    } catch (e) {
        console.warn("[airdrop-checkpoint] could not persist checkpoint", e);
    }
}

/** Merge a freshly-confirmed chunk (its addresses + tx hash) into the checkpoint. */
export function recordChunkPaid(
    key: string,
    base: { sender: string; token: string; total: number },
    addresses: string[],
    txHash: string,
): AirdropCheckpoint {
    const existing = loadCheckpoint(key);
    const paid = new Set(existing?.paid ?? []);
    addresses.forEach((a) => paid.add(a));
    const txHashes = existing?.txHashes ?? [];
    if (txHash && !txHashes.includes(txHash)) txHashes.push(txHash);
    const cp: AirdropCheckpoint = {
        v: CURRENT_VERSION,
        sender: base.sender,
        token: base.token,
        paid: Array.from(paid),
        txHashes,
        feePaid: existing?.feePaid ?? false,
        total: base.total,
        updatedAt: Date.now(),
    };
    persist(key, cp);
    return cp;
}

export function markFeePaid(
    key: string,
    base: { sender: string; token: string; total: number },
): void {
    const existing = loadCheckpoint(key);
    const cp: AirdropCheckpoint = {
        v: CURRENT_VERSION,
        sender: base.sender,
        token: base.token,
        paid: existing?.paid ?? [],
        txHashes: existing?.txHashes ?? [],
        feePaid: true,
        total: base.total,
        updatedAt: Date.now(),
    };
    persist(key, cp);
}

export function clearCheckpoint(key: string): void {
    try {
        localStorage.removeItem(storageKey(key));
        const idx = readIndex().filter((k) => k !== key);
        localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
    } catch {
        // ignore
    }
}
