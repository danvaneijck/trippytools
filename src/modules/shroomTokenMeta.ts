/// Friendly name/symbol/logo resolution for SHROOM launchpad tokens.
///
/// Two eras of launch token exist on mainnet and they need OPPOSITE treatment:
///
///   • Issuer ≤1.0 (every launch on the v1 core) minted the denom with the raw
///     subdenom as its bank name/symbol — `shroom_1_391dfd403560de90` /
///     `SHROOM_1_391DFD403560DE90`. injectived v1.20+ locks denom metadata at
///     `MsgCreateDenom`, so that branding is PERMANENT and the human-facing
///     name/symbol/image only ever live in the launch's off-chain metadata blob,
///     pointed to by `metadataURI` on the EVM `LaunchpadCore`. These want the
///     overlay.
///   • Issuer ≥1.1 (mainnet 2026-08-24, so every launch on the v2 core) writes
///     the creator's name/symbol into `MsgCreateDenom` itself. Their bank
///     metadata is already correct and IS the authority — overlaying it can only
///     make things worse. Those launches get the image and description added,
///     nothing overwritten.
///
/// 🔴 A launch's identity is the PAIR (core, launch id), never the id alone.
/// Both deployed cores number their launches from 0 and share one tokenfactory
/// issuer, so `factory/<issuer>/shroom_0_…` is a live id on BOTH: MOTION is v2
/// launch 0, while v1 launch 0 is a throwaway "codehash probe". Reading the
/// wrong core does not error — it returns a real, different coin. The denom
/// alone cannot say which core minted it; the issuer can (`launch_by_denom`), so
/// resolution goes through it and then confirms the launch it read really owns
/// that ERC-20.
///
/// Reads go straight to chain — EVM JSON-RPC for the launch, LCD for the issuer,
/// both CORS-open — so there is no SHROOM backend dependency and this works for
/// every already-launched token.
///
/// `ethers` is provided transitively by `@injectivelabs/sdk-ts` (a direct dep);
/// we only use its ABI codec here, no provider.

import { Interface } from "ethers";

interface ShroomCore {
    /// `LaunchpadCore` address. This is the launch id's namespace, and the
    /// `evm_authority` the issuer records against the denom.
    core: string;
    /// Address that serves `getLaunch` for this core: v1 serves its own getters,
    /// v2 routes reads through a views satellite (its core reverts).
    reads: string;
    /// ABI shape for this core's `Launch` tuple. v2 carries a `curveId` v1 does
    /// not, and every dynamic-field offset after it shifts, so the two shapes
    /// are not interchangeable — decoding with the wrong one throws or yields
    /// garbage.
    iface: Interface;
}

interface ShroomDeployment {
    label: string;
    /// Bech32 tokenfactory issuer (choice_mts_issuer) — the middle segment of a
    /// SHROOM denom `factory/<issuer>/<subdenom>`. This is our match key: only
    /// denoms minted by a known SHROOM issuer get enriched, so a foreign
    /// `factory/…/shroom_N_x` denom from another issuer is never mis-resolved.
    /// It is also the contract we ask which core a denom belongs to.
    issuer: string;
    /// CORS-open LCD REST endpoint, for the issuer's `launch_by_denom` query.
    lcd: string;
    /// CORS-open EVM JSON-RPC endpoint for this network.
    rpc: string;
    /// Newest core first — the order only matters for tie-breaking a deployment
    /// that has lost its issuer lookup, which today means single-core networks.
    cores: ShroomCore[];
}

// The `Launch` struct returned by `getLaunch` — mirrors the SHROOM FE ABI. We
// only read `metadataURI` and `token`, but ethers needs the whole tuple to
// decode the return data (dynamic-field offsets depend on every preceding
// field).
const LAUNCH_TUPLE_HEAD =
    "uint8 state, address creator, address token, address sink, uint8 quoteAsset, " +
    "tuple(address gateToken, uint256 minBalance, uint64 windowEndsAt, uint16 discountBps) gate, " +
    "uint64 tradingOpensAt, uint64 guardWindowEndsAt, uint16 maxBuyBpsInGuardWindow, " +
    "uint64 bindDeadline, address settler, address pairAsset, uint256 virtualPair, " +
    "uint256 virtualToken, uint256 curveSupply, uint256 graduationPairTarget, " +
    "uint256 graduationTokenReserve, uint256 realPair, uint256 tokensSold, " +
    "uint256 refundPairTotal, uint256 refundTokensTotal, uint256 refundPairPaid, " +
    "uint256 refundTokensReceived, uint256 feeEscrowed, uint16 tradeFeeBps, " +
    "uint16 creatorFeeShareBps, ";
