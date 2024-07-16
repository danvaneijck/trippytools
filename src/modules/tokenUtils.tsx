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
    ChainGrpcTokenFactoryApi,
    ContractAccountBalance,
    IndexerGrpcSpotApi,
    IndexerGrpcMitoApi,
    IndexerGrpcOracleApi,
    IndexerGrpcDerivativesApi,
    MsgInstantBinaryOptionsMarketLaunch,
    MsgCreateBinaryOptionsLimitOrder,
    ChainGrpcGovApi,
    IndexerGrpcAccountApi
} from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";
import moment from "moment";
import { TokenInfo } from "../types";
import { Coin } from "@injectivelabs/ts-types";
/* global BigInt */
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CW404_BALANCE_STARTING_KEYS } from "../constants/cw404BalanceKeys";
import { DenomClientAsync } from "@injectivelabs/sdk-ui-ts";
import { Network } from "@injectivelabs/networks";

const DOJO_ROUTER = "inj1t6g03pmc0qcgr7z44qjzaen804f924xke6menl"


interface EndpointConfig {
    rpc(rpc: any): unknown;
    grpc: string;
    explorer: string;
    indexer: string;
}

interface Holder {
    address: string;
    balance: string;
    percentageHeld: number;
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

const INJ_USD_DOJO_ADDRESS = "inj1h0mpv48ctcsmydymh2hnkal7hla5gl4gftemqv"
const DOJO_USD_DOJO_ADDRESS = "inj12t4ysml8h5wrlguuy5jsdcpx53h559sz870uvh"

class TokenUtils {
    endpoints: EndpointConfig;
    RPC: string;
    chainGrpcWasmApi: ChainGrpcWasmApi;
    chainGrpcBankApi: ChainGrpcBankApi;
    indexerRestExplorerApi: IndexerRestExplorerApi;
    preSaleAmounts: Map<string, PresaleAmount>;
    indexerGrpcAccountPortfolioApi: IndexerGrpcAccountPortfolioApi;
    chainGrpcTokenFactoryApi: ChainGrpcTokenFactoryApi;
    baseAssets: ({ native_token: { denom: string; }; token?: undefined; } | { token: { contract_addr: string; }; native_token?: undefined; })[];
    factories: { name: string; address: string; }[];
    baseDenom: any;
    dojoAssetInfo: { token: { contract_addr: string; }; };
    injAssetInfo: { native_token: { denom: string; }; };
    denomClient: DenomClientAsync;
    indexerGrpcSpotApi: IndexerGrpcSpotApi;
    mitoApi: IndexerGrpcMitoApi;

    constructor(endpoints: EndpointConfig) {
        this.endpoints = endpoints;
        this.RPC = endpoints.grpc;

        this.chainGrpcWasmApi = new ChainGrpcWasmApi(this.RPC);
        this.chainGrpcBankApi = new ChainGrpcBankApi(this.RPC);
        this.indexerRestExplorerApi = new IndexerRestExplorerApi(
            this.endpoints.explorer
        );
        this.chainGrpcTokenFactoryApi = new ChainGrpcTokenFactoryApi(this.RPC)

        this.indexerGrpcAccountPortfolioApi =
            new IndexerGrpcAccountPortfolioApi(endpoints.indexer);

        this.indexerGrpcSpotApi = new IndexerGrpcSpotApi(endpoints.indexer)

        this.preSaleAmounts = new Map();

        this.denomClient = new DenomClientAsync(Network.Mainnet, {
            endpoints: {
                grpc: this.RPC,
                indexer: "https://sentry.exchange.grpc-web.injective.network",
                rest: "https://sentry.lcd.injective.network",
                rpc: "https://sentry.tm.injective.network"
            }
        })

        this.dojoAssetInfo = {
            token: {
                contract_addr: 'inj1zdj9kqnknztl2xclm5ssv25yre09f8908d4923'
            }
        }

        this.injAssetInfo = {
            native_token: {
                denom: 'inj'
            }
        }

        this.baseAssets = [
            this.injAssetInfo,
            this.dojoAssetInfo

        ]
        this.factories = [
            {
                name: "DojoSwap",
                address: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk"
            },
            {
                name: "Astroport",
                address: "inj19aenkaj6qhymmt746av8ck4r8euthq3zmxr2r6"
            }

        ]
    }

    async getINJPrice() {
        const baseAssetPair = await this.getPairInfo(INJ_USD_DOJO_ADDRESS)
        const quote = await this.getQuote(baseAssetPair.contract_addr, 1)
        if (!quote) return
        return Number(quote['return_amount']) / Math.pow(10, 6)
    }

