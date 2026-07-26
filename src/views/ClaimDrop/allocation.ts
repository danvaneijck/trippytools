// Turning a list of source wallets (token holders, NFT holders, voters, buyback
// participants…) into per-address allocations for a claim drop.
//
// This is deliberately NOT `../Airdrop/distribution.ts`. That allocator works in
// JS numbers and holds back a `DUST_HAIRCUT`, which is right for a push airdrop:
// each transfer is rounded at send time and a few dust units going unspent costs
// nothing. A claim drop is the opposite on both counts —
//
//   1. the amount IS the bytes inside the leaf hash, so a float artifact isn't a
//      rounding error, it's a leaf whose proof verifies against a root nobody
//      can claim from; and
//   2. the contract's solvency check demands the attached funds equal the
//      declared total EXACTLY, and the declared total is Σ of the leaves.
//
// So everything here is BigInt in base units, and the proportionate split uses
// largest-remainder: Σ of the allocations equals the requested total to the base
// unit, always, with no haircut and nothing left over.

/** One wallet from a recipient source, with whatever the source weighs it by. */
export interface SourceRow {
    address: string;
    /** Tokens held, NFTs owned, INJ committed, vote weight — source-dependent. */
    weight: number;
    /** GOV only: which way they voted, for the vote filter. */
    voteOption?: string;
}

export type ClaimDistMode = "fair" | "proportionate";

export interface Allocation {
    address: string;
    /** Base units, exact — this is what becomes the leaf. */
    amountBase: string;
    weight: number;
    voteOption?: string;
}

export interface AllocationResult {
    allocations: Allocation[];
    /** Σ of `allocations` in base units — the drop's real total. */
    totalBase: string;
    /** Rows that allocated to 0 base units and were dropped (dust holders). */
    droppedZero: number;
    /** Rows folded into an address that already appeared (weights summed). */
    mergedRows: number;
}

// Weights arrive as JS numbers from every source, so they get pinned to a fixed
// precision before any integer math. 6 decimal places is far beyond what any
// holder-ranking needs and keeps the largest-remainder comparison deterministic.
const WEIGHT_DP = 6;
const WEIGHT_SCALE = 10n ** BigInt(WEIGHT_DP);

/**
 * A weight as an exact integer. `toFixed` switches to exponential notation at
 * 1e21, which would produce a string `BigInt()` rejects, so very large weights
 * (a whale's balance in whole tokens) take the integer path instead — they have
 * no meaningful fractional part at that magnitude anyway.
 */
export function weightToInt(weight: number): bigint {
    if (!Number.isFinite(weight) || weight <= 0) return 0n;
    if (weight >= 1e21) return BigInt(Math.round(weight)) * WEIGHT_SCALE;
    const [whole, frac = ""] = weight.toFixed(WEIGHT_DP).split(".");
    return BigInt(whole + frac.padEnd(WEIGHT_DP, "0"));
}

/** Deduplicate by address, summing weights — same policy as the CSV path. */
function dedupe(rows: SourceRow[]): { rows: SourceRow[]; mergedRows: number } {
    const byAddress = new Map<string, SourceRow>();
    let mergedRows = 0;
    for (const row of rows) {
        const address = (row.address || "").trim();
        if (!address) continue;
        const existing = byAddress.get(address);
        if (existing) {
            existing.weight += Number(row.weight) || 0;
            mergedRows += 1;
        } else {
            byAddress.set(address, {
                address,
                weight: Number(row.weight) || 0,
                ...(row.voteOption ? { voteOption: row.voteOption } : {}),
            });
        }
    }
    return { rows: [...byAddress.values()], mergedRows };
}

/**
 * Split `totalBase` across `rows`.
 *
 * `fair` gives everyone the same amount; the base units that don't divide evenly
 * go one each to the lowest addresses, so the split is exact rather than short.
 * `proportionate` floors each share then hands the remaining units to the
 * largest fractional remainders (ties broken by address) — the standard
 * largest-remainder method, which is the only way to stay exactly on total
 * without giving anyone a fractional base unit.
 *
 * A source with no weights at all (proposal voters, where everyone counts the
 * same) falls back to a fair split rather than dividing by zero.
 */