const LAUNCH_TUPLE_TAIL =
    "string bankDenom, bool requiresChoiceFactoryDust, string metadataURI, uint8 poolKind";

const ifaceFor = (hasCurveId: boolean) =>
    new Interface([
        `function getLaunch(uint256 launchId) view returns (tuple(${LAUNCH_TUPLE_HEAD}${
            hasCurveId ? "uint16 curveId, " : ""
        }${LAUNCH_TUPLE_TAIL}))`,
    ]);

const IFACE_V1 = ifaceFor(false);
const IFACE_V2 = ifaceFor(true);

const SHROOM_DEPLOYMENTS: ShroomDeployment[] = [
    {
        label: "mainnet",
        issuer: "inj13j2rpnlwl30c02d4pzukykwfeyyhelvry9cqte",
        lcd: "https://sentry.lcd.injective.network",
        rpc: "https://sentry.evm-rpc.injective.network",
        cores: [
            {
                // v2, live 2026-08-24. Takes every new launch and numbers from 0
                // again; reads go to the views satellite.
                core: "0xd948740da926E8908A08414879490d0D8F96D463",
                reads: "0x4a4e90f87F5376E25E235B1d0609857C06f520B6",
                iface: IFACE_V2,
            },
            {
                // v1, closed to new launches (frozen at 16, ids 0-15) but still
                // trading and graduating what it holds. Serves its own getters.
                core: "0xeBF62508F322137EE0986935Ee3b4A60a3F0D227",
                reads: "0xeBF62508F322137EE0986935Ee3b4A60a3F0D227",
                iface: IFACE_V1,
            },
        ],
    },
    {
        // Testnet issuer churns on redeploys; denoms from an older instance
        // simply don't match this issuer and fall back to their raw on-chain
        // name (harmless). Mainnet is the real target for airdrops.
        label: "testnet",
        issuer: "inj16cw0rq6upkcltpynsmw4ckrn8a2hcykfgzlucf",
        lcd: "https://testnet.sentry.lcd.injective.network",
        rpc: "https://injectiveevm-testnet-rpc.polkachu.com",
        cores: [
            {
                core: "0xb03fb1c05f7853601ae05ba7e3700a59dc14a71d",
                reads: "0x60e12ebaf2d3f8a6249a934d44f502708dcb156d",
                iface: IFACE_V2,
            },
        ],
    },
];

export interface ShroomTokenMeta {
    name?: string;
    symbol?: string;
    image?: string;
    description?: string;
}

interface ParsedDenom {
    /// The launch id carried by the subdenom. Per-core, so it is only usable on
    /// its own when the deployment has exactly one core — see `resolveLaunch`.
    subdenomId: bigint;
    deployment: ShroomDeployment;
}

/// Parse a bank denom into a SHROOM launch reference, or null when it isn't a
/// known SHROOM launch denom. Denoms are `factory/<issuer>/<prefix>_<id>_<salt>`
/// (`shroom_12_…` on mainnet, `shroom_t_4_…` on testnet), where `<id>` is the
/// launch's id on its own core and `<salt>` is anti-squat entropy.
function parseShroomDenom(denom: string): ParsedDenom | null {
    const parts = denom.split("/");
    if (parts.length !== 3 || parts[0] !== "factory") return null;
    const [, issuer, subdenom] = parts;
    const deployment = SHROOM_DEPLOYMENTS.find((d) => d.issuer === issuer);
    if (!deployment) return null;
    const m = /_(\d+)_[0-9a-f]+$/.exec(subdenom);
    if (!m) return null;
    try {
        return { subdenomId: BigInt(m[1]), deployment };
    } catch {
        return null;
    }
}

const RPC_TIMEOUT_MS = 8000;

