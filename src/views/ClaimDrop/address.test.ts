import { strict as assert } from "node:assert";
import { test } from "node:test";

import { isValidInjBech32 } from "./address.ts";

// Real mainnet addresses (account keys, a contract, and the burn address) —
// every one of these must keep validating, or the tool starts rejecting
// legitimate recipients.
const REAL = [
    "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz",
    "inj1yrg4pg8hcu0sw5rjlrcqfmw2ewf2uztlmdysak",
    "inj1cml96vmptgw99syqrrz8az79xer2pcgp0a885r",
    "inj1jcltmuhplrdcwp7stlr4hlhlhgd4htqhe4c0cs",
    "inj1dzqd00lfd4y4qy2pxa0dsdwzfnmsu27hgttswz",
    "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d",
    "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49",
    // Contract addresses (32-byte, longer data part).
    "inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53",
    "inj1520rsss9aykhkfmuf89nh5hp2jww770z4u3eu0",
    "inj14tm9kjh396g483aj76xyykem2mdk22q8x769v9",
];

test("every real Injective address validates", () => {
    for (const addr of REAL) {
        assert.equal(isValidInjBech32(addr), true, addr);
    }
});

test("a single mistyped character is rejected", () => {
    // This is the case the charset regex cannot catch: same prefix, same
    // length, all-legal characters — only the checksum disagrees. In a claim
    // drop it would mint a leaf nobody holds the key for.
    const good = "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz";
    const typo = "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgq";
    assert.equal(isValidInjBech32(good), true);
    assert.equal(good.length, typo.length);
    assert.equal(isValidInjBech32(typo), false);

    // Transposed characters — the classic hand-copy error.
    const swapped = "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jzg";
    assert.equal(isValidInjBech32(swapped), false);
});

test("malformed shapes never reach the checksum", () => {
    for (const bad of [
        "",
        "inj1",
        "cosmos1q2m26a7jdzjyfdn545vqsude3zwwtfrdaqqqqqq",
        "INJ1Q2M26A7JDZJYFDN545VQSUDE3ZWWTFRDAP5JGZ", // uppercase bech32 is not what the chain stores
        "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jg", // truncated
        "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgzz", // extended
        "0x1234567890123456789012345678901234567890",
        "inj1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", // `b` is not in the bech32 charset
    ]) {
        assert.equal(isValidInjBech32(bad), false, bad);
    }
});

test("surrounding whitespace is tolerated", () => {
    assert.equal(isValidInjBech32("  inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz\t"), true);
});
