// Run with: node --test src/views/ClaimDrop/campaignId.test.ts   (`yarn test:unit`)
//
// The campaign id IS the /claim/<id> link, and it is read out of a broadcast
// response whose shape belongs to the chain and the SDK, not to us — so the
// central fixture here is a VERBATIM response from injective-888 (campaign #1,
// tx 1FFC6DC2EED37388AA4B0E2582D093A2242BB68D36B235CE5BA5816D2F00F109,
// contract inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53).
//
// What that capture settled, which guesswork had left open:
//   * `events` comes back as a flat array of { type, attributes[] } with PLAIN
//     string keys — not base64, and not the per-msg `logs[].events` nesting.
//   * `rawLog` is the EMPTY string and `logs` is an empty array. Under
//     cosmos-sdk 0.50 the tx-query path no longer populates either, so the
//     rawLog branch is a fallback for older/other shapes, never the live one.
//     A parser that read rawLog first would have returned null here.
import { strict as assert } from "node:assert";
import test from "node:test";

// Explicit .ts extension so `node --test` can resolve it with no loader or build
// step (tsconfig sets allowImportingTsExtensions, and Vite handles it too).
import { parseCampaignId } from "./campaignId.ts";

/** Verbatim from the live create tx — the two events the parser can read. */
const LIVE_RESPONSE = {
    height: 0,
    txhash: "1FFC6DC2EED37388AA4B0E2582D093A2242BB68D36B235CE5BA5816D2F00F109",
    codespace: "",
    code: 0,
    rawLog: "",
    logs: [],
    info: "",
    gasWanted: "239570",
    gasUsed: "220619",
    events: [
        {
            type: "wasm",
            attributes: [
                {
                    key: "_contract_address",
                    value: "inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53",
                    index: true,
                },
                { key: "action", value: "create_campaign", index: true },
                { key: "id", value: "1", index: true },
                {
                    key: "creator",
                    value: "inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz",
                    index: true,
                },
                { key: "denom", value: "inj", index: true },
                { key: "streaming", value: "false", index: true },
                { key: "keeper", value: "none", index: true },
                { key: "expiry", value: "none", index: true },
                { key: "msg_index", value: "0", index: true },
            ],
        },
        {
            type: "wasm-update_root",
            attributes: [
                {
                    key: "_contract_address",
                    value: "inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53",
                    index: true,
                },
                { key: "id", value: "1", index: true },
                {
                    key: "root",
                    value: "2782b321f2695072a0a4149f460a53a8b44a4a7889ab9b229e0cf363c1c90000",
                    index: true,
                },
                { key: "total", value: "2373456789012345678", index: true },
                { key: "delta", value: "2373456789012345678", index: true },
                { key: "fee", value: "0", index: true },
                { key: "msg_index", value: "0", index: true },
            ],
        },
    ],
    txHash: "1FFC6DC2EED37388AA4B0E2582D093A2242BB68D36B235CE5BA5816D2F00F109",
};

test("reads the id from a real injective-888 create response", () => {
    assert.equal(parseCampaignId(LIVE_RESPONSE), 1);
});

test("does not depend on rawLog, which the live response leaves empty", () => {
    assert.equal(LIVE_RESPONSE.rawLog, "");
    assert.deepEqual(LIVE_RESPONSE.logs, []);
    assert.equal(parseCampaignId({ ...LIVE_RESPONSE, rawLog: undefined }), 1);
});

test("reads the id from the wasm event when wasm-update_root is absent", () => {
    const events = LIVE_RESPONSE.events.filter((e) => e.type === "wasm");
    assert.equal(parseCampaignId({ ...LIVE_RESPONSE, events }), 1);
});

test("falls back to rawLog when no decoded events are present", () => {
    const rawLog = JSON.stringify([{ events: LIVE_RESPONSE.events }]);
    assert.equal(parseCampaignId({ rawLog }), 1);
});

test("ignores an id that does not follow action=create_campaign", () => {
    // A claim tx also emits `wasm` with an `id`; only a create publishes a root,
    // so a response carrying neither create_campaign nor wasm-update_root must
    // not hand back some other call's campaign id as if it were a new drop.
    const decoy = {
        events: [
            {
                type: "wasm",
                attributes: [
                    { key: "_contract_address", value: "inj1f2htctksx6jfcrt5gr3yf4vnmgs70a9zxurp53" },
                    { key: "action", value: "claim" },
                    { key: "id", value: "7" },
                ],
            },
        ],
    };
    assert.equal(parseCampaignId(decoy), null);
});

test("returns null rather than guessing", () => {
    assert.equal(parseCampaignId(null), null);
    assert.equal(parseCampaignId(undefined), null);
    assert.equal(parseCampaignId({}), null);
    assert.equal(parseCampaignId({ events: [] }), null);
    assert.equal(parseCampaignId({ rawLog: "not json" }), null);
    // id 0 is not a valid campaign (CAMPAIGN_SEQ is pre-incremented, so ids
    // start at 1) — a 0 means we misread the response.
    assert.equal(
        parseCampaignId({
            events: [
                {
                    type: "wasm-update_root",
                    attributes: [{ key: "id", value: "0" }],
                },
            ],
        }),
        null,
    );
});
