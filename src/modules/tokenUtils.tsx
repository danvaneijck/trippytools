/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
    ChainGrpcWasmApi,
    ChainGrpcBankApi,
    IndexerRestExplorerApi,
    ExplorerTransaction,
    IndexerGrpcAccountPortfolioApi,
    Message,
} from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";
import moment from "moment";
import { TokenInfo } from "../types";

/* global BigInt */

interface EndpointConfig {
    grpc: string;
    explorer: string;
    indexer: string;
}

interface Holder {
    address: string;
    balance: string;
    percentageHeld: string;
}

interface PresaleAmount {
    address?: string | undefined;
    timeSent?: string | undefined;
    amountSent?: number | undefined;
    contribution?: number | undefined;
    toRefund?: number | undefined;
    amountSentFormatted?: number | undefined;
    totalContributionFormatted?: number | undefined;
    toRefundFormatted?: number | undefined;
    amountRefundedFormatted?: number | undefined;
    multiplierTokensSent?: number | undefined;
    multiplier?: number | undefined;
    adjustedContribution?: number | undefined;
    tokensToSend?: string | undefined;
    amountRefunded?: number | undefined;
    tokensSent?: string | undefined;
}

interface BalanceResponse {
    walletAddress: string;
    balance: string | null; // Assuming balance is a string; adjust type as necessary
}

interface ChainGrpcWasmApiResponse {
    data: ArrayBuffer;
    // Add other properties of the response if necessary
}

class TokenUtils {
    endpoints: EndpointConfig;
    RPC: string;
    chainGrpcWasmApi: ChainGrpcWasmApi;
    chainGrpcBankApi: ChainGrpcBankApi;
    indexerRestExplorerApi: IndexerRestExplorerApi;
    preSaleAmounts: Map<string, PresaleAmount>;
    indexerGrpcAccountPortfolioApi: IndexerGrpcAccountPortfolioApi;

    constructor(endpoints: EndpointConfig) {
        this.endpoints = endpoints;
        this.RPC = endpoints.grpc;

        console.log(`Init tools on ${this.RPC}`);

        this.chainGrpcWasmApi = new ChainGrpcWasmApi(this.RPC);
        this.chainGrpcBankApi = new ChainGrpcBankApi(this.RPC);
        this.indexerRestExplorerApi = new IndexerRestExplorerApi(
            this.endpoints.explorer
        );

        this.indexerGrpcAccountPortfolioApi =
            new IndexerGrpcAccountPortfolioApi(endpoints.indexer);

        this.preSaleAmounts = new Map();
    }

    async getBalanceOfToken(denom: string, wallet: string) {
        return await this.chainGrpcBankApi.fetchBalance({
            accountAddress: wallet,
            denom,
        });
    }

    async queryTokenForBalance(tokenAddress: string, wallet: string) {
        try {
            const query = Buffer.from(
                JSON.stringify({ balance: { address: wallet } })
            ).toString("base64");
            const info = await this.chainGrpcWasmApi.fetchSmartContractState(
                tokenAddress,
                query
            );
            const decoded = JSON.parse(new TextDecoder().decode(info.data));
            return decoded;
        } catch (e) {
            console.log(`Error queryTokenForBalance: ${tokenAddress} ${e}`);
        }
    }

    async getTokenInfo(denom: string) {
        try {
            const query = Buffer.from(
                JSON.stringify({ token_info: {} })
            ).toString("base64");
            const token = await this.chainGrpcWasmApi.fetchSmartContractState(
                denom,
                query
            );
            return JSON.parse(new TextDecoder().decode(token.data));
        } catch (error) {
            console.error("Error fetching token info:", denom, error);
            return {};
        }
    }

    async getDenomMetadata(denom: string) {
        const data = await this.chainGrpcBankApi.fetchDenomMetadata(denom);
        const matchingDenomUnit = data.denomUnits.find(
            (unit) => unit.denom === data.display
        );

        const supply = await this.chainGrpcBankApi.fetchSupplyOf(denom);

        const tokenInfo: TokenInfo = {
            name: data.name,
            symbol: data.symbol,
            decimals: matchingDenomUnit ? matchingDenomUnit.exponent : 0,
            total_supply: Number(supply.amount),
        };

        return tokenInfo;
    }

    async getCW20Balances(tokenAddress: string) {
        const balances = await this.indexerRestExplorerApi.fetchCW20Balances(
            tokenAddress
        );
        console.log(balances);
        return balances;
    }

