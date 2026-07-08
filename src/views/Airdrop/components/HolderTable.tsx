import { useMemo, useState } from "react";
import { WALLET_LABELS } from "../../../constants/walletLabels";
import type { AirdropRecipient } from "../types";
import { shortAddress } from "../format";
import { btnGhost, inputBase } from "./ui";

type WalletLabel = { label: string; bgColor: string; textColor: string };
const LABELS = WALLET_LABELS as Record<string, WalletLabel | undefined>;

type SortKey = "default" | "balance" | "amount";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export interface HolderTableColumns {
    include?: boolean;
    position?: boolean;
    balance?: boolean;
    vote?: boolean;
}

// Single shared recipient table. Replaces the four near-identical inline tables
// (NFT / TOKEN / GOV / MITO) and adds search, column sorting, select-all/none
// and pagination so large holder lists are actually navigable.
const HolderTable = ({
    recipients,
    onToggleInclude,
    onSetIncludeAll,
    tokenSymbol,
    tokenDecimals,
    sourceSymbol,
    sourceDecimals = 2,
    columns = { include: true, position: true, balance: true },
    network,
}: {
    recipients: AirdropRecipient[];
    onToggleInclude: (address: string) => void;
    onSetIncludeAll?: (include: boolean) => void;
    tokenSymbol: string;
    tokenDecimals: number;
    sourceSymbol?: string;
    sourceDecimals?: number;
    columns?: HolderTableColumns;
    network: string;
}) => {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("default");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [page, setPage] = useState(0);

    const explorerBase = `https://${network === "testnet" ? "testnet." : ""}explorer.injective.network`;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const rows = recipients
            .map((r, originalIndex) => ({ r, originalIndex }))
            .filter(({ r }) => !q || r.address.toLowerCase().includes(q));

        if (sortKey !== "default") {
            rows.sort((a, b) => {
                const av = sortKey === "balance" ? Number(a.r.balance) || 0 : Number(a.r.amountToAirdrop) || 0;
                const bv = sortKey === "balance" ? Number(b.r.balance) || 0 : Number(b.r.amountToAirdrop) || 0;
                return sortDir === "desc" ? bv - av : av - bv;
            });
        }
        return rows;
    }, [recipients, search, sortKey, sortDir]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
        setPage(0);
    };

    const sortMark = (key: SortKey) => (sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : "");

    return (
        <div className="mt-3">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                    }}
                    placeholder="Search address…"
                    className={`${inputBase} flex-1`}
                />
                {columns.include && onSetIncludeAll && (
                    <div className="flex gap-2">
                        <button className={btnGhost} onClick={() => onSetIncludeAll(true)}>
                            Select all
                        </button>
                        <button className={btnGhost} onClick={() => onSetIncludeAll(false)}>
                            Select none
                        </button>
                    </div>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full table-auto text-xs">
                    <thead className="sticky top-0 bg-[#04141b] text-left text-slate-400">
                        <tr>
                            {columns.position && <th className="px-3 py-2">#</th>}
                            {columns.include && <th className="px-3 py-2">Include</th>}
                            <th className="px-3 py-2">Address</th>
                            {columns.vote && <th className="px-3 py-2">Vote</th>}
                            {columns.balance && (
                                <th
                                    className="px-3 py-2 cursor-pointer select-none"
                                    onClick={() => toggleSort("balance")}
                                >
                                    Balance{sortMark("balance")}
                                </th>
                            )}
                            <th
                                className="px-3 py-2 cursor-pointer select-none"
                                onClick={() => toggleSort("amount")}
                            >
                                Airdrop{sortMark("amount")}
                            </th>
                            <th className="px-3 py-2">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.map(({ r, originalIndex }) => {
                            const label = LABELS[r.address];
                            return (
                                <tr
                                    key={r.address}
                                    className="border-b border-white/5 text-white transition hover:bg-white/5"
                                >
                                    {columns.position && (
                                        <td className="px-3 py-1.5 text-slate-500">{originalIndex + 1}</td>
                                    )}
                                    {columns.include && (
                                        <td className="px-3 py-1.5">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-trippyYellow"
                                                checked={r.includeInDrop || false}
                                                onChange={() => onToggleInclude(r.address)}
                                            />
                                        </td>
                                    )}
                                    <td className="whitespace-nowrap px-3 py-1.5">
                                        <a className="transition hover:text-trippyYellow" href={`${explorerBase}/account/${r.address}`} target="_blank" rel="noreferrer">
                                            {shortAddress(r.address)}
                                            {label && (
                                                <span className={`${label.bgColor} ${label.textColor} ml-2`}>
                                                    {label.label}
                                                </span>
                                            )}
                                        </a>
                                    </td>
                                    {columns.vote && (
                                        <td className="px-3 py-1.5">
                                            {r.vote_option ? r.vote_option.replace("VOTE_OPTION_", "") : ""}
                                        </td>
                                    )}
                                    {columns.balance && (
                                        <td className="whitespace-nowrap px-3 py-1.5 text-slate-300">
                                            {Number(r.balance ?? 0).toFixed(sourceDecimals)}
                                            {sourceSymbol ? ` ${sourceSymbol}` : ""}
                                        </td>
                                    )}
                                    <td className="whitespace-nowrap px-3 py-1.5 font-medium text-trippyYellow">
                                        {Number(r.amountToAirdrop).toFixed(tokenDecimals)} {tokenSymbol}
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-400">{Number(r.percentToAirdrop).toFixed(2)}%</td>
                                </tr>
                            );
                        })}
                        {pageRows.length === 0 && (
                            <tr>
                                <td className="px-3 py-3 text-slate-400" colSpan={7}>
                                    No matching addresses.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pageCount > 1 && (
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>
                        Showing {safePage * PAGE_SIZE + 1}–
                        {Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            className={btnGhost}
                            disabled={safePage === 0}
                            onClick={() => setPage(safePage - 1)}
                        >
                            Prev
                        </button>
                        <span className="px-1 text-slate-300">
                            {safePage + 1} / {pageCount}
                        </span>
                        <button
                            className={btnGhost}
                            disabled={safePage >= pageCount - 1}
                            onClick={() => setPage(safePage + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HolderTable;