/// One POST with a timeout, retried once on transport/RPC errors (the injective
/// sentry pool 502s intermittently). Returns null rather than throwing.
async function postJson(url: string, body: unknown): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });
            if (!res.ok) continue; // transient (e.g. 502) → retry
            return await res.json();
        } catch {
            // network error / abort / parse failure → retry once, then give up
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

async function getJson(url: string): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            // A CosmWasm query error (unknown variant, no such denom) comes back
            // 4xx/5xx with a JSON body — either way there is nothing to read, so
            // a retry costs one request and settles it.
            if (!res.ok) continue;
            return await res.json();
        } catch {
            // network error / abort / parse failure → retry once, then give up
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

const sameAddress = (a: string | undefined, b: string | undefined) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

interface IssuerRecord {
    /// The launch's id ON ITS OWN CORE (the issuer keys records by
    /// `(evm_authority, internal_id)`).
    internalId: bigint;
    /// The launch token's ERC-20 — hex, so it identifies the minting core
    /// without having to convert the issuer's bech32 `evm_authority`.
    erc20?: string;
}

/// Ask the issuer which launch a denom belongs to. This is the only source that
/// knows, since the id inside the denom is namespaced by core.
async function readIssuerRecord(
    d: ShroomDeployment,
    denom: string,
): Promise<IssuerRecord | null> {
    const query = btoa(JSON.stringify({ launch_by_denom: { denom } }));
    const url = `${d.lcd}/cosmwasm/wasm/v1/contract/${d.issuer}/smart/${encodeURIComponent(query)}`;
    const json = await getJson(url);
    const data = json?.data;
    if (!data || data.internal_id === undefined || data.internal_id === null) return null;
    try {
        return {
            internalId: BigInt(String(data.internal_id)),
            erc20: typeof data.erc20_address === "string" ? data.erc20_address : undefined,
        };
    } catch {
        return null;
    }
}

interface LaunchRead {
    core: ShroomCore;
    token?: string;
    metadataURI?: string;
}

/// Read one core's `getLaunch(id)`. Null on a missing launch or a failed read;
/// an unlaunched id answers with a zeroed struct (empty `metadataURI`), which
/// the caller treats as "not this core".
async function readLaunch(
    d: ShroomDeployment,
    core: ShroomCore,
    id: bigint,
): Promise<LaunchRead | null> {
    const data = core.iface.encodeFunctionData("getLaunch", [id]);
    const json = await postJson(d.rpc, {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: core.reads, data }, "latest"],
    });
    const result: unknown = json?.result;
    if (json?.error || typeof result !== "string" || result === "0x") return null;
    try {
        const [launch] = core.iface.decodeFunctionResult("getLaunch", result);
        const l = launch as { token?: unknown; metadataURI?: unknown };
        return {
            core,
            token: typeof l?.token === "string" ? l.token : undefined,
            metadataURI: typeof l?.metadataURI === "string" ? l.metadataURI : undefined,
        };
    } catch {
        return null;
    }
}

/// Resolve a denom to the ONE launch that minted it, across every core of its
/// deployment. Returns null rather than guessing: a wrong core answers with a
/// real, valid, different launch, so a guess costs correctness while a null only
/// costs the overlay.
async function resolveLaunch(denom: string): Promise<LaunchRead | null> {
    const parsed = parseShroomDenom(denom);
    if (!parsed) return null;
    const { deployment, subdenomId } = parsed;

    const record = await readIssuerRecord(deployment, denom);
    // Without the issuer's answer the subdenom id is only safe where it cannot
    // be ambiguous — a deployment with a single core.
    if (!record && deployment.cores.length > 1) return null;
    const id = record?.internalId ?? subdenomId;

    const reads = (await Promise.all(deployment.cores.map((c) => readLaunch(deployment, c, id))))
        .filter((r): r is LaunchRead => !!r && !!r.metadataURI);
    if (reads.length === 0) return null;
    // The ERC-20 the issuer recorded against this denom picks the core. Only a
    // single-core deployment may skip that check (nothing to confuse it with).
    if (record?.erc20) return reads.find((r) => sameAddress(r.token, record.erc20)) ?? null;
    return deployment.cores.length === 1 ? reads[0] : null;
}

const DATA_JSON_B64 = "data:application/json;base64,";
const DATA_JSON_PLAIN = "data:application/json,";

/// Decode an inline `data:` metadataURI. Legacy `shroom://<hash>` URIs would need
/// the SHROOM backend (CORS-restricted from here) and so resolve to null — the
/// caller then keeps the raw on-chain name. All current launches are inline.
function decodeMetadataUri(uri: string): ShroomTokenMeta | null {
    try {
        let jsonStr: string | null = null;
        if (uri.startsWith(DATA_JSON_B64)) {
            const bin = atob(uri.slice(DATA_JSON_B64.length));
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            jsonStr = new TextDecoder().decode(bytes); // UTF-8 (emoji/non-latin safe)
        } else if (uri.startsWith(DATA_JSON_PLAIN)) {
            jsonStr = decodeURIComponent(uri.slice(DATA_JSON_PLAIN.length));
        }
        if (!jsonStr) return null;
        const m = JSON.parse(jsonStr) as Record<string, unknown>;
        return {
            name: typeof m.name === "string" ? m.name : undefined,
            symbol: typeof m.symbol === "string" ? m.symbol : undefined,
            image: typeof m.image === "string" ? m.image : undefined,
            description: typeof m.description === "string" ? m.description : undefined,
        };
    } catch {
        return null;
    }
}