    async fetchBalancesInBatches(
        accounts: string[],
        batchSize: number,
        tokenAddress: string,
        callback: React.Dispatch<React.SetStateAction<number>>
    ): Promise<Record<string, string | null>> {
        const accountsWithBalances: Record<string, string | null> = {};

        for (let i = 0; i < accounts.length; i += batchSize) {
            const batchAccounts = accounts.slice(i, i + batchSize);

            const balancePromises: Promise<BalanceResponse>[] =
                batchAccounts.map(async (walletAddress) => {
                    const balanceQuery = Buffer.from(
                        JSON.stringify({ balance: { address: walletAddress } })
                    ).toString("base64");

                    try {
                        const balanceInfo: ChainGrpcWasmApiResponse =
                            await this.chainGrpcWasmApi.fetchSmartContractState(
                                tokenAddress,
                                balanceQuery
                            );
                        callback((num) => num + 1);
                        const balanceDecoded = JSON.parse(
                            new TextDecoder().decode(balanceInfo.data)
                        );
                        return {
                            walletAddress,
                            balance: balanceDecoded.balance,
                        };
                    } catch (error) {
                        console.error(
                            `Error fetching balance for ${walletAddress}:`,
                            error
                        );
                        return { walletAddress, balance: null };
                    }
                });

            const balances: BalanceResponse[] = await Promise.all(
                balancePromises
            );
            balances.forEach(({ walletAddress, balance }) => {
                accountsWithBalances[walletAddress] = balance;
            });
        }

        return accountsWithBalances;
    }

    async getTokenHolders(
        tokenAddress: string,
        callback: React.Dispatch<React.SetStateAction<number>>
    ): Promise<Holder[]> {
        const info = await this.getTokenInfo(tokenAddress);

        if (!info || typeof info.decimals !== "number") {
            console.error("Invalid token info or decimals missing");
            return [];
        }

        const decimals = info.decimals;

        const accounts = [];

        try {
            let cachedAddresses: string[] = [];
            const cacheKey = `${tokenAddress}_addresses`;

            const data = localStorage.getItem(cacheKey);

            if (data) {
                cachedAddresses = JSON.parse(data);
                accounts.push(...cachedAddresses);
            } else {
                console.log("No cache found in localStorage, starting fresh.");
            }

            let startAfter = cachedAddresses.at(-1) ?? "";
            let hasMore = true;

            while (hasMore) {
                const accountsQuery = Buffer.from(
                    JSON.stringify({
                        all_accounts: {
                            start_after: startAfter,
                            limit: 30,
                        },
                    })
                ).toString("base64");

                const accountsInfo =
                    await this.chainGrpcWasmApi.fetchSmartContractState(
                        tokenAddress,
                        accountsQuery
                    );
                callback((num) => num + 1);

                const accountsDecoded = JSON.parse(
                    new TextDecoder().decode(accountsInfo.data)
                );
                if (
                    accountsDecoded &&
                    accountsDecoded.accounts &&
                    accountsDecoded.accounts.length > 0
                ) {
                    const newAccounts = accountsDecoded.accounts.filter(
                        (account: string) => !cachedAddresses.includes(account)
                    );

                    cachedAddresses = [...cachedAddresses, ...newAccounts];
                    localStorage.setItem(
                        cacheKey,
                        JSON.stringify(cachedAddresses)
                    );

                    accounts.push(...newAccounts);
                    startAfter = accountsDecoded.accounts.at(-1);
                } else {
                    hasMore = false;
                }
            }

            const accountsWithBalances = await this.fetchBalancesInBatches(
                accounts,
                10,
                tokenAddress,
                callback
            );

            let nonZeroHolders = 0;
            let totalAmountHeld = Number(0);

            Object.values(accountsWithBalances).forEach((balanceStr) => {
                const balance = Number(balanceStr);
                if (balance > 0) {
                    nonZeroHolders++;
                    totalAmountHeld += balance;
                }
            });

            console.log(
                `Total number of holders with non-zero balance: ${nonZeroHolders}`
            );
            console.log(
                `Total amount held: ${(
                    Number(totalAmountHeld) / Math.pow(10, decimals)
                ).toFixed(2)}`
            );

            const holders: Holder[] = Object.entries(
                accountsWithBalances
            ).reduce((acc, [address, balanceStr]) => {
                const balance = Number(balanceStr);
                if (balance > 0) {
                    const percentageHeld =
                        (Number(balance) * 100) / Number(totalAmountHeld);
                    if (
                        Number(
                            (Number(balance) / Math.pow(10, decimals)).toFixed(
                                4
                            )
                        ) !== 0
                    ) {
                        acc.push({
                            address,
                            balance: (
                                Number(balance) / Math.pow(10, decimals)
                            ).toFixed(4),
                            percentageHeld: percentageHeld.toFixed(2),
                        });
                    }
                }
                return acc;
            }, [] as Holder[]);

            holders.sort(
                (a, b) => Number(b.percentageHeld) - Number(a.percentageHeld)
            );

            return holders;
        } catch (e) {
            console.log(
                `Error in getTokenHoldersWithBalances: ${tokenAddress} ${e}`
            );
            return [];
        }
    }

