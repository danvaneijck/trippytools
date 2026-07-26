/**
 * Execute-message builders for the `choice-claim-drops` contract, returning
 * `MsgExecuteContractCompat` ready for `performTransaction`. Message shapes match
 * `contracts/choice_claim_drops/src/msg.rs::ExecuteMsg` exactly.
 */
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts";
import { fundingRequired } from "./config";

export interface ClaimLeaf {
    id: number;
    amount: string;
    proof: string[];
}

/**
 * One-shot drop, published + funded + auto-frozen in a single tx.
 *
 * `leavesUri` is content-addressed by root, so it's known before broadcast (no
 * id chicken-and-egg). Attaches `total + ceil(fee)` of `denom`; pass the
 * instance's `fee_bps` (from the Config query — usually 0, since the tool
 * charges its SHROOM fee separately).
 */
export function createOneShotDrop(p: {
    sender: string;
    contract: string;
    denom: string;
    /** JSON string: { title, symbol, decimals, description?, logo? }. */
    meta: string;
    rootHex: string;
    total: string;
    leavesUri: string;
    feeBps: number;
    /** Nanosecond decimal string; omit for a perpetual drop. */
    expiryNanos?: string | null;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: {
            create_campaign: {
                denom: p.denom,
                meta: p.meta,
                keeper: null,
                expiry: p.expiryNanos ?? null,
                streaming: false,
                initial: {
                    root: p.rootHex,
                    total: p.total,
                    leaves_uri: p.leavesUri,
                },
            },
        },
        funds: { denom: p.denom, amount: fundingRequired(p.total, p.feeBps) },
    });
}

export function claim(p: {
    sender: string;
    contract: string;
    id: number;
    amount: string;
    proof: string[];
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: { claim: { id: p.id, amount: p.amount, proof: p.proof } },
    });
}

export function claimMany(p: {
    sender: string;
    contract: string;
    claims: ClaimLeaf[];
    allowPartial?: boolean;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: {
            claim_many: {
                claims: p.claims.map((c) => ({ id: c.id, amount: c.amount, proof: c.proof })),
                allow_partial: p.allowPartial ?? true,
            },
        },
    });
}

export function freeze(p: {
    sender: string;
    contract: string;
    id: number;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: { freeze: { id: p.id } },
    });
}

export function setExpiry(p: {
    sender: string;
    contract: string;
    id: number;
    expiryNanos: string;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: { set_expiry: { id: p.id, expiry: p.expiryNanos } },
    });
}

export function clawback(p: {
    sender: string;
    contract: string;
    id: number;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: { clawback: { id: p.id } },
    });
}

export function updateMeta(p: {
    sender: string;
    contract: string;
    id: number;
    meta?: string;
    leavesUri?: string;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: {
            update_meta: {
                id: p.id,
                meta: p.meta ?? null,
                leaves_uri: p.leavesUri ?? null,
            },
        },
    });
}

export function transferCreator(p: {
    sender: string;
    contract: string;
    id: number;
    newCreator: string;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: { transfer_creator: { id: p.id, new_creator: p.newCreator } },
    });
}

export function acceptCreator(p: {
    sender: string;
    contract: string;
    id: number;
}): MsgExecuteContractCompat {
    return MsgExecuteContractCompat.fromJSON({
        contractAddress: p.contract,
        sender: p.sender,
        msg: { accept_creator: { id: p.id } },
    });
}
