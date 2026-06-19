import type { DistMode } from "../types";

// Segmented fair/proportionate selector. Replaces the pair of look-alike
// checkboxes (that actually behaved as radios) duplicated across every mode.
const OPTIONS: { value: DistMode; label: string; hint: string }[] = [
    { value: "fair", label: "Fair", hint: "Equal split to every wallet" },
    { value: "proportionate", label: "Proportionate", hint: "Weighted by holdings" },
];

const DistributionToggle = ({
    value,
    onChange,
}: {
    value: DistMode;
    onChange: (mode: DistMode) => void;
}) => {
    return (
        <div>
            <label className="block font-bold text-white mb-1">Distribution</label>
            <div className="grid grid-cols-2 gap-2">
                {OPTIONS.map((opt) => {
                    const active = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`rounded-md p-2 text-sm text-left border transition ${
                                active
                                    ? "bg-slate-600 border-slate-400 text-white"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                            }`}
                        >
                            <div className="font-bold">{opt.label}</div>
                            <div className="text-[11px] opacity-80">{opt.hint}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default DistributionToggle;
