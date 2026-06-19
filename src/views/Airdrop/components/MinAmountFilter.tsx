import { useState } from "react";

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
        <div className="mt-2">
            <label className="text-white inline-flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
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
                        className="bg-white text-black rounded-sm p-1 text-sm w-28"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="min"
                    />
                    <span className="text-sm text-slate-300">{symbol}</span>
                    <button
                        className="bg-slate-700 hover:bg-slate-600 p-1 px-3 rounded-sm text-sm"
                        onClick={() => onApply(Number(value) || 0)}
                    >
                        Apply
                    </button>
                    <button
                        className="bg-slate-700 hover:bg-slate-600 p-1 px-3 rounded-sm text-sm"
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
