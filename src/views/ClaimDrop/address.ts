// Bech32 checksum validation for claim-drop recipients.
//
// Why this exists here and not in the shared airdrop validator: an airdrop is a
// bank send, and the chain rejects a MsgSend to an address whose bech32 checksum
// doesn't verify — a typo fails loudly, before any money moves. A claim drop
// never puts the address in front of a chain rule at all: it goes straight into
// a leaf hash. A one-shot campaign freezes on its first publish, so an
// allocation to a well-formed-but-mistyped address is funded, immutable, and
// claimable by nobody — permanently stranded inside the contract (and not even
// clawback-able on a perpetual drop).
//
// So the charset/length regex isn't enough here. This is the reference BIP-173
// checksum, implemented inline rather than pulled from a dependency: `bech32` is
// only present transitively via the Injective SDK, and this module has to stay
// loadable from the plain-node test runner.

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

/** Injective account addresses are `inj1` + 38; 32-byte contract addresses + 58. */
const INJ_SHAPE_RE = /^inj1[02-9ac-hj-np-z]{38,58}$/;

function polymod(values: number[]): number {
    let chk = 1;
    for (const value of values) {
        const top = chk >>> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ value;
        for (let i = 0; i < 5; i++) {
            if ((top >>> i) & 1) chk ^= GENERATOR[i];
        }
    }
    return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
    const high: number[] = [];
    const low: number[] = [];
    for (let i = 0; i < hrp.length; i++) {
        const c = hrp.charCodeAt(i);
        high.push(c >>> 5);
        low.push(c & 31);
    }
    return [...high, 0, ...low];
}

/**
 * Full bech32 validation of an Injective address: correct `inj` prefix, legal
 * charset and length, and — the part the regex can't do — a checksum that
 * actually verifies, so a single mistyped character is rejected rather than
 * silently allocated to nobody.
 */
export function isValidInjBech32(address: string): boolean {
    const addr = (address || "").trim();
    if (!INJ_SHAPE_RE.test(addr)) return false;

    // Everything after the last separator is data; the `inj1` prefix means the
    // separator we split on is the first `1`, and the shape check above already
    // guarantees the data part carries no further separators.
    const data: number[] = [];
    for (const ch of addr.slice(4)) {
        const idx = CHARSET.indexOf(ch);
        if (idx === -1) return false;
        data.push(idx);
    }
    // Last 6 data characters are the checksum; bech32 (not bech32m) constant.
    return polymod([...hrpExpand("inj"), ...data]) === 1;
}