    async getDOJOPrice() {
        const baseAssetPair = await this.getPairInfo(DOJO_USD_DOJO_ADDRESS)
        const quote = await this.getQuoteWithOfferAsset(baseAssetPair.contract_addr, this.dojoAssetInfo, 1)
        console.log("dojo quote", quote)
        if (!quote) return
        return Number(quote['return_amount']) / Math.pow(10, 6)
    }

    async getQuoteWithOfferAsset(pair: string, offerAsset: any, amount: number) {
        if (!pair) return
        const offerAmount = amount * Math.pow(10, 18);
        const simulationQuery = {
            simulation: {
                offer_asset: {
                    info: offerAsset,
                    amount: offerAmount.toString()
                }
            }
        };
        try {
            const query = Buffer.from(JSON.stringify(simulationQuery)).toString('base64');
            const sim = await this.chainGrpcWasmApi.fetchSmartContractState(pair, query);
            const decodedData = JSON.parse(new TextDecoder().decode(sim.data));
            return decodedData;
        } catch (error) {
            console.error(error);
        }
    }

    async getQuote(pair: string, amount: number) {
        if (!pair) return
        const offerAmount = amount * Math.pow(10, 18);
        const simulationQuery = {
            simulation: {
                offer_asset: {
                    info: {
                        native_token: {
                            denom: 'inj'
                        }
                    },
                    amount: offerAmount.toString()
                }
            }
        };
        try {
            const query = Buffer.from(JSON.stringify(simulationQuery)).toString('base64');
            const sim = await this.chainGrpcWasmApi.fetchSmartContractState(pair, query);
            const decodedData = JSON.parse(new TextDecoder().decode(sim.data));
            return decodedData;
        } catch (error) {
            console.error(error);
        }
    }

    async getSellQuoteRouter(pair, amount) {
        const pairName = `${pair.token0Meta.symbol}, ${pair.token1Meta.symbol}`;

        try {
            if (!pair || !pair.asset_infos || !Array.isArray(pair.asset_infos)) {
                throw new Error(`Invalid pair or asset_infos for getSellQuoteFromRouter DojoSwap: ${pair}`);
            }

            const assetToSell = pair.asset_infos.findIndex(assetInfo => {
                const isNativeToken = assetInfo.native_token && assetInfo.native_token.denom !== 'inj';
                const isCW20Token = assetInfo.token && assetInfo.token.contract_addr !== 'inj';
                return isNativeToken || isCW20Token;
            });

            if (assetToSell === -1) {
                throw new Error(`Error finding ask asset for ${pairName}`);
            }
            const assetInfo = pair.asset_infos[assetToSell];

            const simulationQuery = {
                simulate_swap_operations: {
                    offer_amount: amount.toString(),
                    operations: [
                        {
                            dojo_swap: {
                                offer_asset_info: assetInfo,
                                ask_asset_info: {
                                    native_token: {
                                        denom: 'inj'
                                    }
                                }
                            }
                        }
                    ]
                }
            };

            const query = Buffer.from(JSON.stringify(simulationQuery)).toString('base64');
            const sim = await this.chainGrpcWasmApi.fetchSmartContractState(DOJO_ROUTER, query);
            const decodedData = JSON.parse(new TextDecoder().decode(sim.data));
            return decodedData;
        } catch (error) {
            console.error(`Error getting DojoSwap sell quote for ${pairName}: ${error}`);
            return null;
        }
    }

    async getUserTokens(address: string) {
        const tokens = await this.chainGrpcTokenFactoryApi.fetchDenomsFromCreator(address);

        const tokensWithMetadata = await Promise.all(tokens.map(async (token) => {
            const metadata = await this.getDenomExtraMetadata(token);
            return { token, metadata };
        }));

        return tokensWithMetadata;
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
            throw error
        }
    }

    async getTokenMarketing(denom: string) {
        try {
            const query = Buffer.from(
                JSON.stringify({ marketing_info: {} })
            ).toString("base64");
            const token = await this.chainGrpcWasmApi.fetchSmartContractState(
                denom,
                query
            );
            return JSON.parse(new TextDecoder().decode(token.data));
        } catch (error) {
            console.error("Error fetching token info:", denom, error);
            throw error
        }
    }

    async getDenomMetadata(denom) {
        try {
            const token = await this.denomClient.getDenomToken(denom)
            return token;
        } catch (error) {
            console.error('Error fetching token info:', error);
            return {}
        }
    }

