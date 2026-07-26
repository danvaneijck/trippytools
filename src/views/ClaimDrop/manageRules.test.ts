// Run with: node --test src/views/ClaimDrop/manageRules.test.ts   (`yarn test:unit`)
//
// These rules decide whether an irreversible button is live, so each case below
// pins one contract rule the UI must not get wrong — freezing a drop, winding a
// perpetual one down, and clawing funds back can none of them be undone.
import { strict as assert } from "node:assert";
import test from "node:test";

import { MIN_WIND_DOWN_MS, endOfDayMs, expiryMs, isExpired, manageActions } from "./manageRules.ts";
import type { Campaign } from "../../utils/claimDrops/types.ts";

const NOW = 1_785_000_000_000;
const DAY = 86_400_000;
const nanos = (ms: number) => (BigInt(ms) * 1_000_000n).toString();
const CREATOR = "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz";

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
    creator: CREATOR,
    pending_creator: null,
    keeper: null,
    streaming: false,
    denom: "inj",
    meta: "{}",
    leaves_uri: "https://api.trippyinj.xyz/claim-drops/leaves/ab.json",
    root: "aa".repeat(32),
    total: "1000",
    prev_root: null,
    prev_total: "0",
    claimed_total: "250",
    claimants: 1,
    frozen: false,
    expiry: null,
    paused: false,
    swept: false,
    ...over,
});

const act = (over: Partial<Campaign> = {}, opts: { now?: number; isCreator?: boolean } = {}) =>
    manageActions(campaign(over), "750", opts.now ?? NOW, opts.isCreator ?? true);

test("a non-creator gets nothing, even on their own instance", () => {
    const a = act({}, { isCreator: false });
    for (const key of ["freeze", "pause", "clawback", "updateLeavesUri"] as const) {
        assert.equal(a[key].enabled, false, key);
        assert.match(a[key].reason ?? "", /creator/i);
    }
    assert.equal(a.setExpiry.enabled, false);
});

test("a frozen perpetual drop can never be given an expiry or clawed back", () => {
    // The strongest promise the tool makes; the contract enforces it with
    // FrozenExpiryLocked, and the UI must not offer the button at all.
    const a = act({ frozen: true, expiry: null });
    assert.equal(a.setExpiry.enabled, false);
    assert.equal(a.setExpiry.earliestMs, null);
    assert.match(a.setExpiry.reason ?? "", /permanent/i);
    assert.equal(a.clawback.enabled, false);
});

test("winding down a perpetual drop needs 7 days' notice", () => {
    const a = act({ expiry: null, frozen: false });
    assert.equal(a.setExpiry.enabled, true);
    assert.equal(a.setExpiry.earliestMs, NOW + MIN_WIND_DOWN_MS);
});

test("a dated expiry can only be extended", () => {
    const current = NOW + 3 * DAY;
    const a = act({ expiry: nanos(current) });
    assert.equal(a.setExpiry.enabled, true);
    // `expiry <= current` is rejected, so the earliest acceptable is one past it.
    assert.equal(a.setExpiry.earliestMs, current + 1);
});

test("an expired drop can still have its expiry extended", () => {
    // set_expiry doesn't check expiry-vs-now, only that it moves later, so a
    // creator can reopen a lapsed window instead of being forced to claw back.
    const a = act({ expiry: nanos(NOW - DAY) });
    assert.equal(a.setExpiry.enabled, true);
    assert.equal(a.setExpiry.earliestMs, NOW - DAY + 1);
});

test("clawback only after the expiry passes, and only once", () => {
    assert.equal(act({ expiry: null }).clawback.enabled, false);
    assert.match(act({ expiry: null }).clawback.reason ?? "", /perpetual/i);

    assert.equal(act({ expiry: nanos(NOW + DAY) }).clawback.enabled, false);
    assert.match(act({ expiry: nanos(NOW + DAY) }).clawback.reason ?? "", /after the expiry/i);

    const due = act({ expiry: nanos(NOW - 1) });
    assert.equal(due.clawback.enabled, true);
    assert.equal(due.clawback.amount, "750");

    const done = act({ expiry: nanos(NOW - 1), swept: true });
    assert.equal(done.clawback.enabled, false);
    assert.match(done.clawback.reason ?? "", /already clawed back/i);
});

test("a swept campaign is closed for every action except reading", () => {
    const a = act({ expiry: nanos(NOW - 1), swept: true });
    assert.equal(a.pause.enabled, false);
    assert.equal(a.setExpiry.enabled, false);
    assert.equal(a.updateLeavesUri.enabled, false);
});

test("freeze needs a root and is offered only once", () => {
    assert.equal(act({ root: null }).freeze.enabled, false);
    assert.match(act({ root: null }).freeze.reason ?? "", /nothing published/i);
    assert.equal(act({ frozen: true }).freeze.enabled, false);
    assert.equal(act({ frozen: false }).freeze.enabled, true);
});

test("re-pointing the list stays available on a frozen drop", () => {
    // The root is the commitment, so this can only repair a dead host. It's the
    // fix for a leaves_uri nobody can read, which is exactly when a drop is frozen.
    assert.equal(act({ frozen: true }).updateLeavesUri.enabled, true);
});

test("expiry helpers round-trip nanoseconds and treat the boundary as expired", () => {
    assert.equal(expiryMs(campaign({ expiry: nanos(NOW) })), NOW);
    assert.equal(expiryMs(campaign({ expiry: null })), null);
    assert.equal(isExpired(campaign({ expiry: nanos(NOW) }), NOW), true);
    assert.equal(isExpired(campaign({ expiry: nanos(NOW + 1) }), NOW), false);
    assert.equal(isExpired(campaign({ expiry: null }), NOW), false);
});

test("a picked date means the END of that day", () => {
    // Otherwise "expires on the 5th" would cut recipients off at midnight, and a
    // same-day pick would land in the past and be rejected as un-extended.
    const ms = endOfDayMs("2026-08-05");
    const d = new Date(ms);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 5);
    assert.equal(d.getHours(), 23);
    assert.equal(d.getMinutes(), 59);
});
