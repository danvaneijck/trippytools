// CSV import for the NFT airdrop tool — extracts recipient wallets from an
// arbitrary CSV by auto-detecting which column holds the Injective addresses.

import Papa from "papaparse";
import { isValidInjAddress } from "../Airdrop/csv";
export { isValidInjAddress } from "../Airdrop/csv";
export { downloadCsv } from "../../utils/csv";

export interface ParsedWalletCsv {
    wallets: string[];
    invalidRows: { row: number; address: string; reason: string }[];
    duplicates: number;
    /** Header name (or "column N") of the column the addresses were taken from. */
    detectedColumn: string | null;
}

// Header names that are likely to hold a recipient wallet, ranked so that when
// two columns tie on valid-address count we pick the most wallet-ish one.
const HEADER_PREFERENCE = ["recipient", "wallet", "address", "holder", "account", "owner", "addr", "to"];

function headerRank(header: string | null | undefined): number {
    if (!header) return 0;
    const h = header.trim().toLowerCase();
    const idx = HEADER_PREFERENCE.indexOf(h);
    return idx === -1 ? 0 : HEADER_PREFERENCE.length - idx;
}

const clean = (cell: string | undefined) => (cell || "").trim();

/**
 * Parse an uploaded CSV and pull out the recipient wallets. Works on a plain
 * one-address-per-line file *and* on a multi-column export (e.g. a holder
 * snapshot with rank/wallet/usd columns) by scoring every column on how many
 * valid Injective addresses it contains and taking the winner. Invalid and
 * duplicate addresses are reported (not silently dropped) so the UI can warn
 * before a bad address strands a transfer chunk.
 */
export function parseWalletCsv(file: File): Promise<ParsedWalletCsv> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results: any) => {
                const rows = (results.data as string[][]).filter((r) => Array.isArray(r));
                if (rows.length === 0) {
                    resolve({ wallets: [], invalidRows: [], duplicates: 0, detectedColumn: null });
                    return;
                }

                const numCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

                // Treat row 0 as a header only if it contains no addresses itself.
                const firstRowHasAddress = (rows[0] || []).some((c) => isValidInjAddress(clean(c)));
                const headerRow = firstRowHasAddress ? null : (rows[0] || []).map(clean);
                const dataStart = headerRow ? 1 : 0;

                // Score each column by how many data cells are valid addresses.
                let bestCol = -1;
                let bestCount = 0;
                let bestRank = -1;
                for (let col = 0; col < numCols; col++) {
                    let count = 0;
                    for (let i = dataStart; i < rows.length; i++) {
                        if (isValidInjAddress(clean(rows[i][col]))) count++;
                    }
                    const rank = headerRank(headerRow?.[col]);
                    if (count > bestCount || (count === bestCount && count > 0 && rank > bestRank)) {
                        bestCount = count;
                        bestCol = col;
                        bestRank = rank;
                    }
                }

                if (bestCol === -1 || bestCount === 0) {
                    resolve({ wallets: [], invalidRows: [], duplicates: 0, detectedColumn: null });
                    return;
                }

                const detectedColumn = headerRow?.[bestCol]?.length ? headerRow[bestCol] : `column ${bestCol + 1}`;

                const wallets: string[] = [];
                const invalidRows: ParsedWalletCsv["invalidRows"] = [];
                const seen = new Set<string>();
                let duplicates = 0;

                for (let i = dataStart; i < rows.length; i++) {
                    const address = clean(rows[i][bestCol]);
                    if (!address) continue;
                    if (!isValidInjAddress(address)) {
                        invalidRows.push({ row: i + 1, address, reason: "invalid address" });
                        continue;
                    }
                    if (seen.has(address)) {
                        duplicates += 1;
                        continue;
                    }
                    seen.add(address);
                    wallets.push(address);
                }

                resolve({ wallets, invalidRows, duplicates, detectedColumn });
            },
            error: (err: Error) => reject(err),
        });
    });
}
