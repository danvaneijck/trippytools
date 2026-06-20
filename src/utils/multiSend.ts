// Shared chunked native (bank) multi-send. Used by the presale airdrop and
// refund flows, which previously each carried their own near-identical copy of
// this loop — and critically, both dropped a failed chunk on the floor (single
// try/catch, no retry), so recipients could silently go unpaid while the call
// still "succeeded". This version retries each chunk and throws if a chunk can
// never land, so callers surface the failure.

import { MsgMultiSend } from "@injectivelabs/sdk-ts";
import { BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { performTransaction } from "./walletStrategy";

export interface MultiSendRecord {
    address: string;
    // raw chain (base-denom) amount, e.g. wei for inj
    amount: string | number;
}

export interface MultiSendOptions {
    chunkSize?: number;
    retries?: number;
    onProgress?: (completedTx: number, totalTx: number) => void;
    onPreview?: (msg: unknown) => void;
}

export async function sendNativeMultiSend(
    sender: string,
    denom: string,
    records: MultiSendRecord[],
    opts: MultiSendOptions = {},
): Promise<string[]> {
    const chunkSize = opts.chunkSize ?? 1200;
    const maxRetries = opts.retries ?? 3;

    const chunks: MultiSendRecord[][] = [];
    for (let i = 0; i < records.length; i += chunkSize) {
        chunks.push(records.slice(i, i + chunkSize));
    }

    const sent = new Set<string>();
    const txHashes: string[] = [];

    for (const chunk of chunks) {
        const pending = chunk.filter((r) => !sent.has(r.address));
        if (pending.length === 0) continue;

        let attempt = 0;
        let ok = false;
        while (attempt < maxRetries && !ok) {
            try {
                const total = pending.reduce(
                    (acc, r) => acc.plus(new BigNumberInBase(r.amount)),
                    new BigNumberInWei(0),
                );
                const msg = MsgMultiSend.fromJSON({
                    inputs: [{ address: sender, coins: [{ denom, amount: total.toFixed() }] }],
                    outputs: pending.map((r) => ({
                        address: r.address,
                        coins: [{ amount: new BigNumberInBase(r.amount).toFixed(), denom }],
                    })),
                });

                opts.onPreview?.(msg);

                const response = await performTransaction(sender, [msg]);
                pending.forEach((r) => sent.add(r.address));
                txHashes.push(response!.txHash);
                ok = true;
                opts.onProgress?.(txHashes.length, chunks.length);
            } catch (e: any) {
                attempt += 1;
                console.error("Multisend chunk failed, retrying...", e);
                if (attempt >= maxRetries) {
                    throw new Error(`Multisend failed after ${maxRetries} retries: ${e?.message ?? e}`, { cause: e });
                }
            }
        }
    }

    return txHashes;
}
