/* eslint-disable no-constant-binary-expression, @typescript-eslint/no-unused-expressions */
// Vendored / minified scoring logic from dojo.trading — the single-letter vars
// and ternary-as-statement / defensive-null-on-fresh-object patterns are
// minifier artifacts, not bugs. Disabled the rules its compiled style trips
// rather than rewrite obfuscated third-party code.

function accruedPoints(e: any) {
    const { rank: n, startTime: o, endTime: i } = e;
    const a = (new Date).getTime()
        , s = i - o;
    let c = 1;
    s >= 63072e6 ? c = 2.8 : s >= 31536e6 ? c = 2.4 : s >= 15552e6 ? c = 2 : s >= 10368e6 ? c = 1.8 : s >= 5184e6 ? c = 1.6 : s >= 2592e6 ? c = 1.4 : s >= 12096e5 && (c = 1.2);
    let u = a - o;
    a < o ? u = 0 : a > i && (u = i - o);
    const d = (18e3 - n) / 3
        , l = 5e-10;
    return d * c * (u * l);

}

function getData(r: any, o: any) {

    let i;
    const e = r.data
        , { metadata: t, burntTokenIds: n, rankMapping: a, stakings: s } = null === o || void 0 === o || null === (i = o.data) || void 0 === i ? void 0 : o.data
        , c = [...e, ...t].map((e => ({
            index: e.tokenId,
            metadata: e,
            isBurnt: n.includes(e.tokenId),
            rank: a[e.tokenId] ? a[e.tokenId] : null,
            staking: s.filter(((t: any) => t.tokenId === e.tokenId)),
            totalOma: s.filter(((t: any) => t.tokenId === e.tokenId)).reduce(((t: any, r: any) => {
                let n, o;
                return (null === (n = {
                    id: r.id,
                    tokenId: r.tokenId,
                    rank: null !== (o = a[e.tokenId]) && void 0 !== o ? o : 15e3,
                    startTime: r.startTime,
                    endTime: r.endTime
                }) || void 0 === n ? void 0 : accruedPoints(n)) + t
            }
            ), 0)
        })));

    return c;
}

export async function getMetaData() {
    const response = await fetch("https://meta.dojo.trading/api/metadata/151725", {});
    return await response.json();
}

export async function getAllNfts() {
    const response = await fetch("https://sushi.dojo.trading/json/all-nfts.json", {});
    return await response.json();
}

export async function getSushiStats() {
    const response = await fetch("https://meta.dojo.trading/api/stats", {});
    return await response.json();
}


export function processSushiData(metadata: any, nfts: any) {

    const o = metadata;
    const r = nfts;
    let x = getData(r, o);
    x = x.filter((i) => {
        return i.rank !== null
    })
    const result = x.sort((a, b) => {
        return a.rank - b.rank
    })
    return result;

}

