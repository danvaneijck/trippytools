import {
    allocate,
    applyMinAmount,
    applyTopN,
    applyVoteFilter,
    setIncludeAll,
    summarize,
    toggleInclude,
} from "../distribution";
import { recipientsToCsv, downloadCsv } from "../csv";
import type { AirdropRecipient, DistMode, VoteFilters } from "../types";
import HolderTable, { HolderTableColumns } from "./HolderTable";
import RecipientSummary from "./RecipientSummary";
import TopNLimiter from "./TopNLimiter";
import MinAmountFilter from "./MinAmountFilter";
import VoteFilter from "./VoteFilter";

// Shared "you have a list — now refine and review it" section rendered by every
// drop mode. Owns the wiring from UI controls to the pure distribution helpers.
const AirdropListSection = ({
    recipients,
    setRecipients,
    distMode,
    total,
    tokenSymbol,
    tokenDecimals,
    sourceSymbol,
    sourceDecimals,
    filter = "topN",
    columns = { include: true, position: true, balance: true },
    network,
    csvFilename,
    fixedAmounts = false,
}: {
    recipients: AirdropRecipient[];
    setRecipients: (r: AirdropRecipient[]) => void;
    distMode: DistMode;
    total: number;
    tokenSymbol: string;
    tokenDecimals: number;
    sourceSymbol?: string;
    sourceDecimals?: number;
    filter?: "topN" | "vote" | "none";
    columns?: HolderTableColumns;
    network: string;
    csvFilename: string;
    // CSV mode: per-row amounts come from the uploaded file, so toggling a row
    // must only flip inclusion — never re-run the fair/proportionate allocator.
    fixedAmounts?: boolean;
}) => {
    const summary = summarize(recipients, total, tokenDecimals);

    const onToggleInclude = (address: string) =>
        fixedAmounts
            ? setRecipients(
                  recipients.map((r) =>
                      r.address === address ? { ...r, includeInDrop: !r.includeInDrop } : r,
                  ),
              )
            : setRecipients(toggleInclude(recipients, address, distMode, total));

    const onSetIncludeAll = (include: boolean) =>
        fixedAmounts
            ? setRecipients(recipients.map((r) => ({ ...r, includeInDrop: include })))
            : setRecipients(setIncludeAll(recipients, include, distMode, total));

    const exportCsv = () => {
        const csv = recipientsToCsv(recipients, tokenDecimals);
        downloadCsv(csvFilename, csv);
    };

    return (
        <div className="mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-slate-300">
                    Total participants:{" "}
                    <span className="text-white font-bold">{summary.recipientCount.toLocaleString()}</span>
                </div>
                <button
                    onClick={exportCsv}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-sm text-sm self-start"
                >
                    Download CSV
                </button>
            </div>
            <div className="text-xs text-slate-400 mt-1">
                Exclude addresses you don't want to fund (burn wallets, pair/LP contracts, marketplaces…) by unchecking them or filtering.
            </div>

            <RecipientSummary summary={summary} symbol={tokenSymbol} />

            {!fixedAmounts && filter === "topN" && (
                <TopNLimiter
                    onApply={(n) => setRecipients(applyTopN(recipients, n, distMode, total))}
                    onReset={() => setRecipients(setIncludeAll(recipients, true, distMode, total))}
                />
            )}
            {!fixedAmounts && filter === "vote" && (
                <VoteFilter
                    onApply={(filters: VoteFilters) =>
                        setRecipients(applyVoteFilter(recipients, filters, distMode, total))
                    }
                    onReset={() => setRecipients(setIncludeAll(recipients, true, distMode, total))}
                />
            )}
            {!fixedAmounts && distMode === "proportionate" && (
                <MinAmountFilter
                    symbol={tokenSymbol}
                    onApply={(min) => setRecipients(applyMinAmount(recipients, min, distMode, total))}
                    onReset={() => setRecipients(allocate(recipients, distMode, total))}
                />
            )}

            <HolderTable
                recipients={recipients}
                onToggleInclude={onToggleInclude}
                onSetIncludeAll={onSetIncludeAll}
                tokenSymbol={tokenSymbol}
                tokenDecimals={tokenDecimals}
                sourceSymbol={sourceSymbol}
                sourceDecimals={sourceDecimals}
                columns={columns}
                network={network}
            />
        </div>
    );
};

export default AirdropListSection;