    async getAccountTx(address: string) {
        console.log("get presale tx from address", address);

        try {
            const allTransactions = [];
            const transactionHashes = new Set(); // Set to store transaction hashes

            let from = 0;
            let to = 100;

            let transactions;
            let totalTx;

            do {
                transactions =
                    await this.indexerRestExplorerApi.fetchAccountTransactions({
                        account: address,
                        params: {
                            fromNumber: from,
                            toNumber: to,
                        },
                    });

                totalTx = transactions.paging.total;

                const currentTransactions = transactions.transactions || [];
                for (const tx of currentTransactions) {
                    if (!transactionHashes.has(tx.hash)) {
                        allTransactions.push(tx);
                        transactionHashes.add(tx.hash);
                    }
                }

                from = to;
                to += 100;
            } while (allTransactions.length < totalTx);

            return allTransactions;
        } catch (error) {
            console.error(
                "An error occurred getting pair transactions:",
                error
            );
        }
    }

    async getContractTx(address: string) {
        const contractAddress = address;
        const limit = 100;
        let skip = 0;

        const allTransactions = [];
        let transactions =
            await this.indexerRestExplorerApi.fetchContractTransactionsWithMessages(
                {
                    contractAddress,
                    params: {
                        limit,
                        skip,
                    },
                }
            );

        try {
            console.log(
                `total tx for ${contractAddress} : ${transactions.paging.total}`
            );
            do {
                const currentTransactions = transactions.transactions || [];
                allTransactions.push(...currentTransactions);

                if (currentTransactions.length == 0) {
                    break;
                }

                const toSkip =
                    skip + limit > transactions.paging.total
                        ? transactions.paging.total - skip
                        : limit;
                skip += Number(toSkip);
                skip = Math.min(skip, 10000);

                transactions =
                    await this.indexerRestExplorerApi.fetchContractTransactionsWithMessages(
                        {
                            contractAddress,
                            params: {
                                limit,
                                skip,
                            },
                        }
                    );
            } while (allTransactions.length < transactions.paging.total);
        } catch (error) {
            console.error(
                "An error occurred getting pair transactions:",
                error
            );
        }

        console.log(allTransactions.length);
        return allTransactions;
    }

