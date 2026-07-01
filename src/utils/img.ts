// Centralised image-URL resolution for token logos.
//
// Logos on Injective come from a mix of sources — Choice's token registry, raw
// on-chain IPFS metadata, arbitrary https links — and many fail to load when hit
// directly (dead/slow IPFS gateways, hot-link blocks, no CDN). We route every
// logo through the wsrv.nl image proxy (same one the SHROOM hub uses), which
// caches, resizes and tolerates flaky upstreams, after first normalising any
// IPFS reference to a gateway URL.

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

// Turn an `ipfs://…` ref or a bare CID into an https gateway URL. http(s) and
// anything else passes through untouched.
const toHttp = (src: string): string => {
    if (src.startsWith('ipfs://')) return IPFS_GATEWAY + src.slice('ipfs://'.length);
    if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]+)$/i.test(src)) return IPFS_GATEWAY + src;
    return src;
};

// Resolve a raw logo reference into a proxied, resized URL safe to drop into an
// <img src>. Returns '' for empty input so callers can fall back to a placeholder.
export const resolveImageUrl = (src?: string | null, size = 96): string => {
    if (!src) return '';
    const s = src.trim();
    if (!s) return '';
    // Inline data URIs and already-proxied URLs don't need (re)wrapping.
    if (s.startsWith('data:') || s.includes('wsrv.nl')) return s;
    const dim = Math.max(Math.round(size), 32);
    return `https://wsrv.nl/?url=${encodeURIComponent(toHttp(s))}&n=-1&w=${dim}&h=${dim}`;
};

// The un-proxied, gateway-normalised URL. Used as an intermediate fallback when
// the wsrv.nl proxy refuses a source outright — e.g. it 400s "Domain or TLD
// blocked by policy" for hosts like postimg.cc, even though the image loads fine
// directly. Returns '' for empty input.
export const directImageUrl = (src?: string | null): string => {
    if (!src) return '';
    const s = src.trim();
    return s ? toHttp(s) : '';
};
