// The airdrop history (/airdrop-history) is written by the trippinj backend
// (POST /airdrops/log), which reads the sender, token, recipients and amounts
// from the transactions themselves: anon can't insert history, token or wallet
// rows through Hasura. Only the tx hashes and the free-text criteria /
// description go up. Mainnet only, like the history itself.
const AIRDROP_LOG_URL =
    (import.meta.env?.VITE_AIRDROP_LOG_URL as string | undefined) ||
    "https://api.trippyinj.xyz/airdrops/log";

/** The backend's per-request cap on tx hashes. */
export const MAX_HASHES_PER_RECORD = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Batches of at most MAX_HASHES_PER_RECORD. Every batch after the first
 * repeats one hash of the batch before it: the backend skips hashes it already
 * has and adds the rest to the row that holds the repeated one, so a long run
 * still lands as ONE history row.
 */
export function recordBatches(txHashes: string[]): string[][] {
    const batches: string[][] = [];
    let i = 0;
    while (i < txHashes.length) {
        const carry = batches.length > 0 ? [txHashes[i - 1]] : [];
        const take = MAX_HASHES_PER_RECORD - carry.length;
        batches.push([...carry, ...txHashes.slice(i, i + take)]);
        i += take;
    }
    return batches;
}

/**
 * Record a finished (or partial) airdrop run in the site's history.
 *
 * Best-effort: the transfers have already landed, so a failure is a missing
 * history row, never a failed drop. A 404 (the LCD has not indexed the newest
 * tx yet) or 502 (LCD hiccup) is retried; anything else is final.
 */
export async function recordAirdropLog(
    txHashes: string[],
    fields: { criteria?: string; description?: string; fee?: number },
): Promise<boolean> {
    for (const batch of recordBatches(txHashes)) {
        let ok = false;
        for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
            try {
                const response = await fetch(AIRDROP_LOG_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tx_hashes: batch, ...fields }),
                });
                if (response.ok) {
                    ok = true;
                    break;
                }
                const text = await response.text().catch(() => "");
                console.error("Failed to record airdrop log:", response.status, text);
                if (response.status !== 404 && response.status !== 502) return false;
            } catch (error) {
                console.error("Failed to record airdrop log:", error);
            }
            if (attempt < 3) await sleep(3000 * attempt);
        }
        if (!ok) return false;
    }
    return true;
}
