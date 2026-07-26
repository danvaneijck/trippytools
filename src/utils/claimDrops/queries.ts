/**
 * Read helpers for the `choice-claim-drops` contract via ChainGrpcWasmApi.
 * Each takes a gRPC endpoint (`network.grpc`) and the instance address; query
 * shapes match `msg.rs::QueryMsg`.
 */
import { ChainGrpcWasmApi } from "@injectivelabs/sdk-ts";
import type {
    Campaign,
    CampaignResponse,
    ClaimableResponse,
    ClaimsResponse,
    Config,
    FundingRequiredResponse,
} from "./types";

const encode = (q: object): string => Buffer.from(JSON.stringify(q)).toString("base64");
const decode = <T>(data: Uint8Array): T => JSON.parse(Buffer.from(data).toString("utf8")) as T;

async function smartQuery<T>(grpc: string, contract: string, query: object): Promise<T> {
    const api = new ChainGrpcWasmApi(grpc);
    const res = await api.fetchSmartContractState(contract, encode(query));
    return decode<T>(res.data);
}

export const queryConfig = (grpc: string, contract: string): Promise<Config> =>
    smartQuery<Config>(grpc, contract, { config: {} });

export const queryCampaign = (
    grpc: string,
    contract: string,
    id: number,
): Promise<CampaignResponse> => smartQuery<CampaignResponse>(grpc, contract, { campaign: { id } });

export const queryCampaignsByCreator = (
    grpc: string,
    contract: string,
    creator: string,
    startAfter?: number,
    limit?: number,
): Promise<CampaignResponse[]> =>
    smartQuery<CampaignResponse[]>(grpc, contract, {
        campaigns_by_creator: { creator, start_after: startAfter ?? null, limit: limit ?? null },
    });

export const queryClaims = (
    grpc: string,
    contract: string,
    id: number,
    startAfter?: string,
    limit?: number,
): Promise<ClaimsResponse> =>
    smartQuery<ClaimsResponse>(grpc, contract, {
        claims: { id, start_after: startAfter ?? null, limit: limit ?? null },
    });

export const queryClaimable = (
    grpc: string,
    contract: string,
    id: number,
    address: string,
    amount: string,
    proof: string[],
): Promise<ClaimableResponse> =>
    smartQuery<ClaimableResponse>(grpc, contract, {
        claimable: { id, address, amount, proof },
    });

export const queryFundingRequired = (
    grpc: string,
    contract: string,
    id: number,
    newTotal: string,
): Promise<FundingRequiredResponse> =>
    smartQuery<FundingRequiredResponse>(grpc, contract, {
        funding_required: { id, new_total: newTotal },
    });

/** Page through every claimant of a campaign (manage view / reconciliation). */
export async function fetchAllClaims(
    grpc: string,
    contract: string,
    id: number,
): Promise<{ address: string; claimed: string }[]> {
    const all: { address: string; claimed: string }[] = [];
    let startAfter: string | undefined;
    for (;;) {
        const page = await queryClaims(grpc, contract, id, startAfter, 100);
        all.push(...page.claims);
        if (page.claims.length < 100) break;
        startAfter = page.claims[page.claims.length - 1].address;
    }
    return all;
}

export type { Campaign };
