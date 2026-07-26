// Finding the block a governance proposal's voting period closed on.
//
// Voter snapshots have to be taken at a specific height — `fetchProposalVoters`
// reads balances as of one — and the height nobody can argue with is the last
// block before voting ended. The chain indexes proposals by time, not height,
// so this estimates a height from the average block interval and then binary
// searches to the boundary.
//
// Shared by the push Airdrop tool and the Claim Drop tool, which both offer a
// "voters on proposal N" recipient source.

const BLOCKS_URL = "https://sentry.lcd.injective.network/cosmos/base/tendermint/v1beta1/blocks";

/** Average Injective block time, milliseconds — only used to seed the search. */
const BLOCK_MS = 690;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BlockResponse {
    block: { header: { height: string; time: string } };
}

/**
 * Fetch one block by height (or "latest"), retrying — the public LCD rate-limits
 * under the binary search's burst of requests, and giving up mid-search would
 * strand the snapshot at a wrong height rather than a slow one.
 */
export async function fetchBlock(height: number | "latest"): Promise<BlockResponse> {
    const maxAttempts = 50;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(`${BLOCKS_URL}/${height}`);
            if (!response.ok) throw new Error(`Failed to fetch block at height ${height}`);
            return (await response.json()) as BlockResponse;
        } catch (e) {
            lastError = e;
            await sleep(2000);
        }
    }
    throw new Error(`Failed to fetch block after ${maxAttempts} attempts`, { cause: lastError });
}

/** Height of the last block before `targetTime`. */
export async function findBlockBeforeTime(targetTime: Date): Promise<number> {
    const latest = await fetchBlock("latest");
    const latestHeight = parseInt(latest.block.header.height);
    const latestTime = new Date(latest.block.header.time);

    const drift = targetTime.getTime() - latestTime.getTime();
    let estimate = latestHeight + Math.floor(drift / BLOCK_MS);
    if (estimate < 1) estimate = 1;
    else if (estimate > latestHeight) estimate = latestHeight;

    let lastValid = estimate;
    let low = Math.max(1, estimate - Math.floor(Math.abs(drift) / 1000));
    let high = Math.min(latestHeight, estimate + Math.floor(Math.abs(drift) / 1000));

    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2);
        const midBlock = await fetchBlock(mid);
        const midTime = new Date(midBlock.block.header.time);
        if (midTime < targetTime) {
            lastValid = parseInt(midBlock.block.header.height);
            low = mid + 1;
        } else {
            high = mid - 1;
        }
        // Close enough: the remaining window is a couple of minutes of blocks,
        // and every extra probe is another rate-limited LCD round trip.
        if (high - low < 100 && midTime < targetTime) break;
    }
    return lastValid;
}
