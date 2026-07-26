// Reading the campaign id the contract assigned to a freshly created drop out of
// the tx response. The id IS the /claim/<id> link, so it's worth getting right;
// dependency-free so it can be exercised without a chain or a bundler. The
// chain-query fallback lives with the modal that needs it.

interface EventAttribute {
    key?: string;
    value?: string;
}

interface TxEvent {
    type?: string;
    attributes?: EventAttribute[];
}

const attrValue = (event: TxEvent, key: string) =>
    event.attributes?.find((a) => a.key === key)?.value;

/**
 * Pull the new campaign's id out of the create tx.
 *
 * The contract also returns it as the message's `set_data`, but decoding a
 * `TxMsgData` protobuf in the browser is a lot of machinery for a number that's
 * emitted twice as an event attribute: on the custom `wasm-update_root` event,
 * and as `id` following `action=create_campaign` on the `wasm` event.
 */
export function parseCampaignId(result: unknown): number | null {
    const res = result as { events?: unknown; rawLog?: string } | null | undefined;
    let events = res?.events;
    if (!Array.isArray(events) && res?.rawLog) {
        try {
            events = (JSON.parse(res.rawLog) as { events?: unknown }[])[0]?.events;
        } catch {
            events = undefined;
        }
    }
    if (!Array.isArray(events)) return null;

    const typed = events as TxEvent[];

    // `Event::new("update_root")` surfaces as `wasm-update_root` and only fires on
    // a publish, so its id is unambiguous.
    for (const event of typed) {
        if (event.type !== "wasm-update_root") continue;
        const id = Number(attrValue(event, "id"));
        if (Number.isInteger(id) && id > 0) return id;
    }

    // Otherwise walk the `wasm` attributes in order: the `id` that follows
    // `action=create_campaign` belongs to that call.
    for (const event of typed) {
        if (event.type !== "wasm") continue;
        let sawCreate = false;
        for (const a of event.attributes ?? []) {
            if (a.key === "action") sawCreate = a.value === "create_campaign";
            else if (sawCreate && a.key === "id") {
                const id = Number(a.value);
                if (Number.isInteger(id) && id > 0) return id;
            }
        }
    }
    return null;
}
