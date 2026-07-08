import { useState } from "react";
import type { VoteFilters, VoteOption } from "../types";
import { btnGhost } from "./ui";

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
        <div className="mt-3">
            <label className="inline-flex items-center gap-2 text-sm text-white">
                <input
                    type="checkbox"
                    className="h-4 w-4 accent-trippyYellow"
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
                            <label key={key} className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-trippyYellow"
                                    checked={filters[key]}
                                    onChange={() =>
                                        setFilters((f) => ({ ...f, [key]: !f[key] }))
                                    }
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button className={btnGhost} onClick={() => onApply(filters)}>
                            Apply
                        </button>
                        <button
                            className={btnGhost}
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