    getPreSaleAmounts(
        address: string,
        allTransactions: ExplorerTransaction[],
        max: number,
        minPerWallet: number,
        maxPerWallet: number
    ) {
        const maxCap = max * Math.pow(10, 18);
        const minContribution = minPerWallet * Math.pow(10, 18);
        const maxContribution = maxPerWallet * Math.pow(10, 18);

        let totalAmountReceived = 0;
        let totalValidContributions = 0;

        let maxCapHit = false;
        let maxCapBlock = null;

        allTransactions.sort(
            (a: ExplorerTransaction, b: ExplorerTransaction) => {
                return a.blockNumber - b.blockNumber;
            }
        );

        allTransactions.forEach((tx) => {
            const messageError =
                tx.errorLog !== undefined && tx.errorLog.length > 1;
            if (messageError) {
                return;
            }

            const blockNumber = tx.blockNumber;
            const blockTimestamp = moment(
                tx.blockTimestamp,
                "YYYY-MM-DD HH:mm:ss.SSS Z"
            );

            tx.messages.forEach((message: Message) => {
                let sender,
                    recipient,
                    amount = null;

                if (
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    message.message.msg.includes("transfer") &&
                    !message.message.contract
                ) {
                    const msg = JSON.parse(message.message.msg);
                    sender = message.message["sender"];
                    recipient = msg["transfer"]["recipient"];
                    amount = msg["transfer"]["amount"];
                } else if (message.type == "/cosmos.bank.v1beta1.MsgSend") {
                    amount = message.message.amount
                        ? message.message.amount[0].denom == "inj"
                            ? message.message.amount[0].amount
                            : null
                        : null;
                    sender = message.message["from_address"];
                    recipient = message.message["to_address"];
                } else {
                    // sending out the memes
                    return;
                }

                if (recipient == address) {
                    totalAmountReceived += Number(amount);
                }

                let withinMaxCap = Number(totalValidContributions) <= maxCap;
                if (recipient == address) {
                    withinMaxCap =
                        Number(totalValidContributions) + Number(amount) <=
                        maxCap;
                }

                const room =
                    (maxCap - Number(totalValidContributions)) /
                    Math.pow(10, 18);

                if (
                    recipient == address &&
                    (Number(amount) < minContribution ||
                        Number(amount) > maxContribution)
                ) {
                    const entry = this.preSaleAmounts.get(sender);
                    const totalSent =
                        Number(amount) +
                        (entry ? Number(entry.amountSent ?? 0) : 0);
                    let toRefund = 0;

                    if (totalSent > maxContribution) {
                        toRefund = totalSent - maxContribution;
                    } else if (totalSent < minContribution) {
                        toRefund = Number(amount);
                    }

                    toRefund -= entry ? Number(entry.amountRefunded) ?? 0 : 0;
                    if (toRefund < 0) toRefund = 0;

                    this.preSaleAmounts.set(sender, {
                        ...entry,
                        address: sender,
                        amountSent: totalSent,
                        contribution: totalSent - toRefund,
                        toRefund: toRefund,
                    });

                    totalValidContributions += totalSent - toRefund;
                    return;
                }

                if (
                    recipient == address &&
                    !withinMaxCap &&
                    maxCapHit == false &&
                    room > 0.5
                ) {
                    let totalSent = Number(amount);
                    let toRefund = Number(amount);
                    const entry = this.preSaleAmounts.get(sender);

                    if (entry) {
                        totalSent += Number(entry.amountSent ?? 0);
                        toRefund += Number(entry.toRefund ?? 0);
                        toRefund -= Number(entry.amountRefunded ?? 0);
                    }

                    if (toRefund < 0) toRefund = 0;

                    this.preSaleAmounts.set(sender, {
                        ...entry,
                        address: sender,
                        amountSent: totalSent,
                        contribution: Number(totalSent) - Number(toRefund),
                        toRefund: toRefund,
                    });

                    totalValidContributions +=
                        Number(totalSent) - Number(toRefund);
                    return;
                }

                if (!withinMaxCap && maxCapHit == false && room < 0.5) {
                    maxCapHit = true;
                    maxCapBlock = blockNumber;
                    console.log(`max cap hit with room left ${room}`);
                }

                if (sender && recipient && amount) {
                    if (sender == address) {
                        const participant = recipient;

                        if (this.preSaleAmounts.has(participant)) {
                            const entry = this.preSaleAmounts.get(participant);
                            if (entry) {
                                const amountRefunded =
                                    (Number(entry.amountRefunded) ?? 0) +
                                    Number(amount);

                                let toRefund =
                                    Number(entry.toRefund) ??
                                    0 - amountRefunded;
                                if (toRefund < 0) toRefund = 0;

                                this.preSaleAmounts.set(participant, {
                                    ...entry,
                                    address: participant,
                                    amountRefunded: amountRefunded,
                                    contribution: entry.contribution ?? 0,
                                    toRefund: toRefund,
                                });
                            }
                        }
                    } else {
                        if (this.preSaleAmounts.has(sender)) {
                            const entry = this.preSaleAmounts.get(sender);
                            if (entry) {
                                const totalSent =
                                    Number(amount) +
                                    (Number(entry.amountSent) ?? 0);
                                let toRefund = 0;

                                if (!withinMaxCap) {
                                    toRefund += Number(amount);
                                }

                                if (totalSent > maxContribution) {
                                    toRefund =
                                        Number(totalSent) -
                                        Number(maxContribution);
                                } else if (totalSent < minContribution) {
                                    toRefund = Number(amount);
                                }

                                toRefund -= entry.amountRefunded
                                    ? Number(entry.amountRefunded)
                                    : 0;

                                this.preSaleAmounts.set(sender, {
                                    ...entry,
                                    address: sender,
                                    amountSent: totalSent,
                                    contribution: totalSent - toRefund,
                                    toRefund: toRefund,
                                });

                                if (totalSent - toRefund < 0) {
                                    console.log("contrib lower than 0");
                                }
                                totalValidContributions += totalSent - toRefund;
                            }
                        } else {
                            const toRefund = !withinMaxCap ? Number(amount) : 0;

                            this.preSaleAmounts.set(sender, {
                                address: sender,
                                timeSent: blockTimestamp.format(),
                                amountSent: Number(amount),
                                contribution: Number(amount) - Number(toRefund),
                                toRefund: toRefund,
                            });

                            if (Number(amount) - toRefund < 0) {
                                console.log("contrib lower than 0");
                            }

                            totalValidContributions +=
                                Number(amount) - toRefund;
                        }
                    }
                }
            });
        });

        console.log(
            "total amount received: ",
            (totalAmountReceived / Math.pow(10, 18)).toFixed(2),
            "INJ"
        );

        this.preSaleAmounts.forEach((value, key) => {
            const amountSentFormatted =
                (Number(value.amountSent) ?? 0) / Math.pow(10, 18);
            const totalContributionFormatted =
                (Number(value.contribution) ?? 0) / Math.pow(10, 18);
            const toRefundFormatted =
                (Number(value.toRefund) ?? 0) / Math.pow(10, 18);
            const amountRefundedFormatted =
                (Number(value.amountRefunded) ?? 0) / Math.pow(10, 18);

            this.preSaleAmounts.set(key, {
                ...value,
                amountSentFormatted: amountSentFormatted,
                totalContributionFormatted: totalContributionFormatted,
                toRefundFormatted: toRefundFormatted,
                amountRefundedFormatted: amountRefundedFormatted,
            });
        });

        let totalRefunded = 0;
        let totalContribution = 0;
        let totalToRefund = 0;

        Array.from(this.preSaleAmounts.values()).forEach((entry) => {
            if (entry.amountRefunded)
                totalRefunded += Number(entry.amountRefunded) ?? 0;
            if (entry.contribution)
                totalContribution += Number(entry.contribution) ?? 0;
            if (entry.toRefund) totalToRefund += Number(entry.toRefund) ?? 0;

            // if (entry.totalContributionFormatted && entry.totalContributionFormatted > 0 && !entry.tokensSent) {
            //     console.log(entry.address);
            // }
        });

        console.log(totalToRefund, totalContribution);

        console.log(
            "to refund: ",
            (totalToRefund / Math.pow(10, 18)).toFixed(2),
            "INJ"
        );
        console.log(
            "total contributions: ",
            (totalContribution / Math.pow(10, 18)).toFixed(2),
            "INJ"
        );

        console.log("max cap hit: ", maxCapHit, "block number: ", maxCapBlock);

        const totalR = Number(
            (totalAmountReceived / Math.pow(10, 18)).toFixed(2)
        );
        const totalC = Number(totalContribution) / Math.pow(10, 18);
        const totalRef = Number(totalToRefund) / Math.pow(10, 18);
        totalRefunded = Number(totalRefunded / Math.pow(10, 18));

        const leftOver = totalR - totalC - totalRef - totalRefunded;

        console.log(
            `${totalR} - ${totalC} - ${totalRef} - ${totalRefunded} = ${leftOver}`
        );

        return totalC;
    }

