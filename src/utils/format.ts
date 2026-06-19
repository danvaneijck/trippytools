// Shared formatting helpers used across the app. Previously `humanReadableAmount`
// was hand-redefined in several components/views; this is the single source.

/** Compact number formatting: 1234 -> "1k", 1500000 -> "1.50m". */
export function humanReadableAmount(value: number | string | null | undefined): string {
    let num = Number(value);
    if (!num || !Number.isFinite(num)) return "0";
    const units = ["", "k", "m", "b", "t"];
    let i = 0;
    while (num >= 1000 && i < units.length - 1) {
        num /= 1000;
        i++;
    }
    return `${num.toFixed(num >= 10 ? 0 : 2)}${units[i]}`;
}

/** Truncate an address for display: inj1abc...xyz12. */
export function shortAddress(address: string | null | undefined): string {
    if (!address) return "";
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
}
