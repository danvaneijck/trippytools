/**
 * Records a published campaign in the trippinj campaign index, which backs the
 * "my drops" list. The backend builds the row from the contract's own state,
 * so only the campaign's coordinates are sent; it keeps `txHash` only if that
 * tx checks out on-chain. Idempotent: recording again re-syncs the row.
 */
import type { NetworkKey } from "../../store/useNetworkStore";
import { campaignsUrl } from "./config";

export async function recordCampaignInIndex(
    network: NetworkKey,
    contract: string,
    campaignId: number,
    txHash: string | null,
): Promise<void> {
    const res = await fetch(campaignsUrl(network), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, contract, campaign_id: campaignId, tx_hash: txHash }),
    });
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const body = (await res.json()) as { error?: string };
            if (body.error) detail = body.error;
        } catch {
            // not JSON; keep the status
        }
        throw new Error(detail);
    }
}
