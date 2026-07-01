/// Friendly name/symbol resolution for SHROOM launchpad tokens.
///
/// A SHROOM launch token is a tokenfactory denom whose ON-CHAIN bank metadata is
/// the raw subdenom (e.g. `shroom_1_391dfd403560de90`): the issuer deliberately
/// never prettifies it, because injectived v1.20+ locks denom-metadata decimals
/// at `MsgCreateDenom`, so a follow-up `MsgSetDenomMetadata` errors out. The
/// human-facing name/symbol/image instead live in the launch's off-chain
/// metadata blob, pointed to by `metadataURI` on the EVM `LaunchpadCore`
/// contract. We read that pointer straight from the chain via EVM JSON-RPC
/// (CORS-open) and decode the inline `data:` blob locally — no SHROOM backend
/// dependency, and it works for every already-launched token.
///
/// `ethers` is provided transitively by `@injectivelabs/sdk-ts` (a direct dep);
/// we only use its ABI codec here, no provider.

import { Interface } from "ethers";

interface ShroomDeployment {
    label: string;
    /// Bech32 tokenfactory issuer (choice_mts_issuer) — the middle segment of a
    /// SHROOM denom `factory/<issuer>/<subdenom>`. This is our match key: only
    /// denoms minted by a known SHROOM issuer get enriched, so a foreign
    /// `factory/…/shroom_N_x` denom from another issuer is never mis-resolved.
    issuer: string;
    /// EVM `LaunchpadCore` address — `getLaunch(id)` returns the metadataURI.
    core: string;
    /// CORS-open EVM JSON-RPC endpoint for this network.
    rpc: string;
}

const SHROOM_DEPLOYMENTS: ShroomDeployment[] = [
    {
        label: "mainnet",
        issuer: "inj13j2rpnlwl30c02d4pzukykwfeyyhelvry9cqte",
        core: "0xeBF62508F322137EE0986935Ee3b4A60a3F0D227",
        rpc: "https://sentry.evm-rpc.injective.network",
    },
    {
        // Testnet issuer churns on redeploys; older testnet instances won't match
        // (they just fall back to the raw denom name — harmless). Mainnet is the
        // real target for airdrops.
        label: "testnet",
        issuer: "inj1wjshrwrmt03v5eywfpuce6sg08h3gfnrcahqgj",
        core: "0x82ff4f7c7b4a4fe77a47d71c7700d17873a0d63f",
        rpc: "https://injectiveevm-testnet-rpc.polkachu.com",
    },
];

// Full Launch struct returned by LaunchpadCore.getLaunch — mirrors the SHROOM FE
// ABI. We only read `metadataURI`, but ethers needs the whole tuple to decode
// the return data (dynamic-field offsets depend on every preceding field).
const LAUNCH_TUPLE =
    "tuple(uint8 state, address creator, address token, address sink, uint8 quoteAsset, " +
    "tuple(address gateToken, uint256 minBalance, uint64 windowEndsAt, uint16 discountBps) gate, " +
    "uint64 tradingOpensAt, uint64 guardWindowEndsAt, uint16 maxBuyBpsInGuardWindow, " +
    "uint64 bindDeadline, address settler, address pairAsset, uint256 virtualPair, " +
    "uint256 virtualToken, uint256 curveSupply, uint256 graduationPairTarget, " +
    "uint256 graduationTokenReserve, uint256 realPair, uint256 tokensSold, " +
    "uint256 refundPairTotal, uint256 refundTokensTotal, uint256 refundPairPaid, " +
    "uint256 refundTokensReceived, uint256 feeEscrowed, uint16 tradeFeeBps, " +
    "uint16 creatorFeeShareBps, " +
    "string bankDenom, bool requiresChoiceFactoryDust, string metadataURI, uint8 poolKind)";

const CORE_IFACE = new Interface([
    `function getLaunch(uint256 launchId) view returns (${LAUNCH_TUPLE})`,
]);

export interface ShroomTokenMeta {
    name?: string;
    symbol?: string;
    image?: string;
    description?: string;
}

interface ParsedDenom {
    launchId: bigint;
    deployment: ShroomDeployment;
}

/// Parse a bank denom into a SHROOM launch reference, or null when it isn't a
/// known SHROOM launch denom. Denoms are `factory/<issuer>/<prefix>_<id>_<salt>`
/// — the issuer's subdenom prefix is alphanumeric (no underscore), `<id>` is the
/// LaunchpadCore launch id (== the issuer's internal_id), `<salt>` is anti-squat
/// entropy. So the launch id is always the 2nd underscore-delimited segment.
function parseShroomDenom(denom: string): ParsedDenom | null {
    const parts = denom.split("/");
    if (parts.length !== 3 || parts[0] !== "factory") return null;
    const [, issuer, subdenom] = parts;
    const deployment = SHROOM_DEPLOYMENTS.find((d) => d.issuer === issuer);
    if (!deployment) return null;
    const segs = subdenom.split("_");
    if (segs.length < 2 || !/^\d+$/.test(segs[1])) return null;
    try {
        return { launchId: BigInt(segs[1]), deployment };
    } catch {
        return null;
    }
}

const RPC_TIMEOUT_MS = 8000;

/// Read `LaunchpadCore.getLaunch(id).metadataURI` via a raw eth_call. Retries
/// once on transport/RPC errors (the injective sentry pool 502s intermittently);
/// returns null on a clean "no such launch" or after retries are exhausted.
async function readMetadataUri(p: ParsedDenom): Promise<string | null> {
    const data = CORE_IFACE.encodeFunctionData("getLaunch", [p.launchId]);
    for (let attempt = 0; attempt < 2; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
        try {
            const res = await fetch(p.deployment.rpc, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "eth_call",
                    params: [{ to: p.deployment.core, data }, "latest"],
                }),
                signal: ctrl.signal,
            });
            if (!res.ok) continue; // transient (e.g. 502) → retry
            const json = await res.json();
            if (json?.error) continue; // rpc-level error → retry
            const result: unknown = json?.result;
            if (typeof result !== "string" || result === "0x") return null; // no launch
            const [launch] = CORE_IFACE.decodeFunctionResult("getLaunch", result);
            const uri = (launch as { metadataURI?: unknown })?.metadataURI;
            return typeof uri === "string" && uri.length > 0 ? uri : null;
        } catch {
            // network error / abort / decode failure → retry once, then give up
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
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
    const parsed = parseShroomDenom(denom);
    if (!parsed) return null;
    const uri = await readMetadataUri(parsed);
    if (!uri) return null;
    return decodeMetadataUri(uri);
}

/// Overlay SHROOM friendly name/symbol/logo/description onto a raw bank-metadata
/// object (as returned by `TokenUtils.getDenomExtraMetadata`), leaving
/// decimals / total_supply / admin untouched so downstream amount math is
/// unaffected. A no-op for non-SHROOM denoms or on any resolution failure.
export async function withShroomMetadata(denom: string, meta: any): Promise<any> {
    const shroom = await fetchShroomTokenMeta(denom);
    if (!shroom) return meta;
    return {
        ...meta,
        ...(shroom.name ? { name: shroom.name } : {}),
        ...(shroom.symbol ? { symbol: shroom.symbol } : {}),
        ...(shroom.image ? { logo: shroom.image } : {}),
        ...(shroom.description ? { description: shroom.description } : {}),
    };
}