    calculatePercentageOfPercentage(x: number) {
        if (x < 1 || x > 10000000) {
            return "x is out of the expected range (1 to 10,000,000)";
        }

        const xAsPercentageOfTotal = (x / 10000000) * 100;

        const percentageOf25 = xAsPercentageOfTotal * 0.25;

        return percentageOf25;
    }

    async getMultiplier(presaleWallet: string, multiplierToken: string) {
        const allTransactions = await this.getContractTx(multiplierToken);

        allTransactions.forEach((tx) => {
            if (!tx.messages) return;
            tx.messages.forEach((message) => {
                if (message.value.contract == multiplierToken) {
                    if (message.value.msg.transfer) {
                        const recipient = message.value.msg.transfer.recipient;
                        const amount = message.value.msg.transfer.amount;
                        const sender = message.value.sender;
                        if (recipient == presaleWallet) {
                            // console.log(`sender ${sender} sent ${amount / Math.pow(10, 18)} shroom to pre sale wallet`)

                            if (this.preSaleAmounts.has(sender)) {
                                const entry = this.preSaleAmounts.get(sender);
                                if (entry) {
                                    const a = entry.multiplierTokensSent ?? 0;
                                    this.preSaleAmounts.set(sender, {
                                        ...entry,
                                        multiplierTokensSent:
                                            Number(amount / Math.pow(10, 18)) +
                                            Number(a),
                                    });
                                }
                            } else {
                                this.preSaleAmounts.set(sender, {
                                    multiplierTokensSent: 0,
                                });
                            }
                        }
                    }
                }
            });
        });

        this.preSaleAmounts.forEach((entry, address) => {
            if (!entry.multiplierTokensSent) {
                this.preSaleAmounts.set(address, {
                    ...entry,
                    multiplierTokensSent: 0,
                    multiplier: 0,
                    adjustedContribution: entry.contribution,
                });
                return;
            }
            let tokensSent = entry.multiplierTokensSent;
            if (tokensSent > 10000000) tokensSent = 10000000;
            const multi =
                Number(this.calculatePercentageOfPercentage(tokensSent)) / 100;

            this.preSaleAmounts.set(address, {
                ...entry,
                multiplier: multi,
                adjustedContribution:
                    Number(entry.contribution) +
                    multi * Number(entry.contribution ?? 0),
            });
        });

        let total = 0;
        this.preSaleAmounts.forEach((entry) => {
            if (entry.adjustedContribution)
                total += Number(entry.adjustedContribution);
        });
        return total;
    }