    async getDenomExtraMetadata(denom: string) {
        const data = await this.chainGrpcBankApi.fetchDenomMetadata(denom);
        const matchingDenomUnit = data.denomUnits.find(
            (unit) => unit.denom === data.display
        );

        const supply = await this.chainGrpcBankApi.fetchSupplyOf(denom);
        const admin = await this.chainGrpcTokenFactoryApi.fetchDenomAuthorityMetadata(denom.split("/")[1], denom.split("/")[2])

        const tokenInfo: TokenInfo = {
            name: data.name,
            denom: denom,
            symbol: data.symbol,
            decimals: matchingDenomUnit ? matchingDenomUnit.exponent : 0,
            total_supply: Number(supply.amount),
            description: data.description,
            logo: data.uri,
            admin: admin.admin
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
        setProgress: React.Dispatch<React.SetStateAction<string>>
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
                        setProgress(`wallets checked: ${Object.values(accountsWithBalances).length}`);
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

    async getCW20TokenHolders(
        tokenAddress: string,
        setProgress: React.Dispatch<React.SetStateAction<string>>
    ) {
        const info = await this.getTokenInfo(tokenAddress);

        if (!info || typeof info.decimals !== "number") {
            console.error("Invalid token info or decimals missing");
            return [];
        }

        const decimals = info.decimals;
        let allBalances: ContractAccountBalance[] = [];
        let nextPage: string | null = '';

        do {
            const response = await this.chainGrpcWasmApi.fetchContractAccountsBalance({
                contractAddress: tokenAddress,
                pagination: { limit: 100, key: nextPage }
            });

            if (response && response.contractAccountsBalance) {
                allBalances = allBalances.concat(response.contractAccountsBalance);
            } else {
                console.log("No balances found for the provided denom.");
                break;
            }

            nextPage = response.pagination.next;
            setProgress(`wallets checked: ${allBalances.length}`);
        } while (nextPage);

        try {
            const accountsWithBalances = allBalances.filter(holder => Number(holder.balance) > 0).map(holder => ({
                address: holder.account,
                balance: Number(holder.balance) > 0 ? Number(holder.balance) / Math.pow(10, decimals) : 0
            }));


            const totalAmountHeld = accountsWithBalances.reduce((total, holder) => total + holder.balance, 0);

            const holdersWithPercentage = accountsWithBalances.map(holder => ({
                ...holder,
                percentageHeld: totalAmountHeld === 0 ? 0 : (holder.balance / totalAmountHeld) * 100
            }));

            return holdersWithPercentage.sort((a, b) => b.percentageHeld - a.percentageHeld);
        } catch (e) {
            console.error(`Error in getTokenHoldersWithBalances: ${tokenAddress}`, e);
            return [];
        }
    }


    async getTokenFactoryTokenHolders(denom: string, setProgress: React.Dispatch<React.SetStateAction<string>>) {
        try {

            const info = await this.getDenomExtraMetadata(denom)
            const decimals = info.decimals

            let allBalances: {
                address: string;
                balance: Coin | undefined;
            }[] = [];
            let total = 0

            let nextPage: string | null = '';
            do {
                const response = await this.chainGrpcBankApi.fetchDenomOwners(denom, { key: nextPage });
                if (response && response.pagination.total) {
                    total = response.pagination.total
                }

                if (response && response.denomOwners) {
                    allBalances = allBalances.concat(response.denomOwners);
                } else {
                    console.log("No balances found for the provided denom.");
                    break;
                }

                nextPage = response.pagination.next;
                setProgress(`wallets checked: ${allBalances.length} / ${total}`)
            } while (nextPage);

            const accountsWithBalances = allBalances.map((holder) => {
                return {
                    address: holder.address,
                    balance: holder.balance ? Number(holder.balance.amount) / Math.pow(10, decimals) : 0
                }
            })

            const totalAmountHeld = accountsWithBalances.reduce((total, holder) => total + holder.balance, 0);

            const holdersWithPercentage = accountsWithBalances.map((holder) => ({
                ...holder,
                percentageHeld: totalAmountHeld === 0 ? 0 : (holder.balance / totalAmountHeld) * 100
            }));

            const sortedHolders = holdersWithPercentage.sort((a, b) => b.percentageHeld - a.percentageHeld);

            const formattedHolders = sortedHolders.map((holder) => {
                return {
                    ...holder,
                    percentageHeld: holder.percentageHeld
                }
            });

            return formattedHolders;

        } catch (error) {
            console.error("Error fetching token holders:", error);
            return []
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
        console.log(`total raised INJ: ${totalContribution}`);

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
            const denom = assetInfo['native_token']
                ? assetInfo['native_token']['denom']
                : assetInfo['token']['contract_addr'];


            let tokenInfo = undefined
            let marketing = undefined
            if (
                denom === 'inj'
                || denom.includes("factory")
                || denom.includes("peggy")
                || denom.includes("ibc")
            ) {
                tokenInfo = await this.getDenomMetadata(denom)
            }
            else {
                try {
                    tokenInfo = await this.getTokenInfo(denom);
                    marketing = await this.getTokenMarketing(denom);
                }
                catch (error) {
                    if (error.message.includes("Error parsing into type cw404")) {
                        try {
                            tokenInfo = await this.getCW404TokenInfo(denom);
                        } catch (innerError) {
                            console.error("Error with CW404 token info retrieval:", innerError);
                        }
                    }
                    else {
                        console.error("Error with token info retrieval:", error);
                    }
                }
            }
            tokenInfos.push({
                denom: denom,
                tokenType: denom.includes("factory") ? "tokenFactory" : "cw20",
                ...marketing,
                ...tokenInfo,
            });
        }
        if (tokenInfos.length !== 2) return null
        const [token0Info, token1Info] = tokenInfos;

        return {
            token0Meta: token0Info,
            token1Meta: token1Info,
            ...infoDecoded,
        };
    }

    async getNFTCollectionInfo(collectionAddress: string) {
        const infoQuery = Buffer.from(
            JSON.stringify({
                contract_info: {}
            })
        ).toString("base64");

        const info = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, infoQuery);
        const infoDecoded = JSON.parse(new TextDecoder().decode(info.data));
        return infoDecoded
    }

    async getNFTHolders(collectionAddress: string, setProgress: React.Dispatch<React.SetStateAction<string>>) {
        const numTokensQuery = Buffer.from(
            JSON.stringify({
                num_tokens: {}
            })
        ).toString("base64");

        const numTokensInfo = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, numTokensQuery);
        const numTokensDecoded = JSON.parse(new TextDecoder().decode(numTokensInfo.data));
        console.log(numTokensDecoded);
        const totalTokens = numTokensDecoded.count;
        console.log("total tokens")

        let startAfter = "";
        let hasMore = true;
        const holderMap = {};

        while (hasMore) {
            const allTokensQuery = Buffer.from(
                JSON.stringify({
                    all_tokens: {
                        start_after: startAfter.length > 0 ? startAfter : null,
                        limit: 30
                    }
                })
            ).toString("base64");

            const allTokensInfo = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, allTokensQuery);
            const allTokensDecoded = JSON.parse(new TextDecoder().decode(allTokensInfo.data));

            if (allTokensDecoded && allTokensDecoded.tokens && allTokensDecoded.tokens.length > 0) {
                allTokensDecoded.tokens.forEach(token => {
                    const owner = token.owner;
                    if (holderMap[owner]) {
                        holderMap[owner].balance++;
                        holderMap[owner].metadataIds.push(token.metadata_uri);
                    } else {
                        holderMap[owner] = {
                            balance: 1,
                            address: owner,
                            metadataIds: [token.metadata_uri]
                        };
                    }
                });

                startAfter = allTokensDecoded.tokens[allTokensDecoded.tokens.length - 1].token_id;
                setProgress(`wallets checked: ${Object.values(holderMap).length} / ${totalTokens}`)
            } else {
                hasMore = false;
            }
        }

