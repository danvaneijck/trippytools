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
            <label className="mb-1 block text-sm font-bold text-white">Distribution</label>
            <div className="grid grid-cols-2 gap-2">
                {OPTIONS.map((opt) => {
                    const active = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`rounded-lg border p-2.5 text-left text-sm transition ${
                                active
                                    ? "border-trippyYellow/60 bg-trippyYellow/15 text-white"
                                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
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
