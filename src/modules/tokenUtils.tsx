/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
    ChainGrpcWasmApi
} from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";

/* global BigInt */

interface EndpointConfig {
    grpc: string; // Assuming this is the type for now
}

interface Holder {
    address: string;
    balance: string; // or string if it represents a big number
    percentageHeld: string; // Adjust according to actual property names and types
}

class TokenUtils {
    endpoints: EndpointConfig;
    RPC: string;
    chainGrpcWasmApi: ChainGrpcWasmApi;

    constructor(endpoints: EndpointConfig) {
        this.endpoints = endpoints;
        this.RPC = endpoints.grpc;

        console.log(`Init tools on ${this.RPC}`);

        this.chainGrpcWasmApi = new ChainGrpcWasmApi(this.RPC);
    }

    async getTokenInfo(denom: string) {
        try {
            const query = Buffer.from(JSON.stringify({ token_info: {} })).toString('base64')
            const token = await this.chainGrpcWasmApi.fetchSmartContractState(denom, query)
            return JSON.parse(new TextDecoder().decode(token.data));
        } catch (error) {
            console.error('Error fetching token info:', denom, error);
            return {}
        }
    }

    async getTokenHolders(tokenAddress: string, callback: React.Dispatch<React.SetStateAction<number>>): Promise<Holder[]> {
        console.log("get token holders")

        const info = await this.getTokenInfo(tokenAddress); // Consider typing `info` more strictly
        if (!info || typeof info.decimals !== 'number') {
            console.error('Invalid token info or decimals missing');
            return [];
        }
        const decimals = info.decimals;

        const accountsWithBalances: Record<string, string> = {};
        try {
            let startAfter = "";
            let hasMore = true;

            while (hasMore) {
                const accountsQuery = Buffer.from(
                    JSON.stringify({
                        all_accounts: {
                            start_after: startAfter,
                            limit: 10
                        }
                    })
                ).toString("base64");
                console.log("do query, start after ", startAfter)
                const accountsInfo = await this.chainGrpcWasmApi.fetchSmartContractState(tokenAddress, accountsQuery);
                callback(num => num + 1)
                console.log(accountsInfo)
                const accountsDecoded = JSON.parse(new TextDecoder().decode(accountsInfo.data));

                if (accountsDecoded && accountsDecoded.accounts && accountsDecoded.accounts.length > 0) {
                    for (const walletAddress of accountsDecoded.accounts) {
                        const balanceQuery = Buffer.from(
                            JSON.stringify({ balance: { address: walletAddress } })
                        ).toString("base64");

                        const balanceInfo = await this.chainGrpcWasmApi.fetchSmartContractState(tokenAddress, balanceQuery);
                        const balanceDecoded = JSON.parse(new TextDecoder().decode(balanceInfo.data));

                        accountsWithBalances[walletAddress] = balanceDecoded.balance;
                    }

                    startAfter = accountsDecoded.accounts[accountsDecoded.accounts.length - 1];
                } else {
                    hasMore = false;
                }
            }

            console.log(accountsWithBalances);

            let nonZeroHolders = 0;
            let totalAmountHeld = BigInt(0);

            for (const key in accountsWithBalances) {
                const balance = BigInt(accountsWithBalances[key]);
                if (balance > 0) {
                    nonZeroHolders++;
                    totalAmountHeld += balance;
                }
            }

            console.log(`Total number of holders with non-zero balance: ${nonZeroHolders}`);
            console.log(`Total amount held: ${(Number(totalAmountHeld) / Math.pow(10, decimals)).toFixed(2)}`);

            const holders: Holder[] = [];
            for (const address in accountsWithBalances) {
                const balance = BigInt(accountsWithBalances[address]);
                if (balance > 0) {
                    const percentageHeld = Number(balance) / Number(totalAmountHeld) * 100;
                    holders.push({
                        address,
                        balance: (Number(balance) / Math.pow(10, decimals)).toFixed(2),
                        percentageHeld: percentageHeld.toFixed(2)
                    });
                }
            }

            holders.sort((a, b) => Number(b.percentageHeld) - Number(a.percentageHeld));

            return holders;

        } catch (e) {
            console.log(`Error in getTokenHoldersWithBalances: ${tokenAddress} ${e}`);
            return [];
        }
    }


}

export default TokenUtils