        Object.keys(holderMap).forEach(key => {
            holderMap[key].percentageHeld = Number((holderMap[key].balance / totalTokens * 100).toFixed(4))
        });

        const sortedHolders = Object.values(holderMap).sort((a, b) => b.balance - a.balance);

        return sortedHolders;
    }

    async getCW404TokenInfo(collectionAddress: string) {
        const infoQuery = Buffer.from(
            JSON.stringify({ token_info: {} })
        ).toString("base64");

        const contractInfo = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, infoQuery);
        const contractInfoDecoded = JSON.parse(new TextDecoder().decode(contractInfo.data));
        return contractInfoDecoded
    }

    hexStringToUint8Array(hexString: string): Uint8Array {
        if (hexString.length % 2 !== 0) {
            throw new Error('Invalid hex string');
        }
        const byteArray = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
            byteArray[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        return byteArray;
    }

    async getCW404Holders(collectionAddress: string, setProgress: React.Dispatch<React.SetStateAction<string>>) {
        const contractInfoDecoded = await this.getCW404TokenInfo(collectionAddress)
        const decimals = contractInfoDecoded.decimals

        const client = await CosmWasmClient.connect(this.endpoints.rpc);
        const queryClient = client.forceGetQueryClient();
        let startAfter: Uint8Array | undefined;

        const key = CW404_BALANCE_STARTING_KEYS.find(x => x.address == collectionAddress)
        if (key) startAfter = this.hexStringToUint8Array(key.key)

        console.log("start", startAfter)

        const balanceKeyHex = "000762616c616e6365";

        const holders = []
        let foundHolders = false
        let hasHolders = false

        while (true) {
            const state = await queryClient.wasm.getAllContractState(collectionAddress, startAfter);
            let lastModel = null
            for (const model of state.models) {
                const key = Buffer.from(model.key).toString("hex");
                if (key.startsWith(balanceKeyHex)) {
                    if (!foundHolders) {
                        console.log(collectionAddress, Buffer.from(lastModel.key).toString("hex"))
                        foundHolders = true
                    }
                    if (!hasHolders) {
                        hasHolders = true
                    }

                    try {
                        const amount = BigInt(
                            Buffer.from(model.value).toString("ascii").slice(1, -1),
                        );

                        if (amount === 0n) {
                            continue;
                        }
                        const holder = Buffer.from(
                            key.substring(balanceKeyHex.length),
                            "hex",
                        ).toString("utf8");

                        holders.push({
                            address: holder,
                            balance: amount
                        })
                        setProgress(`holders: ${holders.length}`)
                    } catch (e) {
                        console.log("error", key, Buffer.from(model.value).toString("ascii"));
                    }
                } else {
                    if (foundHolders && hasHolders) {
                        hasHolders = false
                    }
                }
                lastModel = model
            }
            startAfter = state.pagination?.nextKey;
            console.log(holders.length)
            if (!startAfter || startAfter?.length === 0) {
                break;
            }

            if (foundHolders && !hasHolders) {
                break
            }
        }

        holders.sort((a, b) => (b.balance > a.balance ? 1 : -1));
        const totalBalance = holders.reduce((sum, holder) => sum + holder.balance, 0n);
        const holdersWithPercentage = holders.map(holder => ({
            ...holder,
            balance: Number(holder.balance) / Math.pow(10, decimals),
            percentageHeld: Number(holder.balance) / Number(totalBalance) * 100
        }));

        return holdersWithPercentage;
    }


    async getPendingAstroRewards(generatorAddress: string, lpToken: string, wallet: string) {
        const pendingRewardsQuery = Buffer.from(JSON.stringify({
            pending_rewards: {
                lp_token: lpToken,
                user: wallet
            }
        })).toString(
            "base64"
        );
        const pendingRewards = await this.chainGrpcWasmApi.fetchSmartContractState(
            generatorAddress,
            pendingRewardsQuery
        );
        const infoDecoded = JSON.parse(new TextDecoder().decode(pendingRewards.data));
        return infoDecoded
    }

    async getGeneratorPoolInfo(generatorAddress: string, lpToken: string) {
        const pendingRewardsQuery = Buffer.from(JSON.stringify({
            pool_info: {
                lp_token: lpToken,
            }
        })).toString(
            "base64"
        );
        const pendingRewards = await this.chainGrpcWasmApi.fetchSmartContractState(
            generatorAddress,
            pendingRewardsQuery
        );
        const infoDecoded = JSON.parse(new TextDecoder().decode(pendingRewards.data));
        return infoDecoded
    }

    async getAstroRewardsInfo(generatorAddress: string, lpToken: string) {
        const pendingRewardsQuery = Buffer.from(JSON.stringify({
            reward_info: {
                lp_token: lpToken,
            }
        })).toString(
            "base64"
        );
        const pendingRewards = await this.chainGrpcWasmApi.fetchSmartContractState(
            generatorAddress,
            pendingRewardsQuery
        );
        const infoDecoded = JSON.parse(new TextDecoder().decode(pendingRewards.data));
        return infoDecoded
    }


    async checkForLiquidity(assetInfo: any) {
        const allPools = []
        for (const factoryAddress of this.factories) {
            for (const baseAsset of this.baseAssets) {
                console.log({
                    pair: {
                        asset_infos: [
                            assetInfo,
                            baseAsset
                        ]
                    }
                })
                const query = Buffer.from(JSON.stringify({
                    pair: {
                        asset_infos: [
                            assetInfo,
                            baseAsset
                        ]
                    }
                })).toString(
                    "base64"
                );
                try {
                    const result = await this.chainGrpcWasmApi.fetchSmartContractState(
                        factoryAddress.address,
                        query
                    );
                    const infoDecoded = JSON.parse(new TextDecoder().decode(result.data));
                    if (infoDecoded) {
                        console.log(`FOUND ON ${factoryAddress.name}`)
                    }
                    const pool = await this.getPairInfo(infoDecoded.contract_addr)
                    const price = await this.getPrice(pool)
                    if (!price) continue

                    const marketCap = await this.getMarketCap(pool)
                    const liquidity = await this.getPoolLiquidity(pool)

                    allPools.push({ infoDecoded, factory: factoryAddress, price, marketCap, liquidity })
                }
                catch (e) {
                    console.log(e)
                }
            }
        }
        return allPools
    }

    async getPoolAmounts(pair) {
        const poolQuery = Buffer.from(JSON.stringify({ pool: {} })).toString('base64');
        const poolInfo = await this.chainGrpcWasmApi.fetchSmartContractState(pair.contract_addr, poolQuery)
        const poolDecoded = JSON.parse(new TextDecoder().decode(poolInfo.data))
        return poolDecoded
    }

    async getPrice(pair) {
        const { token0Meta, token1Meta } = pair;
        const baseAsset = this.baseAssets.find(baseAsset =>
            (token0Meta.denom === baseAsset.native_token?.denom || token0Meta.denom === baseAsset.token?.contract_addr) ||
            (token1Meta.denom === baseAsset.native_token?.denom || token1Meta.denom === baseAsset.token?.contract_addr)
        );

        // Determine base and meme token meta
        const baseTokenMeta = (token0Meta.denom === baseAsset?.native_token?.denom || token0Meta.denom === baseAsset?.token?.contract_addr) ? token0Meta : token1Meta;
        const memeTokenMeta = (baseTokenMeta === token0Meta) ? token1Meta : token0Meta;

        console.log("base asset meta", baseTokenMeta)
        console.log("meme token meta", memeTokenMeta)

        const poolDecoded = await this.getPoolAmounts(pair);
        const baseAssetPriceUsd = await this.getBaseAssetPrice(baseTokenMeta);
        console.log("base asset price", baseAssetPriceUsd)

        const baseAssetAmount = poolDecoded.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === baseTokenMeta.denom;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === baseTokenMeta.denom;
            }
            return false;
        })?.amount || 0;

        const tokenAmount = poolDecoded.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === memeTokenMeta.denom;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === memeTokenMeta.denom;
            }
            return false;
        })?.amount || 0;

        if (baseAssetAmount == 0 && tokenAmount == 0) {
            return null
        }

        const ratio = (Number(baseAssetAmount) / Math.pow(10, baseTokenMeta.decimals)) / (Number(tokenAmount) / Math.pow(10, memeTokenMeta.decimals));

        return ratio * baseAssetPriceUsd;
    }

    async getPoolLiquidity(pair) {
        const { token0Meta, token1Meta } = pair;
        const baseAsset = this.baseAssets.find(baseAsset =>
            (token0Meta.denom === baseAsset.native_token?.denom || token0Meta.denom === baseAsset.token?.contract_addr) ||
            (token1Meta.denom === baseAsset.native_token?.denom || token1Meta.denom === baseAsset.token?.contract_addr)
        );

        // Determine base and meme token meta
        const baseTokenMeta = (token0Meta.denom === baseAsset?.native_token?.denom || token0Meta.denom === baseAsset?.token?.contract_addr) ? token0Meta : token1Meta;
        const memeTokenMeta = (baseTokenMeta === token0Meta) ? token1Meta : token0Meta;

        console.log("base asset meta", baseTokenMeta)
        console.log("meme token meta", memeTokenMeta)

        const poolDecoded = await this.getPoolAmounts(pair);
        const baseAssetPriceUsd = await this.getBaseAssetPrice(baseTokenMeta);
        console.log("base asset price", baseAssetPriceUsd)

        const baseAssetAmount = poolDecoded.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === baseTokenMeta.denom;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === baseTokenMeta.denom;
            }
            return false;
        })?.amount || 0;

        const tokenAmount = poolDecoded.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === memeTokenMeta.denom;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === memeTokenMeta.denom;
            }
            return false;
        })?.amount || 0;

        if (baseAssetAmount == 0 && tokenAmount == 0) {
            return null
        }

        return (Number(baseAssetAmount) / Math.pow(10, baseTokenMeta.decimals)) * baseAssetPriceUsd * 2;
    }

    async getBaseAssetPrice(baseAsset) {
        if (baseAsset.denom === 'inj') {
            return await this.getINJPrice();
        } else if (baseAsset.denom === 'inj1zdj9kqnknztl2xclm5ssv25yre09f8908d4923') { // dojo address
            return await this.getDOJOPrice();
        }
        return 1;
    }

    async getMarketCap(pair) {
        const { token0Meta, token1Meta } = pair;

        const baseAsset = this.baseAssets.find(baseAsset =>
            (token0Meta.denom === baseAsset.native_token?.denom || token0Meta.denom === baseAsset.token?.contract_addr) ||
            (token1Meta.denom === baseAsset.native_token?.denom || token1Meta.denom === baseAsset.token?.contract_addr)
        );

        const baseTokenMeta = (token0Meta.denom === baseAsset?.native_token?.denom || token0Meta.denom === baseAsset?.token?.contract_addr) ? token0Meta : token1Meta;
        const memeTokenMeta = (baseTokenMeta === token0Meta) ? token1Meta : token0Meta;

        const price = await this.getPrice(pair);
        let supply = 0;

        if (!memeTokenMeta.total_supply) {
            supply = await this.chainGrpcBankApi.fetchSupplyOf(memeTokenMeta.denom);
            supply = supply.amount;
        } else {
            supply = memeTokenMeta.total_supply;
        }

        const marketCap = (Number(supply) / Math.pow(10, memeTokenMeta.decimals)) * price;
        return marketCap;
    }

    async fetchSpotMarkets() {
        const markets = await this.indexerGrpcSpotApi.fetchMarkets()
        return markets
    }

    async fetchMitoVaults() {
        let endpoint = "";
        if (this.endpoints.chainId.includes("888")) {
            endpoint = 'https://k8s.testnet.mito.grpc-web.injective.network';
        } else {
            endpoint = 'https://k8s.mainnet.mito.grpc-web.injective.network';
        }
        this.mitoApi = new IndexerGrpcMitoApi(endpoint);

        const limit = 100;
        let pageIndex = 0;
        let totalVaults = [];
        let total = 0;

        do {
            const response = await this.mitoApi.fetchVaults({
                limit: limit,
                pageIndex: pageIndex
            });

            if (!response.vaults || response.vaults.length === 0) {
                break;
            }

            totalVaults = totalVaults.concat(response.vaults);
            total = response.pagination.total;
            pageIndex += 1;

        } while (totalVaults.length < total);
        return totalVaults;
    }

    async fetchMitoVaultCreationFee() {
        const { denomCreationFee } = await this.chainGrpcTokenFactoryApi.fetchModuleParams();
        const [fee] = denomCreationFee;

        let mitoMasterContract = ""
        if (this.endpoints.chainId.includes("888")) {
            mitoMasterContract = "inj174efvalr8d9muguudh9uyd7ah7zdukqs9w4adq"
        } else {
            mitoMasterContract = 'inj1vcqkkvqs7prqu70dpddfj7kqeqfdz5gg662qs3';
        }
        const query = Buffer.from(JSON.stringify({ config: {} })).toString('base64');
        const info = await this.chainGrpcWasmApi.fetchSmartContractState(mitoMasterContract, query)
        const config = JSON.parse(new TextDecoder().decode(info.data))

        const permissionlessVaultRegistrationFee = config.permissionless_vault_registration_fee.find(
            ({ denom }) => denom === 'inj'
        );

        return ((Number(permissionlessVaultRegistrationFee?.amount) || 0) + (Number(fee?.amount) || 0)) / Math.pow(10, 18);
    }

    async getINJDerivativesPrice() {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const indexerGrpcOracleApi = new IndexerGrpcOracleApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchMarkets()

        const market = markets.reverse().find((market) => market.ticker === 'INJ/USDT PERP')
        const baseSymbol = market.oracleBase
        const quoteSymbol = market.oracleQuote
        const oracleType = market.oracleType

        const oraclePrice = await indexerGrpcOracleApi.fetchOraclePriceNoThrow({
            baseSymbol,
            quoteSymbol,
            oracleType,
        })

        return oraclePrice['price']
    }

    async getBalances(wallet) {
        const balances = await this.indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(wallet);
        console.log(balances)
        const balancesWithMetadata = [];

        for (const token of balances.bankBalancesList) {
            if (Number(token.amount) == 0 || token.denom.includes("ibc") || token.denom.includes("peggy") || token.denom == "inj") continue
            try {
                if (token.denom.includes("inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk")) {
                    const cw20Address = token.denom.split("/")[2]
                    console.log("CW 20 ADDRESS", cw20Address)
                    const info = await this.getTokenInfo(cw20Address);
                    const marketing = await this.getTokenMarketing(cw20Address);
                    const metadata = { ...info, ...marketing }
                    balancesWithMetadata.push({ token, metadata });
                }
                else {
                    const metadata = await this.getDenomExtraMetadata(token.denom);
                    balancesWithMetadata.push({ token, metadata });
                }
            } catch (e) {
                console.log("failed to get token metadata", token, e);
                balancesWithMetadata.push(token);
            }
        }



        return balancesWithMetadata;
    }

    async fetchBinaryOptionMarkets(status) {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const key = ''
        const markets = await marketsAPI.fetchBinaryOptionsMarkets({
            marketStatus: status,
            pagination: { limit: 20 }
        })
        console.log(markets.pagination)
        return markets.markets
    }

    async fetchBinaryOptionMarket(marketId) {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchBinaryOptionsMarket(marketId)
        return markets
    }

    async getDerivativeMarketOrders(marketId) {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const orders = await marketsAPI.fetchOrderHistory({
            marketId: marketId
        })
        console.log(orders)
        return orders.orderHistory
    }

    async createBinaryOptionsLimitOrder(marketId) {

    }

    async fetchOracleList() {
        const indexerGrpcOracleApi = new IndexerGrpcOracleApi(this.endpoints.indexer)

        const oracleList = await indexerGrpcOracleApi.fetchOracleList()
        console.log(oracleList)

        return oracleList
    }

    async fetchOraclePrice(ticker) {
        const indexerGrpcOracleApi = new IndexerGrpcOracleApi(this.endpoints.indexer)

        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchMarkets()

        const market = markets.reverse().find((market) => market.ticker === ticker)
        if (!market) {
            console.log("cannot find market with ticker", ticker)
            return
        }
        const baseSymbol = market.oracleBase
        const quoteSymbol = market.oracleQuote
        const oracleType = market.oracleType

        const oraclePrice = await indexerGrpcOracleApi.fetchOraclePriceNoThrow({
            baseSymbol,
            quoteSymbol,
            oracleType,
        })
        console.log(oraclePrice)

        return oraclePrice['price']
    }

    async fetchWithRetry(url, options, maxRetries = 10, retryDelay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                if (attempt < maxRetries) {
                    // console.warn(`Attempt ${attempt} failed. Retrying in ${retryDelay}ms...`, error);
                    await new Promise(res => setTimeout(res, retryDelay));
                } else {
                    throw error;
                }
            }
        }
    }

    async fetchProposalVoters(proposalId, blockNumber, setProgress) {
        const lcdBase = `https://sentry.lcd.injective.network/cosmos/gov/v1/proposals/${proposalId}/votes`;
        let voters = [];
        let nextKey = null;
        const maxRetries = 100; // Set the maximum number of retries

        let total = 0

        try {
            do {
                const encodedNextKey = nextKey ? encodeURIComponent(nextKey) : null;
                const lcd = encodedNextKey ? `${lcdBase}?pagination.key=${encodedNextKey}` : lcdBase;
                console.log(lcd);

                const data = await this.fetchWithRetry(lcd, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-cosmos-block-height': blockNumber
                    }
                }, maxRetries);

                voters = voters.concat(data.votes);
                console.log(data);

                nextKey = data.pagination ? data.pagination.next_key : null;
                if (data.pagination.total && data.pagination.total != "0") total = data.pagination.total
                console.log(nextKey);
                setProgress(`${voters.length} / ${total}`)
            } while (nextKey);

            return voters.map(item => {
                return {
                    address: item.voter,
                    vote_option: item.options[0].option,
                    weight: parseFloat(item.options[0].weight)
                };
            });
        } catch (error) {
            // console.error('Error:', error);
        }
        return voters.map(item => {
            return {
                address: item.voter,
                vote_option: item.options[0].option,
                weight: parseFloat(item.options[0].weight)
            };
        })
    }

    async getSubAccount(injectiveAddress: string) {
        const indexerGrpcAccountApi = new IndexerGrpcAccountApi(this.endpoints.indexer)
        const subaccountsList = await indexerGrpcAccountApi.fetchSubaccountsList(
            injectiveAddress,
        )

        console.log(subaccountsList)
        return subaccountsList
    }
}

export default TokenUtils;
