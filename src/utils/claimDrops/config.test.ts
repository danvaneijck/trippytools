import assert from "node:assert/strict";
import { test } from "node:test";

import {
    CLAIM_DROPS_INSTANCES,
    DEFAULT_INSTANCE,
    claimUrl,
    defaultInstanceAddress,
    instanceAddress,
    listInstances,
    resolveInstance,
} from "./config.ts";

const PUBLIC_MAINNET = CLAIM_DROPS_INSTANCES.public.address.mainnet;
const PUBLIC_TESTNET = CLAIM_DROPS_INSTANCES.public.address.testnet;

// --- resolveInstance: the allowlist ----------------------------------------

test("a link with no ?c resolves to the default instance", () => {
    assert.equal(resolveInstance("mainnet", null), DEFAULT_INSTANCE);
    assert.equal(resolveInstance("mainnet", ""), DEFAULT_INSTANCE);
});

test("a known instance address resolves to its key", () => {
    assert.equal(resolveInstance("mainnet", PUBLIC_MAINNET), "public");
    assert.equal(resolveInstance("testnet", PUBLIC_TESTNET), "public");
});

test("resolution is case- and whitespace-insensitive", () => {
    assert.equal(resolveInstance("mainnet", `  ${PUBLIC_MAINNET.toUpperCase()}  `), "public");
});

test("an UNKNOWN address is refused, never defaulted", () => {
    // The phishing case: `/claim/1?c=<attacker instance>` must not render a
    // stranger's drop inside trippytools' chrome with a working claim button.
    assert.equal(resolveInstance("mainnet", "inj1attackerinstanceaddress0000000000000000"), null);
});

test("an address from the OTHER network is refused on this one", () => {
    // Same contract role, wrong chain — resolving it would query mainnet with a
    // testnet address and render "drop not found" instead of offering a switch.
    assert.equal(resolveInstance("mainnet", PUBLIC_TESTNET), null);
    assert.equal(resolveInstance("testnet", PUBLIC_MAINNET), null);
});

test("an instance with no address on this network is never resolvable", () => {
    // `rewards` ships with empty addresses until it is instantiated. An empty
    // registry entry must not make `?c=` (empty) match it — that would silently
    // point the page at "".
    assert.equal(instanceAddress("rewards", "mainnet"), "");
    assert.notEqual(resolveInstance("mainnet", ""), "rewards");
});

// --- listInstances: only what is deployed -----------------------------------

test("listInstances hides instances that have no address yet", () => {
    const keys = listInstances("mainnet").map((i) => i.key);
    assert.deepEqual(keys, ["public"]);
    assert.ok(!keys.includes("rewards"));
});

test("every listed instance has a non-empty address", () => {
    for (const network of ["mainnet", "testnet"] as const) {
        for (const i of listInstances(network)) {
            assert.notEqual(i.address, "", `${i.key} on ${network}`);
            assert.equal(i.address, instanceAddress(i.key, network));
        }
    }
});

// --- claimUrl: backwards compatibility --------------------------------------

test("a default-instance claim link is unchanged by the registry", () => {
    // Every drop created before instances existed lives on `public` and its
    // links carry no `?c` — those links must keep working verbatim.
    assert.equal(claimUrl("https://x.io", "mainnet", "public", 4), "https://x.io/claim/4");
});

test("a non-default claim link carries the instance address", () => {
    // Uses a temporarily-populated address so the assertion doesn't depend on
    // `rewards` having been instantiated yet.
    const saved = CLAIM_DROPS_INSTANCES.rewards.address.mainnet;
    CLAIM_DROPS_INSTANCES.rewards.address.mainnet = "inj1rewardsinstance";
    try {
        assert.equal(
            claimUrl("https://x.io", "mainnet", "rewards", 2),
            "https://x.io/claim/2?c=inj1rewardsinstance",
        );
        // …and it round-trips back through the allowlist.
        assert.equal(resolveInstance("mainnet", "inj1rewardsinstance"), "rewards");
    } finally {
        CLAIM_DROPS_INSTANCES.rewards.address.mainnet = saved;
    }
});

test("defaultInstanceAddress is the public instance", () => {
    assert.equal(defaultInstanceAddress("mainnet"), PUBLIC_MAINNET);
    assert.equal(DEFAULT_INSTANCE, "public");
});
