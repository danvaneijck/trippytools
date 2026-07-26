// Run with: node --test src/views/ClaimDrop/claimState.test.ts   (`yarn test:unit`)
//
// The claim page's job is to tell someone the truth about their allocation, so
// these cover the ways "you can't claim" differ from each other — and the ways a
// creator-supplied `meta` blob or leaves file can be wrong without taking the
// page down with it.
import { strict as assert } from "node:assert";
import test from "node:test";

import { dropStatus, entitlement, parseMeta, rootMatch } from "./claimState.ts";
import type { Campaign } from "../../utils/claimDrops/types.ts";

const NOW = 1_785_000_000_000; // fixed clock; ms
const nanos = (ms: number) => (BigInt(ms) * 1_000_000n).toString();

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
    creator: "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz",
    pending_creator: null,
    keeper: null,
    streaming: false,
    denom: "inj",
    meta: "{}",
    leaves_uri: "https://api.trippyinj.xyz/claim-drops/leaves/ab.json",
    root: "2782b321f2695072a0a4149f460a53a8b44a4a7889ab9b229e0cf363c1c90000",
    total: "2373456789012345678",
    prev_root: null,
    prev_total: "0",
    claimed_total: "0",
    claimants: 0,
    frozen: true,
    expiry: null,
    paused: false,
    swept: false,
    ...over,
});

test("a frozen perpetual campaign is live", () => {
    assert.deepEqual(dropStatus(campaign(), NOW), { kind: "live" });
});

test("status order matches the contract's own check order", () => {
    // apply_claim tests paused → swept → expired, so a campaign that is all three
    // must report "paused" — the reason shown has to be the error the chain gives.
    const all = campaign({ paused: true, swept: true, expiry: nanos(NOW - 1000) });
    assert.equal(dropStatus(all, NOW).kind, "paused");
    assert.equal(dropStatus(campaign({ swept: true, expiry: nanos(NOW - 1000) }), NOW).kind, "swept");
    // An instance-wide pause outranks everything: no campaign pays while it's set.
    assert.equal(dropStatus(campaign(), NOW, true).kind, "contract_paused");
});

test("expiry is compared on the nanosecond boundary", () => {
    // is_expired is `now >= expiry`, so the exact instant is already expired.
    assert.equal(dropStatus(campaign({ expiry: nanos(NOW) }), NOW).kind, "expired");
    assert.equal(dropStatus(campaign({ expiry: nanos(NOW + 1) }), NOW).kind, "live");
    const status = dropStatus(campaign({ expiry: nanos(NOW - 86_400_000) }), NOW);
    assert.equal(status.kind, "expired");
    if (status.kind === "expired") assert.equal(status.at.getTime(), NOW - 86_400_000);
});

test("a campaign with no root yet is unpublished, not live", () => {
    assert.equal(dropStatus(campaign({ root: null }), NOW).kind, "unpublished");
});

test("no leaf means not included, which is not the same as nothing to claim", () => {
    assert.deepEqual(entitlement(null, "0", { kind: "live" }), { kind: "not_included" });
});

test("entitlement pays the cumulative delta", () => {
    assert.deepEqual(entitlement("1000", "0", { kind: "live" }), {
        kind: "claimable",
        allocation: "1000",
        claimed: "0",
        claimable: "1000",
    });
    // Partly claimed, then the root was republished with a higher lifetime total.
    assert.deepEqual(entitlement("1500", "1000", { kind: "live" }), {
        kind: "claimable",
        allocation: "1500",
        claimed: "1000",
        claimable: "500",
    });
});

test("a fully claimed leaf reports fully_claimed even when the drop is closed", () => {
    assert.deepEqual(entitlement("1000", "1000", { kind: "live" }), {
        kind: "fully_claimed",
        allocation: "1000",
        claimed: "1000",
    });
    assert.equal(entitlement("1000", "1000", { kind: "swept" }).kind, "fully_claimed");
});

test("an unclaimed leaf on a closed campaign is blocked, and says which way", () => {
    const at = new Date(NOW);
    const result = entitlement("1000", "250", { kind: "expired", at });
    assert.equal(result.kind, "blocked");
    if (result.kind === "blocked") {
        assert.equal(result.claimable, "750");
        assert.equal(result.status.kind, "expired");
    }
});

test("a leaf below what was already claimed clamps to zero, never negative", () => {
    // Can't happen through the contract (totals only rise), but a hand-edited
    // leaves file must not render a negative balance or a claim button.
    assert.deepEqual(entitlement("100", "500", { kind: "live" }), {
        kind: "fully_claimed",
        allocation: "100",
        claimed: "500",
    });
});

test("amounts stay exact past 2^53", () => {
    const big = "2373456789012345678";
    const result = entitlement(big, "1750000000000000000", { kind: "live" });
    assert.equal(result.kind === "claimable" && result.claimable, "623456789012345678");
});

test("meta is treated as untrusted", () => {
    assert.deepEqual(parseMeta('{"title":"Hi","symbol":"INJ","decimals":18}'), {
        title: "Hi",
        symbol: "INJ",
        decimals: 18,
    });
    // Bad JSON, wrong shapes and out-of-range values degrade to a usable page.
    assert.deepEqual(parseMeta("not json"), {});
    assert.deepEqual(parseMeta("[]"), {});
    assert.deepEqual(parseMeta("null"), {});
    assert.deepEqual(parseMeta('"a string"'), {});
    assert.deepEqual(parseMeta('{"title":42,"decimals":"18"}'), {});
    assert.deepEqual(parseMeta('{"decimals":1.5}'), {});
    assert.deepEqual(parseMeta('{"decimals":-1}'), {});
    assert.deepEqual(parseMeta('{"decimals":99}'), {});
});

test("rootMatch accepts either live root and nothing else", () => {
    const c = campaign({ root: "aa".repeat(32), prev_root: "bb".repeat(32) });
    assert.equal(rootMatch("aa".repeat(32), c), "root");
    assert.equal(rootMatch("AA".repeat(32), c), "root");
    // The previous root stays claimable — that's what kills the proof-fetch race.
    assert.equal(rootMatch("bb".repeat(32), c), "prev_root");
    assert.equal(rootMatch("cc".repeat(32), c), null);
    assert.equal(rootMatch("aa".repeat(32), campaign({ root: null })), null);
});
