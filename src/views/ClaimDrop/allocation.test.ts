import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
    allocateExact,
    applyMinAmount,
    applyTopN,
    applyVoteFilter,
    weightToInt,
    type SourceRow,
} from "./allocation.ts";
import { buildLeavesFromRows, fromBaseUnits, toBaseUnits } from "./leaves.ts";
import { buildTree } from "../../utils/claimDrops/merkle.ts";

const rows = (...specs: [string, number][]): SourceRow[] =>
    specs.map(([address, weight]) => ({ address, weight }));

const sum = (parts: { amountBase: string }[]) =>
    parts.reduce((s, p) => s + BigInt(p.amountBase), 0n);

// The whole point of this module: the contract demands the attached funds equal
// the declared total exactly, and the declared total is Σ of the leaves.
test("a fair split spends the total to the last base unit", () => {
    const total = 1_000_000_000_000_000_007n; // deliberately indivisible by 3
    const r = allocateExact(rows(["inj1c", 0], ["inj1a", 0], ["inj1b", 0]), total, "fair");
    assert.equal(r.allocations.length, 3);
    assert.equal(sum(r.allocations), total);
    assert.equal(r.totalBase, total.toString());

    // Nobody is more than one base unit better off than anyone else.
    const amounts = r.allocations.map((a) => BigInt(a.amountBase));
    const min = amounts.reduce((m, a) => (a < m ? a : m));
    const max = amounts.reduce((m, a) => (a > m ? a : m));
    assert.equal(max - min <= 1n, true);
});

test("a proportionate split spends the total exactly, by largest remainder", () => {
    // 100 base units over weights 1/1/1 — 33.33 each, 1 unit left to place.
    const r = allocateExact(rows(["inj1a", 1], ["inj1b", 1], ["inj1c", 1]), 100n, "proportionate");
    assert.equal(sum(r.allocations), 100n);
    assert.deepEqual(
        r.allocations.map((a) => a.amountBase).sort(),
        ["33", "33", "34"],
    );

    // A lopsided book: the whale takes ~99%, and the total still lands exactly.
    const big = allocateExact(
        rows(["inj1whale", 999_999], ["inj1a", 1], ["inj1b", 1]),
        7n * 10n ** 18n + 3n,
        "proportionate",
    );
    assert.equal(sum(big.allocations), 7n * 10n ** 18n + 3n);
});

test("weights beyond 2^53 and below 1 base unit stay exact", () => {
    // toFixed() flips to exponential at 1e21 — the path that would otherwise
    // hand BigInt() a string like "1e+21" and throw.
    assert.equal(weightToInt(1e21), BigInt(1e21) * 10n ** 6n);
    assert.equal(weightToInt(0.000001), 1n);
    assert.equal(weightToInt(0.0000001), 0n); // below the pinned precision
    assert.equal(weightToInt(-5), 0n);
    assert.equal(weightToInt(Number.NaN), 0n);

    const r = allocateExact(rows(["inj1a", 1e21], ["inj1b", 1e-7]), 1_000_000n, "proportionate");
    assert.equal(sum(r.allocations), 1_000_000n);
    // The dust holder's share floors to zero and is dropped, not left as a
    // zero-value leaf nobody can claim.
    assert.equal(r.allocations.length, 1);
    assert.equal(r.droppedZero, 1);
});

test("a source with no weights at all falls back to a fair split", () => {
    // Proposal voters: everyone counts the same, so proportionate must not
    // divide by a zero weight sum.
    const r = allocateExact(rows(["inj1a", 0], ["inj1b", 0]), 10n, "proportionate");
    assert.deepEqual(r.allocations.map((a) => a.amountBase), ["5", "5"]);
    assert.equal(sum(r.allocations), 10n);
});

test("a repeated address gets one leaf with the summed weight", () => {
    const r = allocateExact(rows(["inj1a", 1], ["inj1a", 3], ["inj1b", 4]), 800n, "proportionate");
    assert.equal(r.mergedRows, 1);
    assert.equal(r.allocations.length, 2);
    assert.deepEqual(
        r.allocations.map((a) => [a.address, a.amountBase]),
        [
            ["inj1a", "400"],
            ["inj1b", "400"],
        ],
    );
});

test("the same input always produces the same allocations", () => {
    // Input order must not move the root: the tree is a commitment, and a
    // re-run that shuffles amounts would re-charge the SHROOM fee.
    const a = allocateExact(rows(["inj1c", 5], ["inj1a", 5], ["inj1b", 5]), 100n, "proportionate");
    const b = allocateExact(rows(["inj1a", 5], ["inj1b", 5], ["inj1c", 5]), 100n, "proportionate");
    assert.deepEqual(a.allocations, b.allocations);
});

