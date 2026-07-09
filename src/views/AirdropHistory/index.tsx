import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PiParachuteBold } from "react-icons/pi";
import { FiPlus } from "react-icons/fi";
import ShroomBalance from "../../components/App/ShroomBalance";
import { gql, useQuery } from '@apollo/client';
import Footer from "../../components/App/Footer";
import useNetworkStore from "../../store/useNetworkStore";
import AirdropCard from "../../components/App/AIrdropCord";


// A partial airdrop that's later resumed/retried is written as a SECOND log row
// (the resume re-broadcasts nothing already paid but re-logs the FULL tx set —
// see AirdropConfirmModal), so the retry and the partial share on-chain tx
// hashes. Collapse any logs connected by a shared tx hash into one entry,
// keeping the most-complete run, so the same airdrop isn't shown — or counted —
// twice.
const parseHashes = (s?: string): string[] =>
    (s ?? "").split(",").map((h) => h.trim()).filter(Boolean)

const isPartialLog = (log: any): boolean => /\[partial:/i.test(log?.description ?? "")

const timeOf = (log: any): number => {
    const t = new Date(log?.time).getTime()
    return Number.isFinite(t) ? t : 0
}

// The representative of a group: the finished run. Prefer most recipients, then
// most txs, then the non-partial row, then the newest.
const preferred = (a: any, b: any): any => {
    const pa = Number(a.total_participants) || 0
    const pb = Number(b.total_participants) || 0
    if (pa !== pb) return pa > pb ? a : b
    const ha = parseHashes(a.tx_hashes).length
    const hb = parseHashes(b.tx_hashes).length
    if (ha !== hb) return ha > hb ? a : b
    const partA = isPartialLog(a)
    const partB = isPartialLog(b)
    if (partA !== partB) return partA ? b : a
    return timeOf(a) >= timeOf(b) ? a : b
}

const dedupeAirdropLogs = (logs: any[]): any[] => {
    // Union-find over logs linked by a shared tx hash.
    const parent = logs.map((_, i) => i)
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]]
            i = parent[i]
        }
        return i
    }
    const union = (i: number, j: number) => {
        parent[find(i)] = find(j)
    }

    const seen = new Map<string, number>() // tx hash -> first log index carrying it
    logs.forEach((log, i) => {
        for (const h of parseHashes(log.tx_hashes)) {
            const prev = seen.get(h)
            if (prev != null) union(prev, i)
            else seen.set(h, i)
        }
    })

    // Reduce each group to its best representative.
    const rep = new Map<number, any>()
    logs.forEach((log, i) => {
        const r = find(i)
        const cur = rep.get(r)
        rep.set(r, cur ? preferred(cur, log) : log)
    })

    // Emit one row per group, preserving the incoming (time desc) order — the
    // group surfaces at the position of its newest member.
    const emitted = new Set<number>()
    const out: any[] = []
    logs.forEach((_, i) => {
        const r = find(i)
        if (emitted.has(r)) return
        emitted.add(r)
        out.push(rep.get(r))
    })
    return out
}

const AIRDROP_HISTORY_QUERY = gql`
query getAirdropHistory {
  airdrop_tracker_airdroplog(order_by: {time: desc}) {
    id
    amount_dropped
    criteria
    description
    time
    fee
    tx_hashes
    token {
      address
      name
      symbol
    }
    total_participants
    wallet {
      address
    }
  }
}
`


const AirdropHistory = () => {
    const { networkKey: currentNetwork } = useNetworkStore()

    const { data, loading } = useQuery(AIRDROP_HISTORY_QUERY, {
        fetchPolicy: "network-only",
        pollInterval: 5000
    })

    const [airdropData, setAirdropData] = useState<any[]>([])

    useEffect(() => {
        if (!data) return
        setAirdropData(dedupeAirdropLogs(data.airdrop_tracker_airdroplog))
    }, [data])

    const totalWallets = airdropData.reduce(
        (sum, log) => sum + (Number(log.total_participants) || 0),
        0,
    )

    return (
        <div className="flex min-h-screen flex-col bg-customGray">
            <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-20 pb-16">
                {currentNetwork == "mainnet" && (
                    <div className="mb-6 flex justify-end">
                        <ShroomBalance />
                    </div>
                )}

                {/* page header */}
                <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-trippyYellow/90">
                            <PiParachuteBold className="text-xl" />
                            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                                On-chain record
                            </span>
                        </div>
                        <h1 className="mt-1 font-magic text-3xl font-bold text-white">
                            Airdrop History
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            {airdropData.length > 0 ? (
                                <>
                                    {airdropData.length.toLocaleString()} airdrops ·{" "}
                                    {totalWallets.toLocaleString()} wallets rewarded
                                </>
                            ) : (
                                "Every airdrop sent through Trippy Tools"
                            )}
                        </p>
                    </div>

                    <Link
                        to="/airdrop"
                        className="inline-flex items-center justify-center gap-2 rounded-lg
                            bg-trippyYellow px-5 py-2.5 text-sm font-bold text-black
                            shadow-lg shadow-trippyYellow/10 transition hover:brightness-110"
                    >
                        <FiPlus className="text-base" />
                        Do airdrop
                    </Link>
                </header>

                {/* content */}
                {loading && airdropData.length === 0 ? (
                    <div className="space-y-5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-52 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                            />
                        ))}
                    </div>
                ) : airdropData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/2 py-16 text-center">
                        <PiParachuteBold className="text-4xl text-slate-600" />
                        <p className="mt-3 text-sm font-medium text-slate-300">
                            No airdrops yet
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Be the first to reward your community.
                        </p>
                        <Link
                            to="/airdrop"
                            className="mt-4 rounded-lg bg-trippyYellow px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
                        >
                            Do airdrop
                        </Link>
                    </div>
                ) : (
                    airdropData.map((log, index) => (
                        <AirdropCard key={log.id ?? index} log={log} />
                    ))
                )}
            </div>

            <Footer />
        </div>
    );
}

export default AirdropHistory
