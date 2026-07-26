/**
 * Merkle tree for the `choice-claim-drops` contract.
 *
 * The leaf/parent hashing MUST match the contract byte-for-byte
 * (`contracts/choice_claim_drops/src/merkle.rs`), whose golden vectors this
 * module reproduces:
 *
 *   leaf   = sha256(utf8("{bech32_address}:{cumulative_amount_base_units}"))
 *   parent = sha256(concat(min(a, b), max(a, b)))   // sorted-pair, no L/R flags
 *
 * - Address: canonical lowercase bech32 (`inj1…`), exactly as the chain stores it.
 * - Amount: decimal string of the LIFETIME CUMULATIVE allocation in base units,
 *   no separators.
 * - Odd node at any level promotes unchanged (its proof omits that level).
 * - Single-leaf tree: the leaf is the root; its proof is empty.
 */
import { sha256 } from "@noble/hashes/sha256";

export interface LeafInput {
    /** Canonical bech32 address (inj1…). */
    address: string;
    /** Lifetime cumulative allocation, in base units, as a decimal string. */
    amount: string;
}

const toHex = (b: Uint8Array): string =>
    Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

const compare = (a: Uint8Array, b: Uint8Array): number => {
    for (let i = 0; i < a.length && i < b.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
};

/** leaf = sha256("{address}:{amount}") over the utf8 bytes. */
export function leafHash(address: string, amount: string): Uint8Array {
    return sha256(new TextEncoder().encode(`${address}:${amount}`));
}

/** parent = sha256(min(a,b) ++ max(a,b)). */
function hashPair(a: Uint8Array, b: Uint8Array): Uint8Array {
    const [lo, hi] = compare(a, b) <= 0 ? [a, b] : [b, a];
    const buf = new Uint8Array(64);
    buf.set(lo, 0);
    buf.set(hi, 32);
    return sha256(buf);
}

export interface BuiltTree {
    /** 32-byte root, lowercase hex (no 0x) — what `UpdateRoot`/`initial` expects. */
    rootHex: string;
    /** The canonicalized, deduplicated, sorted leaves that back the root. */
    leaves: LeafInput[];
    /** Σ of all leaf amounts as a decimal string — the campaign's declared `total`. */
    total: string;
    /** Proof for each leaf, keyed by lowercase address. */
    proofs: Record<string, string[]>;
}

/**
 * Deduplicate + sort leaves and build the tree.
 *
 * Duplicate addresses are rejected (a second leaf for one address would make the
 * smaller amount unclaimable noise, and silently dropping one is worse — the
 * caller must resolve it). Amounts must be non-negative integer strings in base
 * units. Leaves are sorted by leaf hash so the tree is deterministic regardless
 * of input order — the publisher and every claim client derive identical proofs.
 */
export function buildTree(input: LeafInput[]): BuiltTree {
    if (input.length === 0) throw new Error("cannot build a tree with no leaves");

    const seen = new Set<string>();
    const leaves: { leaf: LeafInput; hash: Uint8Array }[] = [];
    let total = 0n;
    for (const { address, amount } of input) {
        const addr = address.trim();
        if (!/^[0-9]+$/.test(amount)) {
            throw new Error(`amount for ${addr} must be a base-unit integer string, got "${amount}"`);
        }
        const key = addr.toLowerCase();
        if (seen.has(key)) throw new Error(`duplicate address in leaves: ${addr}`);
        seen.add(key);
        total += BigInt(amount);
        leaves.push({ leaf: { address: addr, amount }, hash: leafHash(addr, amount) });
    }

    // Deterministic ordering by leaf hash.
    leaves.sort((x, y) => compare(x.hash, y.hash));

    // Build levels bottom-up; remember each node's sibling to derive proofs.
    let level = leaves.map((l) => l.hash);
    const levels: Uint8Array[][] = [level];
    while (level.length > 1) {
        const next: Uint8Array[] = [];
        for (let i = 0; i < level.length; i += 2) {
            next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
        }
        levels.push(next);
        level = next;
    }

    const proofs: Record<string, string[]> = {};
    leaves.forEach((l, leafIdx) => {
        const proof: string[] = [];
        let idx = leafIdx;
        for (let lvl = 0; lvl < levels.length - 1; lvl++) {
            const sib = idx ^ 1;
            if (sib < levels[lvl].length) proof.push(toHex(levels[lvl][sib]));
            idx = Math.floor(idx / 2);
        }
        proofs[l.leaf.address.toLowerCase()] = proof;
    });

    return {
        rootHex: toHex(levels[levels.length - 1][0]),
        leaves: leaves.map((l) => l.leaf),
        total: total.toString(),
        proofs,
    };
}

/** Verify a proof locally (mirrors the contract's verifier) before broadcasting a claim. */
export function verifyProof(
    rootHex: string,
    address: string,
    amount: string,
    proofHex: string[],
): boolean {
    let node = leafHash(address.trim(), amount);
    for (const stepHex of proofHex) {
        if (!/^[0-9a-fA-F]{64}$/.test(stepHex)) return false;
        const sib = fromHex(stepHex);
        node = hashPair(node, sib);
    }
    return toHex(node) === rootHex.toLowerCase();
}

function fromHex(hex: string): Uint8Array {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

/** Look up a claimant's proof from a built tree (address is case-insensitive). */
export function proofFor(tree: BuiltTree, address: string): string[] | undefined {
    return tree.proofs[address.trim().toLowerCase()];
}
