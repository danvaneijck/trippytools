// Run with: node --test src/modules/shroomTokenMeta.test.ts   (`yarn test:unit`)
//
// This file is the regression test for the airdrop page rendering MOTION as
// "codehash probe / PROBE" (2026-08-25). Two independent faults stacked, and
// the fixtures below are the live mainnet values that pin both:
//
//   1. A launch id is namespaced by its CORE. MOTION is launch 0 on the v2 core
//      `0xd948…`; launch 0 on the v1 core `0xeBF6…` is a throwaway probe. The
//      denom carries only the id, both cores answer `getLaunch(0)` happily, and
//      the resolver used to ask v1 unconditionally. The issuer's
//      `launch_by_denom` is what breaks the tie — it hands back the launch's
//      ERC-20, which is unique across cores.
//   2. Issuer 1.1 (mainnet 2026-08-24) writes the creator's name/symbol into
//      `MsgCreateDenom`, so v2-era bank metadata is already correct and must not
//      be overlaid. Only the pre-1.1 raw-subdenom branding gets replaced.
import { strict as assert } from "node:assert";
import test, { afterEach } from "node:test";
import { Interface } from "ethers";

// Explicit .ts extension so `node --test` can resolve it with no loader or build
// step (tsconfig sets allowImportingTsExtensions, and Vite handles it too).
import { fetchShroomTokenMeta, withShroomMetadata } from "./shroomTokenMeta.ts";

const ISSUER = "inj13j2rpnlwl30c02d4pzukykwfeyyhelvry9cqte";
const CORE_V1 = "0xeBF62508F322137EE0986935Ee3b4A60a3F0D227";
// v2 core `0xd948…` serves its reads through this views satellite; v1 serves
// its own getters, so the read address doubles as the core's identity here.
const READS_V2 = "0x4a4e90f87F5376E25E235B1d0609857C06f520B6";
const ZERO = "0x0000000000000000000000000000000000000000";

// Declared independently of the module under test: if its tuple ever drifts —
// notably v2's extra `curveId`, which shifts every dynamic offset after it —
// the decode fails here rather than silently returning a wrong string.
const TUPLE_HEAD =
    "uint8 state, address creator, address token, address sink, uint8 quoteAsset, " +
    "tuple(address gateToken, uint256 minBalance, uint64 windowEndsAt, uint16 discountBps) gate, " +
    "uint64 tradingOpensAt, uint64 guardWindowEndsAt, uint16 maxBuyBpsInGuardWindow, " +
    "uint64 bindDeadline, address settler, address pairAsset, uint256 virtualPair, " +
    "uint256 virtualToken, uint256 curveSupply, uint256 graduationPairTarget, " +
    "uint256 graduationTokenReserve, uint256 realPair, uint256 tokensSold, " +
    "uint256 refundPairTotal, uint256 refundTokensTotal, uint256 refundPairPaid, " +
    "uint256 refundTokensReceived, uint256 feeEscrowed, uint16 tradeFeeBps, " +
    "uint16 creatorFeeShareBps, ";
const TUPLE_TAIL =
    "string bankDenom, bool requiresChoiceFactoryDust, string metadataURI, uint8 poolKind";
const ifaceFor = (hasCurveId: boolean) =>
    new Interface([
        `function getLaunch(uint256 launchId) view returns (tuple(${TUPLE_HEAD}${
            hasCurveId ? "uint16 curveId, " : ""
        }${TUPLE_TAIL}))`,
    ]);
const IFACE = { [CORE_V1.toLowerCase()]: ifaceFor(false), [READS_V2.toLowerCase()]: ifaceFor(true) };

const dataUri = (meta: Record<string, string>) =>
    "data:application/json;base64," + Buffer.from(JSON.stringify(meta)).toString("base64");

