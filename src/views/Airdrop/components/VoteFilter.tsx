import { useState } from "react";
import type { VoteFilters, VoteOption } from "../types";

const OPTIONS: { key: VoteOption; label: string }[] = [
    { key: "VOTE_OPTION_YES", label: "YES" },
    { key: "VOTE_OPTION_ABSTAIN", label: "ABSTAIN" },
    { key: "VOTE_OPTION_NO", label: "NO" },
    { key: "VOTE_OPTION_NO_WITH_VETO", label: "NO WITH VETO" },
];

const ALL_TRUE: VoteFilters = {
    VOTE_OPTION_YES: true,
    VOTE_OPTION_ABSTAIN: true,
    VOTE_OPTION_NO: true,
    VOTE_OPTION_NO_WITH_VETO: true,
};

// Governance-only: include voters by how they voted. Was inline in the GOV mode.
const VoteFilter = ({
    onApply,
    onReset,
}: {
    onApply: (filters: VoteFilters) => void;
    onReset: () => void;
}) => {
    const [enabled, setEnabled] = useState(false);
    const [filters, setFilters] = useState<VoteFilters>({ ...ALL_TRUE });

    return (
        <div className="mt-2">
            <label className="text-white inline-flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => {
                        const next = !enabled;
                        setEnabled(next);
                        if (!next) {
                            setFilters({ ...ALL_TRUE });
                            onReset();
                        }
                    }}
                />
                Filter by vote option
            </label>
            {enabled && (
                <div className="mt-2">
                    <div className="flex flex-wrap gap-3">
                        {OPTIONS.map(({ key, label }) => (
                            <label key={key} className="inline-flex items-center gap-1 text-sm font-bold text-white">
                                <input
                                    type="checkbox"
                                    checked={filters[key]}
                                    onChange={() =>
                                        setFilters((f) => ({ ...f, [key]: !f[key] }))
                                    }
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            className="bg-slate-700 hover:bg-slate-600 p-1 px-3 rounded-sm text-sm"
                            onClick={() => onApply(filters)}
                        >
                            Apply
                        </button>
                        <button
                            className="bg-slate-700 hover:bg-slate-600 p-1 px-3 rounded-sm text-sm"
                            onClick={() => {
                                setFilters({ ...ALL_TRUE });
                                onReset();
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoteFilter;
