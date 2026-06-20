// CSV import/export for the Airdrop tool.

import Papa from "papaparse";
import type { AirdropRecipient } from "./types";
export { downloadCsv } from "../../utils/csv";

// bech32 charset excludes 1, b, i and o. Injective account addresses are 42
// chars (`inj1` + 38); 32-byte contract addresses are 62. Accept the range so
// pasted contract lists still validate, but reject typos / truncation / junk.
const INJ_ADDRESS_RE = /^inj1[02-9ac-hj-np-z]{38,58}$/;

export function isValidInjAddress(address: string): boolean {
    return INJ_ADDRESS_RE.test((address || "").trim());
}

export interface ParsedCsv {
    recipients: AirdropRecipient[];
    invalidRows: { row: number; address: string; amount: string; reason: string }[];
}

/**
 * Parse a user-uploaded `address,amount` CSV into recipients, validating each
 * address and amount. Invalid rows are reported (not silently dropped) so the
 * UI can warn before a bad address strands a whole multisend chunk.
 */
export function parseAirdropCsv(file: File): Promise<ParsedCsv> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                const recipients: AirdropRecipient[] = [];
                const invalidRows: ParsedCsv["invalidRows"] = [];
                const rows = results.data as Record<string, string>[];

                rows.forEach((raw, i) => {
                    const address = (raw.address || "").trim();
                    const amountStr = (raw.amount || "").trim();
                    if (!address && !amountStr) return;

                    const amount = Number(amountStr);
                    if (!isValidInjAddress(address)) {
                        invalidRows.push({ row: i + 2, address, amount: amountStr, reason: "invalid address" });
                        return;
                    }
                    if (!amountStr || !Number.isFinite(amount) || amount <= 0) {
                        invalidRows.push({ row: i + 2, address, amount: amountStr, reason: "invalid amount" });
                        return;
                    }
                    recipients.push({
                        address,
                        amountToAirdrop: amount,
                        percentToAirdrop: 0,
                        includeInDrop: true,
                    });
                });

                const total = recipients.reduce((sum, r) => sum + r.amountToAirdrop, 0);
                recipients.forEach((r) => {
                    r.percentToAirdrop = total ? (r.amountToAirdrop / total) * 100 : 0;
                });

                resolve({ recipients, invalidRows });
            },
            error: (err: Error) => reject(err),
        });
    });
}

/** Serialise the computed allocation to an `address,amount` CSV string. */
export function recipientsToCsv(recipients: AirdropRecipient[], decimals: number): string {
    const rows = recipients
        .filter((r) => r.includeInDrop && Number(Number(r.amountToAirdrop).toFixed(decimals)) > 0)
        .map((r) => ({ address: r.address, amount: Number(r.amountToAirdrop).toFixed(decimals) }));
    return Papa.unparse(rows, { columns: ["address", "amount"] });
}

