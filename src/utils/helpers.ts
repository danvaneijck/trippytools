

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