    generateAirdropCSV(
        totalContribution: number,
        totalAdjustedContribution: number,
        totalSupply: number,
        decimals: number,
        percentToAirdrop: number,
        devAllocation: number
    ) {
        let amountToDrop =
            totalSupply * Math.pow(10, decimals) * percentToAirdrop;
        const forDev = totalSupply * Math.pow(10, decimals) * devAllocation;
        amountToDrop -= forDev;

        console.log(`dev allocated tokens: ${forDev / Math.pow(10, 18)}`);
        console.log(
            `number of tokens to airdrop: ${amountToDrop / Math.pow(10, decimals)
            }`
        );
        console.log(`total raised INJ: ${totalContribution}`);
        console.log(
            `LP starting price: ${(
                (totalContribution * Math.pow(10, 18)) /
                amountToDrop
            ).toFixed(8)} INJ`
        );

        const dropAmounts = new Map();

        Array.from(this.preSaleAmounts.values()).forEach((entry) => {
            if (entry.address) {
                if (!entry.contribution || entry.contribution <= 0) return;

                const sender = entry.address;
                const percentOfSupply =
                    Number(entry.adjustedContribution) /
                    Number(totalAdjustedContribution);
                const numberForUser = amountToDrop * percentOfSupply;

                this.preSaleAmounts.set(entry.address, {
                    ...entry,
                    tokensToSend: numberForUser
                        ? (numberForUser / Math.pow(10, 18)).toFixed(0) +
                        "0".repeat(18)
                        : "0",
                });

                if (numberForUser)
                    dropAmounts.set(
                        sender,
                        (numberForUser / Math.pow(10, 18)).toFixed(0) +
                        "0".repeat(18)
                    );
            }
        });

        let total = 0;
        this.preSaleAmounts.forEach((entry) => {
            if (entry.adjustedContribution)
                total += Number(entry.adjustedContribution);
        });
        console.log("total adjusted contribution", total);
        return this.preSaleAmounts;
    }

    async getPairInfo(pairAddress: string) {
        const pairQuery = Buffer.from(JSON.stringify({ pair: {} })).toString(
            "base64"
        );
        const pairInfo = await this.chainGrpcWasmApi.fetchSmartContractState(
            pairAddress,
            pairQuery
        );
        const infoDecoded = JSON.parse(new TextDecoder().decode(pairInfo.data));

        const assetInfos = infoDecoded["asset_infos"];
        const tokenInfos = [];
        for (const assetInfo of assetInfos) {
            const denom = assetInfo["native_token"]
                ? assetInfo["native_token"]["denom"]
                : assetInfo["token"]["contract_addr"];

            tokenInfos.push({
                denom: denom,
            });
        }

        if (tokenInfos.length !== 2) return null;
        const [token0Info, token1Info] = tokenInfos;

        return {
            token0Meta: token0Info,
            token1Meta: token1Info,
            ...infoDecoded,
        };
    }
}

export default TokenUtils;
