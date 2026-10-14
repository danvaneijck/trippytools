// Telegram alerts go through the trippinj backend (POST /alerts/trippytools),
// which holds the bot token. Never put a bot token in a VITE_* var: it ships in
// the public bundle. The backend builds the message from a fixed per-event
// template and only sends it for a successful, recent mainnet tx signed by
// `wallet`, one alert per tx hash.
const ALERTS_URL =
    (import.meta.env.VITE_ALERTS_URL as string | undefined) ||
    "https://api.trippyinj.xyz/alerts/trippytools";

export type TrippyAlertEvent =
    | "token_launch"
    | "airdrop"
    | "nft_airdrop"
    | "reflection_token"
    | "claim_drop";

export const sendTrippyAlert = async (
    event: TrippyAlertEvent,
    txHash: string | null | undefined,
    wallet: string | null | undefined,
    fields: Record<string, string | number | null | undefined>,
) => {
    if (!txHash || !wallet) return;
    try {
        const response = await fetch(ALERTS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, tx_hash: txHash, wallet, fields }),
        });
        if (!response.ok) {
            console.error("Failed to send alert:", response.status, await response.text());
        }
    } catch (error) {
        console.error("Failed to send alert:", error);
    }
};