test("an empty list or a zero total allocates nothing", () => {
    assert.equal(allocateExact([], 100n, "fair").allocations.length, 0);
    assert.equal(allocateExact(rows(["inj1a", 1]), 0n, "fair").allocations.length, 0);
    assert.equal(allocateExact(rows(["inj1a", 1]), 0n, "fair").totalBase, "0");
});

test("top-N keeps the heaviest wallets", () => {
    const kept = applyTopN(rows(["inj1a", 1], ["inj1b", 9], ["inj1c", 5]), 2);
    assert.deepEqual(kept.map((r) => r.address), ["inj1b", "inj1c"]);
    // A limit at or above the list length is a no-op.
    assert.equal(applyTopN(rows(["inj1a", 1]), 5).length, 1);
});

test("the vote filter keeps only the selected options", () => {
    const voters: SourceRow[] = [
        { address: "inj1a", weight: 1, voteOption: "VOTE_OPTION_YES" },
        { address: "inj1b", weight: 1, voteOption: "VOTE_OPTION_NO" },
        { address: "inj1c", weight: 1 },
    ];
    const yes = applyVoteFilter(voters, new Set(["VOTE_OPTION_YES"]));
    assert.deepEqual(yes.map((r) => r.address), ["inj1a"]);
    // No selection means no filtering, rather than an empty drop.
    assert.equal(applyVoteFilter(voters, new Set()).length, 3);
});

test("trimming dust re-splits the whole total across who is left", () => {
    // 1000 units over 1/1/1/97: the three small holders get 10 each. A 20-unit
    // floor removes them, and the total must still land exactly on 1000.
    const source = rows(["inj1a", 1], ["inj1b", 1], ["inj1c", 1], ["inj1whale", 97]);
    const before = allocateExact(source, 1000n, "proportionate");
    assert.equal(sum(before.allocations), 1000n);
    assert.equal(before.allocations.length, 4);

    const trimmed = applyMinAmount(source, 1000n, "proportionate", 20n);
    assert.deepEqual(trimmed.map((r) => r.address), ["inj1whale"]);

    const after = allocateExact(trimmed, 1000n, "proportionate");
    assert.equal(sum(after.allocations), 1000n);
    assert.equal(after.allocations[0].amountBase, "1000");
});

// The seam that actually matters: the allocator's numbers have to arrive at the
// merkle tree unchanged. The tree's total is what the create tx declares, and
// the contract demands the attached funds equal it to the base unit — so if a
// single unit were lost crossing into the leaf builder, every drop built from a
// holder list would revert at broadcast.
test("an allocated list reaches the merkle tree with the total intact", () => {
    const holders: SourceRow[] = Array.from({ length: 137 }, (_, i) => ({
        // Real-shaped addresses aren't needed here — the leaf builder only
        // rejects blocked module accounts, and hashing is address-agnostic.
        address: `inj1holder${String(i).padStart(32, "0")}`,
        weight: (i % 17) + 1,
    }));

    for (const [amount, decimals] of [
        ["1234.567891", 6],
        ["7.000000000000000001", 18],
        ["1", 18],
        ["999999999", 0],
    ] as [string, number][]) {
        const totalBase = BigInt(toBaseUnits(amount, decimals).base);

        for (const mode of ["fair", "proportionate"] as const) {
            const alloc = allocateExact(holders, totalBase, mode);
            const rows = alloc.allocations.map((a) => ({
                address: a.address,
                amount: fromBaseUnits(a.amountBase, decimals),
            }));

            const build = buildLeavesFromRows(rows, decimals);
            const tree = buildTree(build.leaves);

            const label = `${amount} @ ${decimals}dp ${mode}`;
            // Nothing was silently dropped or floored on the way in.
            assert.equal(build.leaves.length, alloc.allocations.length, label);
            assert.equal(build.truncatedRows, 0, label);
            assert.equal(build.zeroRows, 0, label);
            // And the tree commits to exactly the amount that gets funded.
            assert.equal(build.totalBase, alloc.totalBase, label);
            assert.equal(tree.total, totalBase.toString(), label);
        }
    }
});

// The allocator hands base units to the leaf builder as a whole-token decimal
// string, which `buildLeavesFromRows` converts straight back. That round trip
// has to be lossless or the funded total and the tree would disagree.
test("base units survive the round trip through the leaf builder's string form", () => {
    for (const [base, decimals] of [
        ["1", 18],
        ["999999999999999999", 18],
        ["1000000000000000000", 18],
        ["2373456", 6],
        ["7", 0],
        ["123456789012345678901234567890", 18],
    ] as [string, number][]) {
        const whole = fromBaseUnits(base, decimals);
        assert.equal(toBaseUnits(whole, decimals).base, base, `${base} @ ${decimals}dp`);
    }
});
