// Turning a recipient list into merkle leaves for a claim drop.
//
// Dependency-free and exact on purpose: allocations become the *bytes* a leaf
// hash commits to, so every conversion here is integer/string math (never
// float). A wrong base-unit string doesn't fail loudly — it mints a leaf whose
// proof verifies against a root nobody can claim from.

import type { LeafInput } from "../../utils/claimDrops/merkle";

/** One row as written in the CSV: an address and a WHOLE-token amount. */
export interface CsvRow {
    address: string;
    amount: string;
}

export interface LeafBuild {
    /** Deduplicated leaves, amounts in base units — ready for `buildTree`. */
    leaves: LeafInput[];
    /** Σ of all leaf amounts in base units (the campaign's `total`). */
    totalBase: string;
    /** Rows folded into an address that already appeared (amounts summed). */
    mergedRows: number;
    /** Rows carrying more precision than the denom has decimals (floored). */
    truncatedRows: number;
    /** Rows dropped because they floor to 0 base units. */
    zeroRows: number;
    /** Rows dropped for being a bank-blocked module account. */
    blockedRows: number;
}

const AMOUNT_RE = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/** Is this a whole-token amount we can convert exactly? */
export const isValidAmount = (amount: string): boolean => AMOUNT_RE.test((amount || "").trim());

/**
 * Whole tokens → base units, FLOORED at `decimals`, via string/BigInt math only.
 *
 * Flooring (not rounding) is the safe direction: the funded total must cover the
 * sum of the leaves exactly, and rounding up could ask for a base unit the
 * creator never attached. `truncated` reports when real precision was dropped so
 * the UI can say so rather than quietly shaving allocations.
 */
export function toBaseUnits(amount: string, decimals: number): { base: string; truncated: boolean } {
    const trimmed = (amount || "").trim();
    if (!AMOUNT_RE.test(trimmed)) throw new Error(`invalid amount: "${amount}"`);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
        throw new Error(`invalid decimals: ${decimals}`);
    }

    const [whole, frac = ""] = trimmed.split(".");
    const kept = frac.slice(0, decimals);
    const dropped = frac.slice(decimals);
    return {
        base: BigInt((whole || "0") + kept.padEnd(decimals, "0")).toString(),
        truncated: /[1-9]/.test(dropped),
    };
}

/** Base units → a whole-token decimal string (exact, trailing zeros trimmed). */
export function fromBaseUnits(base: string, decimals: number): string {
    const negative = base.startsWith("-");
    const digits = (negative ? base.slice(1) : base).padStart(decimals + 1, "0");
    const whole = digits.slice(0, digits.length - decimals);
    const frac = decimals > 0 ? digits.slice(digits.length - decimals).replace(/0+$/, "") : "";
    return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/**
 * Build the leaf set from parsed CSV rows.
 *
 * Duplicate addresses are SUMMED rather than rejected: `buildTree` throws on a
 * repeat, and a claim drop's leaf is a lifetime cumulative total, so "0x sent
 * twice" means one wallet with the combined allocation. Dropping either row
 * would silently short someone; the count is reported so the UI can say what
 * happened. Bank-blocked module accounts are dropped — they hold no keys, so an
 * allocation to one is float that can never be claimed.
 *
 * `isBlocked` is injected (rather than imported) to keep this module free of
 * runtime imports, so it stays trivially testable outside the bundler.
 */
export function buildLeavesFromRows(
    rows: CsvRow[],
    decimals: number,
    opts: { isBlocked?: (address: string) => boolean } = {},
): LeafBuild {
    const isBlocked = opts.isBlocked ?? (() => false);

    const byAddress = new Map<string, bigint>();
    const order: string[] = [];
    let mergedRows = 0;
    let truncatedRows = 0;
    let zeroRows = 0;
    let blockedRows = 0;

    for (const row of rows) {
        const address = (row.address || "").trim();
        if (isBlocked(address)) {
            blockedRows += 1;
            continue;
        }

        const { base, truncated } = toBaseUnits(row.amount, decimals);
        if (truncated) truncatedRows += 1;
        if (base === "0") {
            zeroRows += 1;
            continue;
        }

        const existing = byAddress.get(address);
        if (existing === undefined) {
            byAddress.set(address, BigInt(base));
            order.push(address);
        } else {
            byAddress.set(address, existing + BigInt(base));
            mergedRows += 1;
        }
    }

    let total = 0n;
    const leaves: LeafInput[] = order.map((address) => {
        const amount = byAddress.get(address) as bigint;
        total += amount;
        return { address, amount: amount.toString() };
    });

    return {
        leaves,
        totalBase: total.toString(),
        mergedRows,
        truncatedRows,
        zeroRows,
        blockedRows,
    };
}
