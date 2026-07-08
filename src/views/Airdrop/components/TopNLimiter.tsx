import { useEffect, useState } from "react";
import { btnGhost, inputBase } from "./ui";

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
        <div className="mt-3">
            <label className="inline-flex items-center gap-2 text-sm text-white">
                <input
                    type="checkbox"
                    className="h-4 w-4 accent-trippyYellow"
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
                        className={`${inputBase} w-28`}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="e.g. 100"
                    />
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

export default TopNLimiter;
