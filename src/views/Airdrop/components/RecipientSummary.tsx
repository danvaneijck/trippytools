import type { AirdropSummary } from "../distribution";
import { humanReadableAmount } from "../format";

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm font-bold text-white">{value}</div>
    </div>
);

// Up-front pre-flight numbers so the user sees exactly what's about to happen
// before signing: how much leaves the wallet, how many wallets receive it, how
// many transactions it takes, and the rounding buffer held back (previously a
// silent 0.001% haircut).
const RecipientSummary = ({
    summary,
    symbol,
    showTxCount = true,
}: {
    summary: AirdropSummary;
    symbol: string;
    showTxCount?: boolean;
}) => {
    return (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Recipients" value={summary.recipientCount.toLocaleString()} />
            <Stat
                label="Total out"
                value={`${humanReadableAmount(summary.totalOut)} ${symbol}`}
            />
            {showTxCount && <Stat label="Transactions" value={`${summary.txCount}`} />}
            <Stat
                label="Rounding buffer"
                value={`${humanReadableAmount(summary.reserved)} ${symbol}`}
            />
        </div>
    );
};

export default RecipientSummary;
