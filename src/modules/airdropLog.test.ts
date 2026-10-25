import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";

import { MAX_HASHES_PER_RECORD, recordAirdropLog, recordBatches } from "./airdropLog.ts";

const hashes = (n: number) => Array.from({ length: n }, (_, i) => i.toString(16).padStart(64, "0"));

test("a short run is one request", () => {
    assert.deepEqual(recordBatches(hashes(3)), [hashes(3)]);
    assert.deepEqual(recordBatches([]), []);
});

test("a long run repeats one hash per batch so the backend continues one row", () => {
    const all = hashes(MAX_HASHES_PER_RECORD * 2 + 5);
    const batches = recordBatches(all);
    assert.ok(batches.every((b) => b.length <= MAX_HASHES_PER_RECORD));
    for (let i = 1; i < batches.length; i++) {
        assert.ok(batches[i - 1].includes(batches[i][0]), "each batch starts with a hash of the previous one");
    }
    assert.deepEqual([...new Set(batches.flat())], all);
});

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

test("only the hashes and the text are sent", async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
    }) as typeof fetch;
    assert.equal(await recordAirdropLog(hashes(2), { criteria: "c", description: "d", fee: 250000 }), true);
    assert.deepEqual(bodies, [{ tx_hashes: hashes(2), criteria: "c", description: "d", fee: 250000 }]);
});

test("a final refusal is not retried", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
        calls++;
        return new Response('{"error":"tx is not an airdrop"}', { status: 422 });
    }) as typeof fetch;
    assert.equal(await recordAirdropLog(hashes(1), {}), false);
    assert.equal(calls, 1);
});