/** A launch as `getLaunch` returns it — only `token` and `metadataURI` are read. */
function encodeLaunch(reads: string, token: string, metadataURI: string): string {
    const iface = IFACE[reads.toLowerCase()];
    const hasCurveId = reads.toLowerCase() === READS_V2.toLowerCase();
    const tuple: unknown[] = [
        0, ZERO, token, ZERO, 0, [ZERO, 0, 0, 0], 0, 0, 0, 0, ZERO, ZERO,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    if (hasCurveId) tuple.push(0);
    tuple.push("inj", false, metadataURI, 0);
    return iface.encodeFunctionResult("getLaunch", [tuple]);
}

const MOTION_ERC20 = "0x7a1C36f34e43014EfD5E08ead6f99118BC1ACA20"; // v2 launch 0
const PROBE_ERC20 = "0x9F4979a89dadC8e428a3794e150373c3DD6ED523"; // v1 launch 0
const IPEPE_ERC20 = "0x1111111111111111111111111111111111111111"; // v2 launch 15
const V1_MOTION_ERC20 = "0xBC3B6a4583f97d80B97F8b0455223699360D225A"; // v1 launch 15

const MOTION_META = { name: "MOTION", symbol: "MOTION", image: "ipfs://motion", description: "nothing happens until something moves." };
const PROBE_META = { name: "codehash probe", symbol: "PROBE", description: "throwaway launch" };

/** `<core> -> <id> -> launch`, i.e. the two id namespaces the bug conflated. */
const CHAIN: Record<string, Record<string, { token: string; meta: Record<string, string> }>> = {
    [READS_V2.toLowerCase()]: {
        "0": { token: MOTION_ERC20, meta: MOTION_META },
        "15": { token: IPEPE_ERC20, meta: { name: "inj PEPE", symbol: "IPEPE" } },
    },
    [CORE_V1.toLowerCase()]: {
        "0": { token: PROBE_ERC20, meta: PROBE_META },
        "15": { token: V1_MOTION_ERC20, meta: { name: "motion", symbol: "MOTION" } },
    },
};

/** denom -> what the issuer's `launch_by_denom` answers. */
const ISSUER_RECORDS: Record<string, { internal_id: number; erc20_address: string }> = {};

const denomFor = (salt: string, id: number) => `factory/${ISSUER}/shroom_${id}_${salt}`;

/** Register a denom the issuer knows about, and return it. */
function knownDenom(salt: string, id: number, erc20: string): string {
    const denom = denomFor(salt, id);
    ISSUER_RECORDS[denom] = { internal_id: id, erc20_address: erc20 };
    return denom;
}

let issuerAnswers = true;
const realFetch = globalThis.fetch;

/** A stand-in chain: the issuer over LCD, the cores over EVM JSON-RPC. */
function respond(href: string, init?: any): Response {
    if (href.includes("/cosmwasm/wasm/v1/contract/")) {
        if (!issuerAnswers) return new Response("upstream", { status: 502 });
        const b64 = decodeURIComponent(href.split("/smart/")[1]);
        const q = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
        const denom = q?.launch_by_denom?.denom;
        const rec = ISSUER_RECORDS[denom];
        if (!rec) return new Response(JSON.stringify({ code: 2, message: "not found" }), { status: 400 });
        return new Response(JSON.stringify({ data: { denom, ...rec } }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    const to = String(body.params?.[0]?.to ?? "").toLowerCase();
    const id = BigInt("0x" + String(body.params?.[0]?.data ?? "").slice(-64)).toString();
    const hit = CHAIN[to]?.[id];
    // An id a core never issued answers with a zeroed struct, not an error —
    // exactly how v1 replies for anything past its frozen 0-15.
    const result = hit ? encodeLaunch(to, hit.token, dataUri(hit.meta)) : encodeLaunch(to, ZERO, "");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
}

function stubFetch() {
    globalThis.fetch = ((url: any, init?: any) =>
        Promise.resolve(respond(String(url), init))) as typeof fetch;
}

afterEach(() => {
    globalThis.fetch = realFetch;
    issuerAnswers = true;
});

test("the same launch id on two cores resolves to the core that minted the denom", async () => {
    stubFetch();
    // Both cores have a launch 0. The one MOTION's denom belongs to is v2's.
    const motion = await fetchShroomTokenMeta(knownDenom("aa00000000000001", 0, MOTION_ERC20));
    assert.equal(motion?.name, "MOTION");
    assert.equal(motion?.symbol, "MOTION");

    // ...and a denom that really is v1's launch 0 still resolves to the probe.
    const probe = await fetchShroomTokenMeta(knownDenom("aa00000000000002", 0, PROBE_ERC20));
    assert.equal(probe?.symbol, "PROBE");
});

test("id 15 exists on both cores and each denom keeps its own coin", async () => {
    stubFetch();
    const v2 = await fetchShroomTokenMeta(knownDenom("bb00000000000001", 15, IPEPE_ERC20));
    const v1 = await fetchShroomTokenMeta(knownDenom("bb00000000000002", 15, V1_MOTION_ERC20));
    assert.equal(v2?.symbol, "IPEPE");
    assert.equal(v1?.name, "motion");
});

test("refuses to guess a core when the issuer cannot be reached", async () => {
    stubFetch();
    issuerAnswers = false;
    // Reading the wrong core returns a real, different coin, so a null (raw
    // denom shown) is the only safe answer on a multi-core network.
    assert.equal(await fetchShroomTokenMeta(knownDenom("cc00000000000001", 0, MOTION_ERC20)), null);
});

test("a denom from an unknown issuer is never enriched", async () => {
    stubFetch();
    const foreign = "factory/inj1xtel2knkt8hmc9dnzpjz6kdmacgcfmlv5f308w/shroom_0_dd00000000000001";
    assert.equal(await fetchShroomTokenMeta(foreign), null);
});

test("branded bank metadata wins; the launch only fills what the chain cannot carry", async () => {
    stubFetch();
    const denom = knownDenom("ee00000000000001", 0, MOTION_ERC20);
    const onChain = { name: "MOTION", symbol: "MOTION", decimals: 18, logo: "", description: "" };
    const merged = await withShroomMetadata(denom, onChain);
    assert.equal(merged.name, "MOTION");
    assert.equal(merged.symbol, "MOTION");
    assert.equal(merged.decimals, 18);
    assert.equal(merged.logo, "ipfs://motion");
    assert.equal(merged.description, "nothing happens until something moves.");
});

test("raw subdenom branding (pre-1.1 issuer) is replaced by the launch metadata", async () => {
    stubFetch();
    const salt = "ff00000000000001";
    const denom = knownDenom(salt, 15, V1_MOTION_ERC20);
    const onChain = {
        name: `shroom_15_${salt}`,
        symbol: `SHROOM_15_${salt}`.toUpperCase(),
        decimals: 18,
        logo: "",
    };
    const merged = await withShroomMetadata(denom, onChain);
    assert.equal(merged.name, "motion");
    assert.equal(merged.symbol, "MOTION");
    assert.equal(merged.decimals, 18);
});

test("a name the caps dropped is treated as unbranded, not as authority", async () => {
    stubFetch();
    const denom = knownDenom("ff00000000000002", 0, MOTION_ERC20);
    const merged = await withShroomMetadata(denom, { name: "", symbol: "", decimals: 18 });
    assert.equal(merged.name, "MOTION");
    assert.equal(merged.symbol, "MOTION");
});
