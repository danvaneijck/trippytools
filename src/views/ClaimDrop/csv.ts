// CSV import for the Claim Drop tool: the same `address,amount` file the Airdrop
// tool takes, so a list exported from the Holder tool works in either.
//
// Unlike the airdrop parser this keeps `amount` as the STRING the user wrote.
// Amounts end up inside a merkle leaf hash, so they're converted to base units
// with exact integer math (see `leaves.ts`) instead of going through a float.

import Papa from "papaparse";
import { isValidInjBech32 } from "./address";
import { isValidAmount, type CsvRow } from "./leaves";

export interface ParsedClaimCsv {
    rows: CsvRow[];
    invalidRows: { row: number; address: string; amount: string; reason: string }[];
}

/**
 * Parse an uploaded `address,amount` CSV. Invalid rows are reported rather than
 * dropped: a truncated address in a claim drop isn't a failed send, it's funds
 * locked in the contract behind a proof nobody holds. Addresses are checked
 * against the full bech32 checksum (not just the charset) for the same reason —
 * see `address.ts`.
 */
export function parseClaimDropCsv(file: File): Promise<ParsedClaimCsv> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            // papaparse ships no type declarations in this repo, so the result is
            // narrowed by hand (same as the Airdrop parser).
            complete: (results: any) => {
                const rows: CsvRow[] = [];
                const invalidRows: ParsedClaimCsv["invalidRows"] = [];
                const parsed = results.data as Record<string, string>[];

                parsed.forEach((raw, i) => {
                    const address = (raw.address || "").trim();
                    const amount = (raw.amount || "").trim();
                    if (!address && !amount) return;

                    if (!isValidInjBech32(address)) {
                        invalidRows.push({
                            row: i + 2,
                            address,
                            amount,
                            reason: "invalid address (bech32 checksum)",
                        });
                        return;
                    }
                    if (!isValidAmount(amount) || Number(amount) <= 0) {
                        invalidRows.push({ row: i + 2, address, amount, reason: "invalid amount" });
                        return;
                    }
                    rows.push({ address, amount });
                });

                resolve({ rows, invalidRows });
            },
            error: (err: Error) => reject(err),
        });
    });
}