/// Resolve a SHROOM launch token's friendly metadata from its bank denom, or
/// null if the denom isn't a known SHROOM launch denom / the read fails.
/// Best-effort: every failure path returns null.
export async function fetchShroomTokenMeta(denom: string): Promise<ShroomTokenMeta | null> {
    const launch = await resolveLaunch(denom);
    if (!launch?.metadataURI) return null;
    return decodeMetadataUri(launch.metadataURI);
}

// Session cache for the cached wrapper below. Launch metadata is immutable per
// denom, so a successful resolution is cached for good; a definitive "not a
// SHROOM denom" (parse fails) is also cached. Transient RPC failures are NOT
// cached — they resolve to null without a cache entry so a later render retries.
const shroomMetaCache = new Map<string, ShroomTokenMeta | null>();
const shroomMetaInflight = new Map<string, Promise<ShroomTokenMeta | null>>();

/// Cached, dedup'd variant of `fetchShroomTokenMeta`. Safe to call from every
/// row of a list (e.g. the airdrop-history feed): concurrent calls for the same
/// denom share one in-flight request, and resolved results are memoized for the
/// session so re-renders don't re-hit the RPC.
export function fetchShroomTokenMetaCached(denom: string): Promise<ShroomTokenMeta | null> {
    if (shroomMetaCache.has(denom)) return Promise.resolve(shroomMetaCache.get(denom) ?? null);
    const inflight = shroomMetaInflight.get(denom);
    if (inflight) return inflight;
    const p = (async () => {
        if (!parseShroomDenom(denom)) {
            shroomMetaCache.set(denom, null); // definitively not SHROOM — cache the miss
            return null;
        }
        const meta = await fetchShroomTokenMeta(denom);
        if (meta) shroomMetaCache.set(denom, meta); // only cache successes; let failures retry
        return meta;
    })().finally(() => shroomMetaInflight.delete(denom));
    shroomMetaInflight.set(denom, p);
    return p;
}

/// True when a bank-metadata field is still the raw subdenom the pre-1.1 issuer
/// minted (`shroom_13_f9ac767…` / `SHROOM_13_F9AC767…`), or missing entirely
/// because the value overran the tokenfactory caps. Those are the only fields
/// the launch metadata is allowed to replace: anything else was branded by the
/// creator at `MsgCreateDenom` and is the authority.
function isUnbranded(value: unknown, subdenom: string): boolean {
    if (typeof value !== "string" || value.trim() === "") return true;
    return value.toLowerCase() === subdenom.toLowerCase();
}

/// Overlay SHROOM friendly name/symbol/logo/description onto a raw bank-metadata
/// object (as returned by `TokenUtils.getDenomExtraMetadata`), leaving
/// decimals / total_supply / admin untouched so downstream amount math is
/// unaffected. A no-op for non-SHROOM denoms or on any resolution failure.
///
/// 🔴 Name and symbol are only overlaid when the chain still carries the raw
/// subdenom. A launch minted by issuer ≥1.1 already has the creator's real
/// name/symbol in bank metadata, and overwriting that is how MOTION came to
/// render as another launch's "codehash probe / PROBE".
export async function withShroomMetadata(denom: string, meta: any): Promise<any> {
    const shroom = await fetchShroomTokenMetaCached(denom);
    if (!shroom) return meta;
    const subdenom = denom.split("/")[2] ?? "";
    const takeName = shroom.name && isUnbranded(meta?.name, subdenom);
    const takeSymbol = shroom.symbol && isUnbranded(meta?.symbol, subdenom);
    return {
        ...meta,
        ...(takeName ? { name: shroom.name } : {}),
        ...(takeSymbol ? { symbol: shroom.symbol } : {}),
        // Bank metadata has nowhere to put a launch's artwork or blurb (`uri` and
        // `description` come back empty for launch denoms in both eras), so these
        // are additive, never a replacement for something the chain carries.
        ...(shroom.image && !meta?.logo ? { logo: shroom.image } : {}),
        ...(shroom.description && !meta?.description ? { description: shroom.description } : {}),
    };
}
