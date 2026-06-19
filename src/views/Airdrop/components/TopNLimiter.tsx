import { useEffect, useState } from "react";

// "Limit to top N wallets by holdings" control. Was duplicated 4× inline; now
// self-contained — owns its toggle + value and reports apply/reset upward.
const TopNLimiter = ({
    onApply,
    onReset,
}: {
    onApply: (n: number) => void;
    onReset: () => void;
}) => {
    const [enabled, setEnabled] = useState(false);
    const [value, setValue] = useState<string>("");

    useEffect(() => {
        if (!enabled) {
            setValue("");
            onReset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return (
        <div className="mt-2">
            <label className="text-white inline-flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => setEnabled((e) => !e)}
                />
                Limit to top # wallets by holdings
            </label>
            {enabled && (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        className="bg-white text-black rounded-sm p-1 text-sm w-24"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="e.g. 100"
                    />
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

export default TopNLimiter;
