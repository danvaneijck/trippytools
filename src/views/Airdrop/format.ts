// Shared formatting helpers for the Airdrop tool.

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

export function shortAddress(address: string): string {
    if (!address) return "";
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
}
