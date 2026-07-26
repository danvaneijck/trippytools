/**
 * Get a drop's leaves, so a proof can be derived client-side.
 *
 * Two sources, deliberately: the on-chain `leaves_uri` is the canonical public
 * document (anyone can audit a drop from the chain alone, with no dependency on
 * our backend), and Hasura is the fallback for when that host is unreachable,
 * blocked as mixed content on an https page, or serving a stale cache. Either way
 * the caller MUST rebuild the tree and check the root — neither source is trusted,
 * the on-chain root is.
 */
import client from "../apolloClient";
import { GET_LEAVES_BY_ROOT } from "./hasura";
import type { LeafInput } from "./merkle";

export interface LeavesFetch {
    leaves: LeafInput[];
    /** The document's own declared total, when it carries one. */
    total?: string;
    source: "uri" | "hasura";
}

/**
 * `leaves_uri` is creator-supplied text stored on-chain, so it is NOT a safe URL
 * to hand to fetch() unchecked — only http(s) is ever dereferenced here.
 */
const isFetchableUrl = (uri: string): boolean => {
    try {
        const { protocol } = new URL(uri);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
};

/** Narrow an untrusted JSON payload to leaves without trusting any field. */
const asLeaves = (value: unknown): LeafInput[] | null => {
    if (!Array.isArray(value)) return null;
    const out: LeafInput[] = [];
    for (const entry of value) {
        if (typeof entry !== "object" || entry === null) return null;
        const { address, amount } = entry as Record<string, unknown>;
        if (typeof address !== "string" || typeof amount !== "string") return null;
        out.push({ address, amount });
    }
    return out;
};

async function fromUri(leavesUri: string): Promise<LeavesFetch | null> {
    if (!isFetchableUrl(leavesUri)) return null;
    const res = await fetch(leavesUri);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const doc: unknown = await res.json();
    const body = typeof doc === "object" && doc !== null ? (doc as Record<string, unknown>) : {};
    const leaves = asLeaves(body.leaves);
    if (!leaves) throw new Error("document has no usable `leaves` array");
    return {
        leaves,
        ...(typeof body.total === "string" ? { total: body.total } : {}),
        source: "uri",
    };
}

async function fromHasura(root: string): Promise<LeavesFetch | null> {
    const { data } = await client.query<{
        claim_drop_leaves_by_pk: { root: string; total: string; leaves: unknown } | null;
    }>({
        query: GET_LEAVES_BY_ROOT,
        variables: { root },
        fetchPolicy: "network-only",
    });
    const row = data?.claim_drop_leaves_by_pk;
    if (!row) return null;
    const leaves = asLeaves(row.leaves);
    if (!leaves) return null;
    return { leaves, total: row.total, source: "hasura" };
}

/**
 * Read back whatever is stored for `root`, skipping the on-chain URI entirely.
 *
 * The publisher uses this to confirm what it is about to commit to. The leaves
 * table is insert-only for `anon` and keyed by root, so a row that already
 * exists is never overwritten — normally that's exactly right (a root IS its
 * leaves, so a repeat publish is a no-op), but nothing at the database level
 * proves the stored leaves actually hash to the key they're filed under.
 */
export const fetchStoredLeaves = (root: string): Promise<LeavesFetch | null> => fromHasura(root);

/**
 * Try the canonical document first, then Hasura. Both failing is reported with
 * both reasons — a claim page that can't say WHY it has no leaves is useless to
 * whoever has to fix the drop.
 */
export async function fetchLeaves(leavesUri: string, root: string): Promise<LeavesFetch> {
    let uriError: string;
    try {
        const viaUri = await fromUri(leavesUri);
        if (viaUri) return viaUri;
        uriError = leavesUri ? `unsupported leaves_uri (${leavesUri})` : "campaign has no leaves_uri";
    } catch (e) {
        uriError = (e as Error).message;
    }

    try {
        const viaHasura = await fromHasura(root);
        if (viaHasura) return viaHasura;
        throw new Error("no stored leaves for this root");
    } catch (e) {
        throw new Error(
            `could not load this drop's leaves. Published document: ${uriError}. ` +
                `Backup copy: ${(e as Error).message}.`,
            { cause: e },
        );
    }
}
