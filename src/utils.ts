export function humanReadableAmount(number: number) {
    if (!number) {
        return 0
    }
    const units = ["", "k", "m", "b", "t"];
    let unitIndex = 0;

    while (number >= 1000 && unitIndex < units.length - 1) {
        number /= 1000;
        unitIndex++;
    }

    return `${number.toFixed(number >= 10 ? 0 : 2)}${units[unitIndex]}`;
}