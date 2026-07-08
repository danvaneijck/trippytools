import { useState } from "react";
import { btnGhost, inputBase } from "./ui";

// Drop recipients whose computed allocation is below a floor (e.g. dust from a
// proportionate split to thousands of tiny holders) so gas isn't wasted on
// near-zero transfers. New capability — there was no minimum before.
const MinAmountFilter = ({
    symbol,
    onApply,
    onReset,
}: {
    symbol: string;
    onApply: (min: number) => void;
    onReset: () => void;
}) => {
    const [enabled, setEnabled] = useState(false);
    const [value, setValue] = useState<string>("");

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
                            setValue("");
                            onReset();
                        }
                    }}
                />
                Exclude wallets below a minimum amount
            </label>
            {enabled && (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        type="number"
                        min={0}
                        className={`${inputBase} w-28`}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="min"
                    />
                    <span className="text-sm text-slate-300">{symbol}</span>
                    <button className={btnGhost} onClick={() => onApply(Number(value) || 0)}>
                        Apply
                    </button>
                    <button
                        className={btnGhost}
                        onClick={() => {
                            setValue("");
                            onReset();
                        }}
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    );
};

export default MinAmountFilter;
