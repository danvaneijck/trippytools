// Generic CSV helpers, shared across features.

import Papa from "papaparse";

/** Serialise an array of objects to CSV, emitting only the given columns. */
export function arrayToCsv(rows: Record<string, any>[], columns: string[]): string {
    return Papa.unparse(rows, { columns });
}

/** Trigger a client-side download of the given text content. */
export function downloadCsv(filename: string, content: string): void {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