export function allocateExact(
    rows: SourceRow[],
    totalBase: bigint,
    mode: ClaimDistMode,
): AllocationResult {
    const { rows: unique, mergedRows } = dedupe(rows);
    // Address order is the tiebreaker everywhere below, so the same inputs
    // always produce the same tree — and therefore the same merkle root.
    unique.sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));

    const empty: AllocationResult = {
        allocations: [],
        totalBase: "0",
        droppedZero: 0,
        mergedRows,
    };
    if (unique.length === 0 || totalBase <= 0n) return empty;

    const weights = unique.map((r) => weightToInt(r.weight));
    const weightSum = weights.reduce((s, w) => s + w, 0n);
    const useFair = mode === "fair" || weightSum === 0n;

    const amounts: bigint[] = [];
    if (useFair) {
        const n = BigInt(unique.length);
        const share = totalBase / n;
        const remainder = Number(totalBase % n);
        for (let i = 0; i < unique.length; i++) {
            amounts.push(share + (i < remainder ? 1n : 0n));
        }
    } else {
        const remainders: { index: number; rem: bigint }[] = [];
        let assigned = 0n;
        for (let i = 0; i < unique.length; i++) {
            const numerator = totalBase * weights[i];
            const share = numerator / weightSum;
            amounts.push(share);
            assigned += share;
            remainders.push({ index: i, rem: numerator % weightSum });
        }
        // Largest remainder first; `unique` is already address-sorted, so a
        // stable sort leaves equal remainders in address order.
        remainders.sort((a, b) => (a.rem === b.rem ? 0 : a.rem > b.rem ? -1 : 1));
        let leftover = totalBase - assigned;
        for (const { index } of remainders) {
            if (leftover <= 0n) break;
            amounts[index] += 1n;
            leftover -= 1n;
        }
    }

    // A zero leaf is unclaimable noise — drop it and let the drop's total be the
    // sum of what actually survived, which is what gets funded.
    const allocations: Allocation[] = [];
    let droppedZero = 0;
    let sum = 0n;
    for (let i = 0; i < unique.length; i++) {
        if (amounts[i] <= 0n) {
            droppedZero += 1;
            continue;
        }
        sum += amounts[i];
        allocations.push({
            address: unique[i].address,
            amountBase: amounts[i].toString(),
            weight: unique[i].weight,
            ...(unique[i].voteOption ? { voteOption: unique[i].voteOption } : {}),
        });
    }

    return { allocations, totalBase: sum.toString(), droppedZero, mergedRows };
}

/** Keep only the `n` heaviest wallets (ties broken by address, as everywhere). */
export function applyTopN(rows: SourceRow[], n: number): SourceRow[] {
    if (!Number.isFinite(n) || n <= 0 || n >= rows.length) return rows;
    return [...rows]
        .sort((a, b) => {
            const d = (Number(b.weight) || 0) - (Number(a.weight) || 0);
            if (d !== 0) return d;
            return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
        })
        .slice(0, n);
}

/** GOV: keep only the wallets whose vote is still selected. */
export function applyVoteFilter(rows: SourceRow[], allowed: Set<string>): SourceRow[] {
    if (allowed.size === 0) return rows;
    return rows.filter((r) => r.voteOption !== undefined && allowed.has(r.voteOption));
}

/**
 * Drop everyone whose share would land under `minBase`, then re-split the whole
 * total across the wallets that remain — so trimming dust raises everyone else's
 * allocation instead of leaving the drop under-funded.
 *
 * One pass, like the airdrop's filter: re-running can only push more wallets
 * over the line, never under it, so a second pass would remove nobody.
 */
export function applyMinAmount(
    rows: SourceRow[],
    totalBase: bigint,
    mode: ClaimDistMode,
    minBase: bigint,
): SourceRow[] {
    if (minBase <= 0n) return rows;
    const { allocations } = allocateExact(rows, totalBase, mode);
    const keep = new Set(
        allocations.filter((a) => BigInt(a.amountBase) >= minBase).map((a) => a.address),
    );
    return rows.filter((r) => keep.has((r.address || "").trim()));
}
