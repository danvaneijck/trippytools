export function humanReadableAmount(number: number) {
    if (!number || isNaN(Number(number))) {
        return "0";
    }

    const units = ["", "k", "m", "b", "t"];
    let unitIndex = 0;

    while (number >= 1000 && unitIndex < units.length - 1) {
        number /= 1000;
        unitIndex++;
    }

    return `${Number(number).toFixed(2)}${units[unitIndex]}`;
}

export function formatNumber(x: number, extra = 2) {
    const num = x ?? 0;
    const suffixes = ["", "K", "M", "B", "T"];
    const isNeg = num < 0;
    let abs = Math.abs(num);

    /* tiny but non-zero → render 0.0ₙ… with “extra” significant digits */
    if (abs !== 0 && abs < 1e-2) {
        return smallNumberWithZeroCount({ value: num, digits: extra });
    }

    /* thousands-separator + K/M/B/T suffix */
    let i = 0;
    while (abs >= 1_000 && i < suffixes.length - 1) {
        abs /= 1_000;
        i++;
    }

    const formatted = abs.toLocaleString(undefined, {
        maximumFractionDigits: extra,
    });
    return (isNeg ? "-" : "") + formatted + suffixes[i];
}

/* -------- helper -------- */
function smallNumberWithZeroCount({
    value,
    digits = 2,
}: {
    value: number;
    digits?: number;
}) {
    // bail out if not actually a “tiny” number any more
    if (value === 0 || Math.abs(value) >= 1e-2) {
        return <span>{value.toLocaleString()}</span>;
    }

    // fixed-point with plenty of decimals, then trim trailing 0s / dot
    const fixed = value.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
    const [, frac = ""] = fixed.split(".");
    const zeroRun = frac.match(/^0*/)?.[0].length ?? 0;
    const sig = frac.slice(zeroRun);

    return (
        <span className="inline-flex items-baseline">
            0.0
            {zeroRun > 0 && (
                <sub className="text-xs" style={{ lineHeight: 1 }}>
                    {zeroRun}
                </sub>
            )}
            {sig.slice(0, digits)}
        </span>
    );
}
