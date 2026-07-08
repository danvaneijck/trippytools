 
/* eslint-disable @typescript-eslint/restrict-template-expressions */
 
 
 
 
import {
    ChainGrpcWasmApi,
    ChainGrpcBankApi,
    ChainGrpcErc20Api,
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
    IndexerGrpcAccountApi,
    getEthereumAddress,
    spotPriceToChainPriceToFixed,
    spotQuantityToChainQuantityToFixed,
    getSpotMarketTensMultiplier,
    MsgCreateSpotMarketOrder,
    MsgExecuteContract,
    MsgExecuteContractCompat,
} from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";
import dayjs from "dayjs";
import { TokenInfo } from "../constants/types";
import { Coin } from "@injectivelabs/ts-types";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CW404_BALANCE_STARTING_KEYS } from "../constants/cw404BalanceKeys";

const DOJO_ROUTER = "inj1t6g03pmc0qcgr7z44qjzaen804f924xke6menl"


interface EndpointConfig {
    grpc: string;
    explorer: string;
    indexer: string;
    rpc?: string;
    rest?: string;
    chainId?: string;
    explorerUrl?: string;
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
    chainGrpcErc20Api: ChainGrpcErc20Api;
    indexerRestExplorerApi: IndexerRestExplorerApi;
    indexerGrpcAccountPortfolioApi: IndexerGrpcAccountPortfolioApi;
    chainGrpcTokenFactoryApi: ChainGrpcTokenFactoryApi;
    baseAssets: ({ native_token: { denom: string; }; token?: undefined; } | { token: { contract_addr: string; }; native_token?: undefined; })[];
    factories: { name: string; address: string; }[];
    baseDenom: any;
    dojoAssetInfo: { token: { contract_addr: string; }; };
    injAssetInfo: { native_token: { denom: string; }; };
    indexerGrpcSpotApi: IndexerGrpcSpotApi;
    coinhallRouter: string;

    constructor(endpoints: EndpointConfig) {
        this.endpoints = endpoints;
        this.RPC = endpoints.grpc;

        this.chainGrpcWasmApi = new ChainGrpcWasmApi(this.RPC);
        this.chainGrpcBankApi = new ChainGrpcBankApi(this.RPC);
        this.chainGrpcErc20Api = new ChainGrpcErc20Api(this.RPC);
        this.indexerRestExplorerApi = new IndexerRestExplorerApi(
            this.endpoints.explorer
        );
        this.chainGrpcTokenFactoryApi = new ChainGrpcTokenFactoryApi(this.RPC)

        this.indexerGrpcAccountPortfolioApi =
            new IndexerGrpcAccountPortfolioApi(endpoints.indexer);

        this.indexerGrpcSpotApi = new IndexerGrpcSpotApi(endpoints.indexer)

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
            this.injAssetInfo
        ]
        this.factories = [
            {
                name: "DojoSwap",
                address: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk"
            },
            {
                name: "Astroport",
                address: "inj19aenkaj6qhymmt746av8ck4r8euthq3zmxr2r6"
            },
            {
                name: "Choice Exchange",
                address: "inj1k9lcqtn3y92h4t3tdsu7z8qx292mhxhgsssmxg"
            }
        ]

        this.coinhallRouter = "inj16lkekzp36vj6a9zjl778a2s5nd9f6ft67w2e90"
    }

    async getTx(txHash: string) {
        return await this.indexerRestExplorerApi.fetchTransaction(txHash)
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

    async getBuyQuoteRouter(pair: any, amount: any) {
        const pairName = `${pair.token0Meta.symbol}, ${pair.token1Meta.symbol}`;

        try {
            if (!pair || !pair.asset_infos || !Array.isArray(pair.asset_infos)) {
                throw new Error(`Invalid pair or asset_infos for getBuyQuoteFromRouter DojoSwap: ${pair}`);
            }

            const assetToBuy = pair.asset_infos.findIndex((assetInfo: any) => {
                const isNativeToken = assetInfo.native_token && assetInfo.native_token.denom !== 'inj';
                const isCW20Token = assetInfo.token && assetInfo.token.contract_addr !== 'inj';
                return isNativeToken || isCW20Token;
            });

            if (assetToBuy === -1) {
                throw new Error(`Error finding ask asset for ${pairName}`);
            }
            const assetInfo = pair.asset_infos[assetToBuy];

            const simulationQuery = {
                simulate_swap_operations: {
                    offer_amount: amount.toString(),
                    operations: [
                        {
                            dojo_swap: {
                                offer_asset_info: {
                                    native_token: {
                                        denom: 'inj'
                                    }
                                },
                                ask_asset_info: assetInfo
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
            console.error(`Error getting DojoSwap buy quote for ${pairName}: ${error}`);
            return null;
        }
    }

    async getSellQuoteRouter(pair: any, amount: any) {
        const pairName = `${pair.token0Meta.symbol}, ${pair.token1Meta.symbol}`;

        try {
            if (!pair || !pair.asset_infos || !Array.isArray(pair.asset_infos)) {
                throw new Error(`Invalid pair or asset_infos for getSellQuoteFromRouter DojoSwap: ${pair}`);
            }

            const assetToSell = pair.asset_infos.findIndex((assetInfo: any) => {
                const isNativeToken = assetInfo.native_token && assetInfo.native_token.denom !== 'inj';
                const isCW20Token = assetInfo.token && assetInfo.token.contract_addr !== 'inj';
                return isNativeToken || isCW20Token;
            });

            if (assetToSell === -1) {
                throw new Error(`Error finding offer asset for ${pairName}`);
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

    /**
     * Look up the ERC-20 address a tokenfactory denom is paired with on the
     * native EVM, or null if it hasn't been paired. Used to show MultiVM
     * status in the manage view and to gate the "Pair ERC-20" action.
     */
    async getErc20Pair(denom: string): Promise<string | null> {
        try {
            const pair = await this.chainGrpcErc20Api.fetchTokenPairByDenom(denom);
            return pair?.erc20Address ?? null;
        } catch {
            // No pair registered (the query 404s) — treat as unpaired.
            return null;
        }
    }

    /**
     * Reverse of getErc20Pair: given an ERC-20 (0x) address, return the bank
     * denom it's paired with, or null. Lets the holder/liquidity tools accept a
     * pasted EVM token address.
     */
    async getErc20PairBankDenom(erc20Address: string): Promise<string | null> {
        try {
            const pair = await this.chainGrpcErc20Api.fetchTokenPairByErc20Address(erc20Address);
            return pair?.bankDenom ?? null;
        } catch {
            return null;
        }
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

    async getDenomMetadata(denom: any) {
        if (denom == "inj") {
            return {
                decimals: 18
            }
        }
        if (denom.includes("peggy") || denom.includes("ibc")) {
            return {}
        }
        try {
            const token = await this.chainGrpcBankApi.fetchDenomMetadata(denom)
            return token;
        } catch (error) {
            console.error('Error fetching token info:', error);
            return {}
        }
    }

    async getDenomExtraMetadata(denom: string) {
        console.log("get extra meta")

        if (denom === "inj") {
            return {
                name: "Injective",
                denom: "inj",
                symbol: "INJ",
                decimals: 18,
            }
        }
        try {

            const data = await this.chainGrpcBankApi.fetchDenomMetadata(denom);
            const matchingDenomUnit = data.denomUnits.find(
                (unit) => unit.denom === data.display
            );

            let decimals = matchingDenomUnit ? matchingDenomUnit.exponent : 0
            if (data.decimals !== 0 && decimals == 0) decimals = data.decimals

            const supply = await this.chainGrpcBankApi.fetchSupplyOf(denom);
            const admin = await this.chainGrpcTokenFactoryApi.fetchDenomAuthorityMetadata(denom.split("/")[1], denom.split("/")[2])

            const tokenInfo: TokenInfo = {
                name: data.name,
                denom: denom,
                symbol: data.symbol,
                decimals: decimals,
                total_supply: Number(supply.amount),
                description: data.description,
                logo: data.uri,
                admin: admin.admin,
                denomUnits: data.denomUnits as []
            };


            return tokenInfo;
        } catch (error) {
            console.error('Error fetching denom extra metadata:', error);
            return {}
        }

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
                            ) as unknown as ChainGrpcWasmApiResponse;
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

            nextPage = response.pagination!.next;
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
            const decimals = (info as any).decimals

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
        ignoredAddresses: string[],
        allTransactions: ExplorerTransaction[],
        max: number,
        minPerWallet: number,
        maxPerWallet: number,
        denom: string
    ) {
        const preSaleAmounts = new Map();

        console.log(ignoredAddresses)

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
            const blockTimestamp = dayjs(
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
                }
                else if (message.type == "/cosmos.bank.v1beta1.MsgSend") {
                    amount = message.message.amount
                        ? message.message.amount[0].denom == denom
                            ? message.message.amount[0].amount
                            : null
                        : null;
                    sender = message.message["from_address"];
                    recipient = message.message["to_address"];
                }
                else if (message.type == "/cosmos.bank.v1beta1.MsgMultiSend") {
                    if (message.message.inputs.length == 1) {
                        sender = message.message.inputs[0].address
                        if (sender === address) {
                            message.message.outputs.map((output: any) => {
                                if (output.coins.length == 1 && output.coins[0].denom == "inj") {
                                    const recipient = output.address
                                    const amount = output.coins[0].amount
                                    const participant = recipient;
                                    if (preSaleAmounts.has(participant)) {
                                        const entry = preSaleAmounts.get(participant);
                                        if (entry) {
                                            const amountRefunded =
                                                (!isNaN(Number(entry.amountRefunded)) ? Number(entry.amountRefunded) : 0) +
                                                Number(amount);

                                            // NOTE: Number() never returns null/undefined, so the
                                            // original `?? 0 - amountRefunded` fallback was dead code
                                            // and never ran. Preserved as-is (= Number(entry.toRefund)).
                                            let toRefund = Number(entry.toRefund);

                                            if (toRefund < 0) toRefund = 0;

                                            preSaleAmounts.set(participant, {
                                                ...entry,
                                                address: participant,
                                                amountRefunded: amountRefunded,
                                                contribution: entry.contribution ?? 0,
                                                toRefund: toRefund,
                                            });
                                        }
                                    }
                                }
                            })
                        }
                    }
                }
                else {
                    // sending out the memes
                    return;
                }

                if (ignoredAddresses.includes(recipient) || ignoredAddresses.includes(sender)) {
                    const ignoredAddress = ignoredAddresses.includes(recipient) ? recipient : sender;
                    console.log("Ignoring tx from address:", ignoredAddress);
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
                    const entry = preSaleAmounts.get(sender);
                    const totalSent =
                        Number(amount) +
                        (entry ? Number(entry.amountSent ?? 0) : 0);
                    let toRefund = 0;

                    if (totalSent > maxContribution) {
                        toRefund = totalSent - maxContribution;
                    } else if (totalSent < minContribution) {
                        toRefund = Number(amount);
                    }

                    toRefund -= entry && !isNaN(Number(entry.amountRefunded)) ? Number(entry.amountRefunded) : 0;
                    if (toRefund < 0) toRefund = 0;

                    preSaleAmounts.set(sender, {
                        ...entry,
                        timeSent: blockTimestamp.format(),
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
                    const entry = preSaleAmounts.get(sender);

                    if (entry) {
                        totalSent += Number(entry.amountSent ?? 0);
                        toRefund += Number(entry.toRefund ?? 0);
                        toRefund -= Number(entry.amountRefunded ?? 0);
                    }

                    if (toRefund < 0) toRefund = 0;

                    preSaleAmounts.set(sender, {
                        ...entry,
                        timeSent: blockTimestamp.format(),
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

                        if (preSaleAmounts.has(participant)) {
                            const entry = preSaleAmounts.get(participant);
                            if (entry) {
                                const amountRefunded =
                                    (!isNaN(Number(entry.amountRefunded)) ? Number(entry.amountRefunded) : 0) +
                                    Number(amount);

                                // NOTE: dead `?? 0 - amountRefunded` fallback removed (Number()
                                // is never nullish so it never ran); behavior unchanged.
                                let toRefund = Number(entry.toRefund);
                                if (toRefund < 0) toRefund = 0;

                                preSaleAmounts.set(participant, {
                                    ...entry,
                                    // timeSent: blockTimestamp.format(),
                                    address: participant,
                                    amountRefunded: amountRefunded,
                                    contribution: entry.contribution ?? 0,
                                    toRefund: toRefund,
                                });
                            }
                        }
                    } else {
                        if (preSaleAmounts.has(sender)) {
                            const entry = preSaleAmounts.get(sender);
                            if (entry) {
                                // `?? 0` was dead (Number() never nullish); behavior unchanged.
                                const totalSent =
                                    Number(amount) +
                                    Number(entry.amountSent);

                                let toRefund = 0;

                                if (!withinMaxCap) {
                                    toRefund += Number(amount);
                                }

                                if (totalSent > maxContribution) {
                                    toRefund =
                                        Number(totalSent) -
                                        Number(maxContribution);
                                }
                                else if (totalSent < minContribution) {
                                    toRefund = Number(amount);
                                }

                                toRefund -= entry.amountRefunded
                                    ? Number(entry.amountRefunded)
                                    : 0;

                                if (toRefund < 0) toRefund = 0

                                // if (sender == "inj18xsczx27lanjt40y9v79q0v57d76j2s8ctj85x") {
                                //     console.log("HERE BITCH", totalSent - toRefund)
                                // }

                                preSaleAmounts.set(sender, {
                                    ...entry,
                                    timeSent: blockTimestamp.format(),
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

                            preSaleAmounts.set(sender, {
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
        console.log("max cap hit: ", maxCapHit, "block number: ", maxCapBlock);

        preSaleAmounts.forEach((value, key) => {
            const amountSentFormatted =
                !isNaN(Number(value?.amountSent)) ? Number(value.amountSent) / Math.pow(10, 18) : 0;
            const totalContributionFormatted =
                !isNaN(Number(value?.contribution)) ? Number(value.contribution) / Math.pow(10, 18) : 0;
            const toRefundFormatted =
                !isNaN(Number(value?.toRefund)) ? Number(value.toRefund) / Math.pow(10, 18) : 0;
            const amountRefundedFormatted =
                !isNaN(Number(value?.amountRefunded)) ? Number(value.amountRefunded) / Math.pow(10, 18) : 0;

            preSaleAmounts.set(key, {
                ...value,
                amountSentFormatted: amountSentFormatted,
                totalContributionFormatted: totalContributionFormatted,
                toRefundFormatted: toRefundFormatted,
                amountRefundedFormatted: amountRefundedFormatted,
            });
        });

        return {
            preSaleAmounts,
            totalAmountReceived
        };
    }

    calculatePercentageOfPercentage(x: number) {
        if (x < 1 || x > 10000000) {
            return "x is out of the expected range (1 to 10,000,000)";
        }

        const xAsPercentageOfTotal = (x / 10000000) * 100;

        const percentageOf25 = xAsPercentageOfTotal * 0.25;

        return percentageOf25;
    }

    async getMultiplier(presaleWallet: string, multiplierToken: string, preSaleAmounts: any) {
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

                            if (preSaleAmounts.has(sender)) {
                                const entry = preSaleAmounts.get(sender);
                                if (entry) {
                                    const a = entry.multiplierTokensSent ?? 0;
                                    preSaleAmounts.set(sender, {
                                        ...entry,
                                        multiplierTokensSent:
                                            Number(amount / Math.pow(10, 18)) +
                                            Number(a),
                                    });
                                }
                            } else {
                                preSaleAmounts.set(sender, {
                                    multiplierTokensSent: 0,
                                });
                            }
                        }
                    }
                }
            });
        });

        preSaleAmounts.forEach((entry: any, address: any) => {
            if (!entry.multiplierTokensSent) {
                preSaleAmounts.set(address, {
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

            preSaleAmounts.set(address, {
                ...entry,
                multiplier: multi,
                adjustedContribution:
                    Number(entry.contribution) +
                    multi * Number(entry.contribution ?? 0),
            });
        });

        let total = 0;
        preSaleAmounts.forEach((entry: any) => {
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
        devAllocation: number,
        preSaleAmounts: any
    ) {
        let amountToDrop =
            totalSupply * Math.pow(10, decimals) * percentToAirdrop;
        const forDev = totalSupply * Math.pow(10, decimals) * devAllocation;
        amountToDrop -= forDev;
        console.log(`total raised INJ: ${totalContribution}`);

        const dropAmounts = new Map();

        Array.from(preSaleAmounts.values()).forEach((entry: any) => {
            if (entry.address) {
                if (!entry.contribution || entry.contribution <= 0) return;

                const sender = entry.address;
                const percentOfSupply =
                    Number(entry.adjustedContribution) /
                    Number(totalAdjustedContribution);
                const numberForUser = amountToDrop * percentOfSupply;

                preSaleAmounts.set(entry.address, {
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
        preSaleAmounts.forEach((entry: any) => {
            if (entry.adjustedContribution)
                total += Number(entry.adjustedContribution);
        });
        console.log("total adjusted contribution", total);
        return preSaleAmounts;
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
                    if ((error as any).message.includes("Error parsing into type cw404")) {
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

    async fetchOwnersInBatches(tokensNeedingOwners: any, collectionAddress: any, batchSize = 5, delay = 500, maxRetries = 3) {
        const ownerResults = [];

        const fetchWithRetry = async (tokenId: any, retries = maxRetries) => {
            const ownerQuery = Buffer.from(
                JSON.stringify({
                    owner_of: { token_id: tokenId }
                })
            ).toString("base64");

            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const response = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, ownerQuery);
                    return { tokenId, ownerInfo: JSON.parse(new TextDecoder().decode(response.data)) };
                } catch (error) {
                    if (attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
                    } else {
                        return { tokenId, error };
                    }
                }
            }
        };

        for (let i = 0; i < tokensNeedingOwners.length; i += batchSize) {
            const batch = tokensNeedingOwners.slice(i, i + batchSize);
            const ownerQueries = batch.map((tokenId: any) => fetchWithRetry(tokenId));
            const results = await Promise.all(ownerQueries);
            ownerResults.push(...results);
            if (i + batchSize < tokensNeedingOwners.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return ownerResults;
    }

    // Smart-query a contract with retry + exponential backoff. Enumerating a
    // large collection's holders is hundreds of sequential paginated queries
    // (a 6,666-supply collection = ~223 pages over a couple of minutes); the
    // public gRPC-web endpoint intermittently rate-limits or drops a request
    // over such a long run. Without a retry a single blip aborts the whole
    // airdrop with an error — so every page/count query goes through here.
    async smartQueryWithRetry(
        collectionAddress: string,
        msg: object,
        retries = 4,
        delay = 600,
    ): Promise<any> {
        const query = Buffer.from(JSON.stringify(msg)).toString("base64");
        let lastErr: unknown;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, query);
                return JSON.parse(new TextDecoder().decode(res.data));
            } catch (error) {
                lastErr = error;
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
                }
            }
        }
        throw lastErr;
    }

    async getNFTHolders(collectionAddress: string, setProgress: React.Dispatch<React.SetStateAction<string>>) {
        const numTokensDecoded = await this.smartQueryWithRetry(collectionAddress, { num_tokens: {} });
        const totalTokens = numTokensDecoded.count;
        console.log("total NFT tokens", numTokensDecoded);

        let startAfter = "";
        let hasMore = true;
        const holderMap: Record<string, any> = {};

        while (hasMore) {
            const allTokensDecoded = await this.smartQueryWithRetry(collectionAddress, {
                all_tokens: {
                    start_after: startAfter.length > 0 ? startAfter : null,
                    limit: 30,
                },
            });

            if (allTokensDecoded && allTokensDecoded.tokens && allTokensDecoded.tokens.length > 0) {
                // Tokens that need an owner lookup
                const tokensNeedingOwners = [];

                for (const token of allTokensDecoded.tokens) {
                    if (token.owner) {
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
                    } else {
                        tokensNeedingOwners.push(token.token_id || token);
                    }
                }

                // Execute all owner fetches in parallel
                const ownerResults = await this.fetchOwnersInBatches(tokensNeedingOwners, collectionAddress);

                // Process the fetched owners
                ownerResults.forEach(({ tokenId, ownerInfo }) => {
                    if (ownerInfo && ownerInfo.owner) {
                        const owner = ownerInfo.owner;
                        if (holderMap[owner]) {
                            holderMap[owner].balance++;
                            holderMap[owner].metadataIds.push(tokenId);
                        } else {
                            holderMap[owner] = {
                                balance: 1,
                                address: owner,
                                metadataIds: [tokenId]
                            };
                        }
                    }
                });

                console.log(holderMap)

                startAfter = allTokensDecoded.tokens[allTokensDecoded.tokens.length - 1].token_id ?? allTokensDecoded.tokens[allTokensDecoded.tokens.length - 1];
                setProgress(`wallets checked: ${Object.values(holderMap).reduce((sum, obj) => sum + obj.balance, 0)} / ${totalTokens}`);
            } else {
                hasMore = false;
            }
        }

        Object.keys(holderMap).forEach(key => {
            holderMap[key].percentageHeld = Number((holderMap[key].balance / totalTokens * 100).toFixed(4));
        });

        const sortedHolders = Object.values(holderMap).sort((a, b) => b.balance - a.balance);

        return sortedHolders;
    }

    // Resolve an `ipfs://` URI to a public gateway URL; pass through http(s).
    resolveIpfsUri(uri: string): string {
        if (!uri) return uri;
        if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
        return uri;
    }

    // Best-effort image + name for a single CW721 token. NFT metadata may sit
    // on-chain (extension) or off-chain behind token_uri; Talis tokens store
    // the picture under `media` rather than the cw721-metadata `image` field.
    async resolveNftMetadata(collectionAddress: string, tokenId: string) {
        try {
            const infoQuery = Buffer.from(
                JSON.stringify({ nft_info: { token_id: tokenId } }),
            ).toString("base64");
            const res = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, infoQuery);
            const info = JSON.parse(new TextDecoder().decode(res.data));
            const ext = info?.extension ?? {};
            let image: string | null = ext.image ?? ext.image_uri ?? ext.media ?? null;
            let name: string | null = ext.name ?? null;
            const tokenUri: string | undefined = info?.token_uri;

            if (!image && tokenUri) {
                if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(tokenUri)) {
                    image = tokenUri;
                } else {
                    // token_uri points at a metadata JSON — fetch it for the picture.
                    try {
                        const meta = await fetch(this.resolveIpfsUri(tokenUri)).then((r) => r.json());
                        image = meta.image ?? meta.media ?? meta.image_uri ?? meta.animation_url ?? null;
                        name = name ?? meta.name ?? meta.title ?? null;
                    } catch {
                        // ignore — selection works without a thumbnail
                    }
                }
            }
            return { tokenId, name, image: image ? this.resolveIpfsUri(image) : null };
        } catch {
            return { tokenId, name: null, image: null as string | null };
        }
    }

    // Token IDs of a CW721 collection held by `owner`, with display metadata.
    // Handles both the standard `{ tokens: [...] }` and the Talis `{ ids: [...] }`
    // response shapes, and items returned as bare strings or `{ token_id }`.
    async getOwnedNFTs(
        collectionAddress: string,
        owner: string,
        setProgress: React.Dispatch<React.SetStateAction<string>>,
    ): Promise<{ tokenId: string; name: string | null; image: string | null }[]> {
        const limit = 50;
        const tokenIds: string[] = [];
        let startAfter: string | null = null;
        let prevLast: string | null = null;

        // 1. Page through the wallet's tokens.
        while (true) {
            const query = Buffer.from(
                JSON.stringify({ tokens: { owner, start_after: startAfter, limit } }),
            ).toString("base64");
            const res = await this.chainGrpcWasmApi.fetchSmartContractState(collectionAddress, query);
            const decoded = JSON.parse(new TextDecoder().decode(res.data));
            const page: any[] = decoded.ids ?? decoded.tokens ?? [];
            const ids = page.map((t) => (typeof t === "string" ? t : t.token_id ?? t.id)).filter(Boolean);
            if (ids.length === 0) break;
            tokenIds.push(...ids);
            setProgress(`NFTs found: ${tokenIds.length}`);
            const last = ids[ids.length - 1];
            if (last === prevLast) break; // contract ignored start_after — stop rather than loop
            prevLast = last;
            startAfter = last;
        }

        if (tokenIds.length === 0) return [];

        // 2. Resolve thumbnails / names in small parallel batches (best-effort).
        const batchSize = 8;
        const out: { tokenId: string; name: string | null; image: string | null }[] = [];
        for (let i = 0; i < tokenIds.length; i += batchSize) {
            const batch = tokenIds.slice(i, i + batchSize);
            const resolved = await Promise.all(
                batch.map((id) => this.resolveNftMetadata(collectionAddress, id)),
            );
            out.push(...resolved);
            setProgress(`loading metadata: ${Math.min(i + batchSize, tokenIds.length)} / ${tokenIds.length}`);
        }
        return out;
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

        const client = await CosmWasmClient.connect(this.endpoints.rpc!);
        const queryClient = (client as any).forceGetQueryClient();
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
            let lastModel: any = null
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
                    } catch {
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
                catch {
                    // console.log(e)
                }
            }
        }
        return allPools
    }

    async getPoolAmounts(address: any) {
        const poolQuery = Buffer.from(JSON.stringify({ pool: {} })).toString('base64');
        const poolInfo = await this.chainGrpcWasmApi.fetchSmartContractState(address, poolQuery)
        const poolDecoded = JSON.parse(new TextDecoder().decode(poolInfo.data))
        return poolDecoded
    }

    async getPrice(pair: any) {
        const { token0Meta, token1Meta } = pair;
        const baseAsset = this.baseAssets.find(baseAsset =>
            (token0Meta.denom === baseAsset.native_token?.denom || token0Meta.denom === baseAsset.token?.contract_addr) ||
            (token1Meta.denom === baseAsset.native_token?.denom || token1Meta.denom === baseAsset.token?.contract_addr)
        );

        // Determine base and meme token meta
        const baseTokenMeta = (token0Meta.denom === baseAsset?.native_token?.denom || token0Meta.denom === baseAsset?.token?.contract_addr) ? token0Meta : token1Meta;
        const memeTokenMeta = (baseTokenMeta === token0Meta) ? token1Meta : token0Meta;

        // console.log("base asset meta", baseTokenMeta)
        // console.log("meme token meta", memeTokenMeta)

        const poolDecoded = await this.getPoolAmounts(pair.contract_addr);
        const baseAssetPriceUsd = await this.getBaseAssetPrice(baseTokenMeta);
        // console.log("base asset price", baseAssetPriceUsd)

        const baseAssetAmount = poolDecoded.assets.find((asset: any) => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === baseTokenMeta.denom;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === baseTokenMeta.denom;
            }
            return false;
        })?.amount || 0;

        const tokenAmount = poolDecoded.assets.find((asset: any) => {
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

        return ratio * baseAssetPriceUsd!;
    }

    async getPoolLiquidity(pair: any) {
        const { token0Meta, token1Meta } = pair;
        const baseAsset = this.baseAssets.find(baseAsset =>
            (token0Meta.denom === baseAsset.native_token?.denom || token0Meta.denom === baseAsset.token?.contract_addr) ||
            (token1Meta.denom === baseAsset.native_token?.denom || token1Meta.denom === baseAsset.token?.contract_addr)
        );

        // Determine base and meme token meta
        const baseTokenMeta = (token0Meta.denom === baseAsset?.native_token?.denom || token0Meta.denom === baseAsset?.token?.contract_addr) ? token0Meta : token1Meta;
        const memeTokenMeta = (baseTokenMeta === token0Meta) ? token1Meta : token0Meta;

        // console.log("base asset meta", baseTokenMeta)
        // console.log("meme token meta", memeTokenMeta)

        const poolDecoded = await this.getPoolAmounts(pair.contract_addr);
        const baseAssetPriceUsd = await this.getBaseAssetPrice(baseTokenMeta);
        // console.log("base asset price", baseAssetPriceUsd)

        const baseAssetAmount = poolDecoded.assets.find((asset: any) => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === baseTokenMeta.denom;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === baseTokenMeta.denom;
            }
            return false;
        })?.amount || 0;

        const tokenAmount = poolDecoded.assets.find((asset: any) => {
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

        return (Number(baseAssetAmount) / Math.pow(10, baseTokenMeta.decimals)) * baseAssetPriceUsd! * 2;
    }

    async getBaseAssetPrice(baseAsset: any) {
        if (baseAsset.denom === 'inj') {
            return await this.getINJPrice();
        } else if (baseAsset.denom === 'inj1zdj9kqnknztl2xclm5ssv25yre09f8908d4923') { // dojo address
            return await this.getDOJOPrice();
        }
        return 1;
    }

    async getMarketCap(pair: any) {
        const { token0Meta, token1Meta } = pair;

        const baseAsset = this.baseAssets.find(baseAsset =>
            (token0Meta.denom === baseAsset.native_token?.denom || token0Meta.denom === baseAsset.token?.contract_addr) ||
            (token1Meta.denom === baseAsset.native_token?.denom || token1Meta.denom === baseAsset.token?.contract_addr)
        );

        const baseTokenMeta = (token0Meta.denom === baseAsset?.native_token?.denom || token0Meta.denom === baseAsset?.token?.contract_addr) ? token0Meta : token1Meta;
        const memeTokenMeta = (baseTokenMeta === token0Meta) ? token1Meta : token0Meta;

        const price = await this.getPrice(pair);
        let supply: any;

        if (!memeTokenMeta.total_supply) {
            supply = await this.chainGrpcBankApi.fetchSupplyOf(memeTokenMeta.denom);
            supply = supply.amount;
        } else {
            supply = memeTokenMeta.total_supply;
        }

        const marketCap = (Number(supply) / Math.pow(10, memeTokenMeta.decimals)) * price!;
        return marketCap;
    }

    async fetchSpotMarkets() {
        const markets = await this.indexerGrpcSpotApi.fetchMarkets()
        return markets
    }

    async fetchMitoVault(address: any) {
        const endpoint = this.endpoints.chainId!.includes("888")
            ? 'https://k8s.testnet.mito.grpc-web.injective.network'
            : 'https://k8s.mainnet.mito.grpc-web.injective.network';
        const mitoApi = new IndexerGrpcMitoApi(endpoint);

        const vault = await mitoApi.fetchVault({ contractAddress: address })

        console.log(vault)
        return vault
    }

    async fetchMitoVaults() {
        const endpoint = this.endpoints.chainId!.includes("888")
            ? 'https://k8s.testnet.mito.grpc-web.injective.network'
            : 'https://k8s.mainnet.mito.grpc-web.injective.network';
        const mitoApi = new IndexerGrpcMitoApi(endpoint);

        const limit = 100;
        let pageIndex = 0;
        let totalVaults: any[] = [];
        let total: number;

        do {
            const response = await mitoApi.fetchVaults({
                limit: limit,
                pageIndex: pageIndex
            });
            console.log(response)

            if (!response.vaults || response.vaults.length === 0) {
                break;
            }

            totalVaults = totalVaults.concat(response.vaults);
            total = response.pagination!.total as number;
            pageIndex += 1;

        } while (totalVaults.length < total);
        return totalVaults;
    }

    async fetchMitoVaultHolders(vaultAddress: string, stakingContractAddress: string, setProgress: any) {
        const endpoint = this.endpoints.chainId!.includes("888")
            ? 'https://k8s.testnet.mito.grpc-web.injective.network'
            : 'https://k8s.mainnet.mito.grpc-web.injective.network';
        const mitoApi = new IndexerGrpcMitoApi(endpoint);

        const limit = 100;
        let pageIndex = 0;
        let totalHolders: any[] = [];
        let total: number;

        do {
            const response = await mitoApi.fetchLPHolders({
                limit: limit,
                skip: pageIndex,
                vaultAddress,
                stakingContractAddress
            });

            if (!response.holders || response.holders.length === 0) {
                break;
            }


            totalHolders = totalHolders.concat(response.holders);
            total = response.pagination!.total as number;
            pageIndex += response.holders.length;

            setProgress(`${totalHolders.length} / ${total}`)


        } while (totalHolders.length < total);
        return totalHolders;
    }

    async fetchMitoVaultCreationFee() {
        const { denomCreationFee } = await this.chainGrpcTokenFactoryApi.fetchModuleParams();
        const [fee] = denomCreationFee;

        const mitoMasterContract = this.endpoints.chainId!.includes("888")
            ? "inj174efvalr8d9muguudh9uyd7ah7zdukqs9w4adq"
            : 'inj1vcqkkvqs7prqu70dpddfj7kqeqfdz5gg662qs3';
        const query = Buffer.from(JSON.stringify({ config: {} })).toString('base64');
        const info = await this.chainGrpcWasmApi.fetchSmartContractState(mitoMasterContract, query)
        const config = JSON.parse(new TextDecoder().decode(info.data))

        const permissionlessVaultRegistrationFee = config.permissionless_vault_registration_fee.find(
            ({ denom }: any) => denom === 'inj'
        );

        return ((Number(permissionlessVaultRegistrationFee?.amount) || 0) + (Number(fee?.amount) || 0)) / Math.pow(10, 18);
    }

    async getINJDerivativesPrice() {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const indexerGrpcOracleApi = new IndexerGrpcOracleApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchMarkets()

        // Helix migrated the INJ perp from USDT -> USDC, so the old
        // 'INJ/USDT PERP' ticker no longer exists. Prefer the new USDC market,
        // tolerate the old USDT one, then fall back to any listed INJ perp so a
        // ticker/quote change can't crash this again.
        const market =
            markets.find((m) => m.ticker === 'INJ/USDC PERP') ??
            markets.find((m) => m.ticker === 'INJ/USDT PERP') ??
            markets.find((m) => (m as any).oracleBase === 'INJ' && /\bPERP$/.test(m.ticker ?? ''))

        if (!market) {
            // No INJ perp listed at all — use the AMM spot price rather than throw.
            return await this.getINJPrice()
        }

        // The INJ/USDC perp is priced off the Pyth oracle; read the feed params
        // straight from the market so this works for whatever oracle it uses.
        const oraclePrice = await indexerGrpcOracleApi.fetchOraclePriceNoThrow({
            baseSymbol: (market as any).oracleBase,
            quoteSymbol: (market as any).oracleQuote,
            oracleType: market.oracleType,
        })

        return oraclePrice['price']
    }

    async getBalances(wallet: any) {
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

    async fetchBinaryOptionMarkets(status: any) {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchBinaryOptionsMarkets({
            marketStatus: status,
            pagination: { limit: 20 }
        })
        console.log(markets.pagination)
        return markets.markets
    }

    async fetchBinaryOptionMarket(marketId: any) {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchBinaryOptionsMarket(marketId)
        return markets
    }

    async getDerivativeMarketOrders(marketId: any) {
        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const orders = await marketsAPI.fetchOrderHistory({
            marketId: marketId
        })
        console.log(orders)
        return orders.orderHistory
    }

    async fetchOracleList() {
        const indexerGrpcOracleApi = new IndexerGrpcOracleApi(this.endpoints.indexer)

        const oracleList = await indexerGrpcOracleApi.fetchOracleList()
        console.log(oracleList)

        return oracleList
    }

    async fetchOraclePrice(ticker: any) {
        const indexerGrpcOracleApi = new IndexerGrpcOracleApi(this.endpoints.indexer)

        const marketsAPI = new IndexerGrpcDerivativesApi(this.endpoints.indexer)
        const markets = await marketsAPI.fetchMarkets()

        const market = markets.reverse().find((market) => market.ticker === ticker)
        if (!market) {
            console.log("cannot find market with ticker", ticker)
            return
        }
        const baseSymbol = (market as any).oracleBase
        const quoteSymbol = (market as any).oracleQuote
        const oracleType = market.oracleType

        const oraclePrice = await indexerGrpcOracleApi.fetchOraclePriceNoThrow({
            baseSymbol,
            quoteSymbol,
            oracleType,
        })
        console.log(oraclePrice)

        return oraclePrice['price']
    }

    async fetchWithRetry(url: any, options: any, maxRetries = 10, retryDelay = 1000) {
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

    // Injective Community BuyBack (mainnet) — the monthly buyback "Auction"
    // CosmWasm contract. Participants join a round via `bid`; the reward basket
    // is distributed pro-rata and the committed INJ is burned. Mainnet-only.
    static BUYBACK_CONTRACT = "inj10n78w79xhxmytnuhjcck633nj4e7hrqaglgnfz";
    static BUYBACK_LCD = "https://sentry.lcd.injective.network";

    // Enumerate the completed/open buyback rounds by walking `get_round_info`
    // from round 1 until the contract reports no such round. Returns lightweight
    // metadata used to build the round picker (round #, month, INJ committed).
    async fetchBuybackRounds() {
        const contract = TokenUtils.BUYBACK_CONTRACT;
        const lcd = TokenUtils.BUYBACK_LCD;
        const rounds: {
            round: number;
            totalDeposit: number;
            usedSlots: number;
            startDate: number;
            endDate: number;
            chainRound: number;
            basketTokens: number;
        }[] = [];
        for (let round = 1; round <= 120; round++) {
            const query = btoa(JSON.stringify({ get_round_info: { round_id: round } }));
            let data: any;
            try {
                data = await this.fetchWithRetry(
                    `${lcd}/cosmwasm/wasm/v1/contract/${contract}/smart/${query}`,
                    { method: "GET", headers: { "Content-Type": "application/json" } },
                    2,
                );
            } catch {
                break; // round doesn't exist yet — we've reached the end
            }
            const d = data?.data;
            if (!d || d.id === undefined) break;
            rounds.push({
                round,
                totalDeposit: Number(d.total_deposit || 0) / 1e18,
                usedSlots: Number(d.used_slots || 0),
                startDate: Number(d.start_date || 0),
                endDate: Number(d.end_date || 0),
                chainRound: Number(d.chain_round || 0),
                basketTokens: Array.isArray(d.basket) ? d.basket.length : 0,
            });
        }
        return rounds;
    }

    // Fetch every wallet that committed INJ in a given buyback round, with the
    // amount they committed. The contract has no "list participants" query, so we
    // iterate its raw state: participants live in a cw-storage-plus
    // Map<(u64 round_id, Addr), UserRoundInfo> under the `user_round_info`
    // namespace, and each entry's value already carries wallet + round_id +
    // deposit — no key parsing needed. We craft the state start-key so pagination
    // begins at this round's first entry and stop once it leaves the map or
    // crosses into a later round.
    //
    // NB: whitelisting a wallet creates a user_round_info row with deposit 0, so a
    // round can hold thousands of 0-deposit reservations (recent rounds have ~14k
    // whitelisted vs ~280 who actually committed). We keep only deposit > 0 rows
    // (the real committers) and, given `expectedTotalInj` (the round's
    // total_deposit), stop early once the found deposits account for it — which
    // also short-circuits the currently-open round (no deposits yet). Verified:
    // per-round committer deposits sum exactly to the round's total_deposit.
    // Mainnet-only.
    async fetchBuybackParticipants(round: number, expectedTotalInj: number | undefined, setProgress: any) {
        const contract = TokenUtils.BUYBACK_CONTRACT;
        const lcd = TokenUtils.BUYBACK_LCD;

        // start key = 0x00 <len> "user_round_info" 0x00 0x08 <round: u64 BE>
        const nsBytes = new TextEncoder().encode("user_round_info");
        const startKey = new Uint8Array(2 + nsBytes.length + 2 + 8);
        startKey[0] = 0;
        startKey[1] = nsBytes.length;
        startKey.set(nsBytes, 2);
        const roundOff = 2 + nsBytes.length;
        startKey[roundOff] = 0;
        startKey[roundOff + 1] = 8;
        new DataView(startKey.buffer).setBigUint64(roundOff + 2, BigInt(round), false);

        // Namespace prefix (0x00 <len> "user_round_info") shared by every entry in
        // the map — used to detect when pagination walks past the map.
        const nsPrefix = startKey.slice(0, 2 + nsBytes.length);

        const bytesToB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
        const b64ToBytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        // The state endpoint marshals model keys as HexBytes, so `key` is an
        // uppercase-hex string (not base64) — decode it directly to raw key bytes.
        // (Values are plain base64; next_key is raw-bytes base64.)
        const modelKeyBytes = (s: string) => {
            const out = new Uint8Array(s.length >> 1);
            for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
            return out;
        };
        const startsWith = (a: Uint8Array, p: Uint8Array) =>
            a.length >= p.length && p.every((v, i) => a[i] === v);

        // The open round can carry a very large 0-deposit whitelist with nothing
        // committed yet — don't scan it at all.
        if (expectedTotalInj !== undefined && expectedTotalInj <= 0) return [];

        const participants: { address: string; deposit: number }[] = [];
        let committedSum = 0;
        let scanned = 0;
        let pageKey: string | null = bytesToB64(startKey);
        const maxPages = 500; // whitelist rows can be numerous; early-stop usually hits first

        for (let page = 0; page < maxPages; page++) {
            const url =
                `${lcd}/cosmwasm/wasm/v1/contract/${contract}/state` +
                `?pagination.limit=100&pagination.key=${encodeURIComponent(pageKey as string)}`;
            const data = await this.fetchWithRetry(
                url,
                { method: "GET", headers: { "Content-Type": "application/json" } },
                50,
            );
            const models: any[] = data?.models ?? [];
            let done = false;
            for (const m of models) {
                if (!startsWith(modelKeyBytes(m.key), nsPrefix)) {
                    done = true; // left the user_round_info map
                    break;
                }
                let v: any;
                try {
                    v = JSON.parse(new TextDecoder().decode(b64ToBytes(m.value)));
                } catch {
                    continue;
                }
                if (typeof v?.round_id !== "number" || !v.wallet) continue;
                if (v.round_id > round) {
                    done = true; // crossed into a later round
                    break;
                }
                if (v.round_id !== round) continue;
                scanned++;
                const deposit = Number(v.deposit || 0) / 1e18;
                if (deposit > 0) {
                    participants.push({ address: v.wallet, deposit });
                    committedSum += deposit;
                }
            }
            if (setProgress) setProgress(`${participants.length} participants (scanned ${scanned})`);
            // Every committed INJ accounted for — the rest of the whitelist never bid.
            if (expectedTotalInj !== undefined && expectedTotalInj > 0 && committedSum >= expectedTotalInj - 1e-6) {
                done = true;
            }
            const nextKey = data?.pagination?.next_key;
            if (done || !nextKey) break;
            pageKey = nextKey;
        }
        return participants;
    }

    async fetchProposalVoters(proposalId: any, blockNumber: any, setProgress: any) {
        const lcdBase = `https://sentry.lcd.injective.network/cosmos/gov/v1/proposals/${proposalId}/votes`;
        let voters: any[] = [];
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
        } catch {
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
        return subaccountsList
    }

    async getHelixMarketBestBuy(marketId: string, decimals: number) {
        const orders = await this.indexerGrpcSpotApi.fetchOrders({ marketId });
        const buyOrders = orders.orders.filter(order => order.orderSide === 'buy').sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        // const sellOrders = orders.orders.filter(order => order.orderSide === 'sell').sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        const injPrice = await this.getINJDerivativesPrice()
        return (Number(buyOrders[0].price) / Math.pow(10, decimals)) * Number(injPrice)
    }

    async getSpotMarket(marketId: any) {
        return await this.indexerGrpcSpotApi.fetchMarket(marketId);
    }

    async getSpotMarketOrders(marketId: any) {
        return await this.indexerGrpcSpotApi.fetchOrders({ marketId });
    }

    constructCW20ToBankMsg(cw20Address: any, amount: any, decimals: any, wallet: any) {
        const adapterContract = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"

        const msg = MsgExecuteContractCompat.fromJSON({
            contractAddress: cw20Address,
            sender: wallet,
            msg: {
                send: {
                    contract: adapterContract,
                    amount: (Number(amount) * Math.pow(10, decimals)).toLocaleString('fullwide', { useGrouping: false }),
                    msg: Buffer.from(JSON.stringify({})).toString('base64'),
                }
            }
        });

        return msg
    }

    constructBankToCW20Msg(cw20Address: any, amount: any, decimals: any, wallet: any) {
        const adapterContract = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
        const denom = `factory/${adapterContract}/${cw20Address}`

        const msg = MsgExecuteContractCompat.fromJSON({
            contractAddress: adapterContract,
            sender: wallet,
            msg: {
                redeem_and_transfer: {
                    recipient: wallet,
                }
            },
            funds: {
                denom: denom,
                amount: (Number(amount) * Math.pow(10, decimals)).toLocaleString('fullwide', { useGrouping: false }),
            },
        });

        return msg
    }

    constructExecuteRouteMessage(injectiveAddress: any, route: any, offer_asset: any, amount: any, minReceive: any, funds: any) {
        const swapOperations = {
            execute_routes: {
                offer_asset_info: offer_asset,
                routes: [
                    {
                        route: route.map((pool: any) => {
                            return {
                                contract_addr: pool.address,
                            }
                        }),
                        offer_amount: amount
                    }
                ],
                minimum_receive: minReceive
            }
        };

        console.log(swapOperations)

        let msg = MsgExecuteContract.fromJSON({
            contractAddress: this.coinhallRouter,
            sender: injectiveAddress,
            msg: swapOperations,
            funds: funds
        });

        if (!offer_asset.native_token && offer_asset.token) {
            msg = MsgExecuteContract.fromJSON({
                contractAddress: offer_asset.token.contract_addr,
                sender: injectiveAddress,
                msg: {
                    send: {
                        contract: this.coinhallRouter,
                        amount: amount,
                        msg: Buffer.from(JSON.stringify(swapOperations)).toString('base64'),
                    }
                }
            });
        }

        return msg
    }

    async constructSpotMarketOrder(marketId: any, price: any, quantity: any, orderType: any, decimals: any, injectiveAddress: any, feeRecipient: any) {
        const marketInfo = await this.indexerGrpcSpotApi.fetchMarket(marketId);

        const { priceTensMultiplier, quantityTensMultiplier } = getSpotMarketTensMultiplier({
            baseDecimals: decimals,
            quoteDecimals: 18,
            minPriceTickSize: marketInfo.minPriceTickSize,
            minQuantityTickSize: marketInfo.minQuantityTickSize,
        })

        const market = {
            marketId: marketId,
            baseDecimals: decimals,
            quoteDecimals: 18,
            minPriceTickSize: marketInfo.minPriceTickSize,
            minQuantityTickSize: marketInfo.minQuantityTickSize,
            priceTensMultiplier: priceTensMultiplier,
            quantityTensMultiplier: quantityTensMultiplier,
        }

        const order = {
            price: price,
            quantity: quantity
        }

        const ethereumAddress = getEthereumAddress(injectiveAddress)
        const subaccountIndex = 0
        const suffix = '0'.repeat(23) + subaccountIndex
        const subaccountId = ethereumAddress + suffix

        const msg = MsgCreateSpotMarketOrder.fromJSON({
            subaccountId,
            injectiveAddress,
            orderType: orderType,
            price: spotPriceToChainPriceToFixed({
                value: order.price,
                tensMultiplier: market.priceTensMultiplier,
                baseDecimals: market.baseDecimals,
                quoteDecimals: market.quoteDecimals
            }),
            quantity: spotQuantityToChainQuantityToFixed({
                value: order.quantity,
                tensMultiplier: market.quantityTensMultiplier,
                baseDecimals: market.baseDecimals
            }),
            marketId: market.marketId,
            feeRecipient: feeRecipient,
        })

        return msg
    }

    getHelixShroomBuyQuote(market: any, orders: any, quoteAmount: any, decimals: any) {
        const takerFeeRate = parseFloat(market.takerFeeRate);

        const sellOrders = orders.orders
            .filter((order: any) => order.orderSide === 'sell')
            .sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));

        let totalQuantity = 0;
        let remainingQuote = quoteAmount * (1 - takerFeeRate); // Apply taker fee at the start
        let worstAcceptablePrice = null;

        for (const order of sellOrders) {
            const price = parseFloat(order.price) / Math.pow(10, 18 - decimals);
            const quantityAvailable = parseFloat(order.unfilledQuantity) / Math.pow(10, decimals);

            const maxSpendableQuantity = remainingQuote / price;

            if (maxSpendableQuantity >= quantityAvailable) {
                totalQuantity += quantityAvailable;
                remainingQuote -= quantityAvailable * price;
            } else {
                totalQuantity += maxSpendableQuantity;
                break;
            }

            // Update worst acceptable price to the current price level
            worstAcceptablePrice = price;

            if (remainingQuote <= 0) {
                break;
            }
        }

        const averagePrice = totalQuantity > 0 ? quoteAmount / totalQuantity : 0;

        return {
            totalQuantity,
            averagePrice,
            worstAcceptablePrice
        };
    }

    getHelixShroomSellQuote(market: any, orders: any, baseAmount: any, decimals: any) {
        const takerFeeRate = parseFloat(market.takerFeeRate);

        const buyOrders = orders.orders
            .filter((order: any) => order.orderSide === 'buy')
            .sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));

        let totalQuote = 0;
        let totalBaseSold = 0;
        let remainingBase = baseAmount;
        let worstAcceptablePrice = null;

        for (const order of buyOrders) {
            const price = parseFloat(order.price) / Math.pow(10, 18 - decimals);
            const quantityAvailable = parseFloat(order.unfilledQuantity) / Math.pow(10, decimals);

            const maxSellableQuantity = remainingBase;
            worstAcceptablePrice = price;

            if (maxSellableQuantity >= quantityAvailable) {
                totalQuote += quantityAvailable * price;
                totalBaseSold += quantityAvailable;
                remainingBase -= quantityAvailable;
            } else {
                totalQuote += remainingBase * price;
                totalBaseSold += remainingBase;
                break;
            }

            if (remainingBase <= 0) {
                break;
            }
        }

        // Apply taker fee to the total quote amount at the end
        totalQuote *= (1 - takerFeeRate);

        const averagePrice = totalBaseSold > 0 ? totalQuote / totalBaseSold : 0;

        return {
            totalQuantity: totalQuote,
            averagePrice,
            worstAcceptablePrice
        };
    }

    async getHelixMarketQuote(marketId: any, baseTokenAmount: any, decimals: any) {
        const market = await this.indexerGrpcSpotApi.fetchMarket(marketId);

        const baseDecimals = decimals;

        const orders = await this.indexerGrpcSpotApi.fetchOrders({ marketId });

        const takerFeeRate = parseFloat(market.takerFeeRate);

        const buyOrders = orders.orders.filter(order => order.orderSide === 'buy').sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        const sellOrders = orders.orders.filter(order => order.orderSide === 'sell').sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

        console.log("buy orders", buyOrders)
        console.log("sell orders", sellOrders)

        function calculateQuoteAmount(orderList: any, baseTokenAmount: any, fee: any) {
            let totalPrice = 0;
            let totalQuantity = 0;
            let remainingBaseAmount = baseTokenAmount

            for (const order of orderList) {
                let price = parseFloat(order.price) / Math.pow(10, 18 - baseDecimals);
                const quantity = parseFloat(order.unfilledQuantity) / Math.pow(10, baseDecimals);

                // console.log(price, quantity)

                price += price * fee;

                if (remainingBaseAmount <= quantity) {
                    totalPrice += remainingBaseAmount * price;
                    totalQuantity += remainingBaseAmount;
                    break;
                } else {
                    totalPrice += quantity * price;
                    totalQuantity += quantity;
                    remainingBaseAmount -= quantity;
                }
            }

            return {
                averagePrice: totalQuantity ? totalPrice / totalQuantity : 0,
                quoteAmount: totalPrice
            };
        }

        const { averagePrice: averageBuyPrice, quoteAmount: buyQuoteAmount } = calculateQuoteAmount(sellOrders, baseTokenAmount, takerFeeRate);
        const { averagePrice: averageSellPrice, quoteAmount: sellQuoteAmount } = calculateQuoteAmount(buyOrders, baseTokenAmount, -takerFeeRate);

        return {
            averageBuyPrice,
            averageSellPrice,
            buyQuoteAmount,
            sellQuoteAmount
        };
    }

    async getAllAccountTx(walletAddress: string, setProgress: any) {
        const api = new IndexerRestExplorerApi("https://sentry.explorer.grpc-web.injective.network/api/explorer/v1");
        const allTransactions = [];
        let skip = 0;
        const limit = 100;
        let totalFetched = 0;
        let totalTransactions: number;

        try {
            const tx = await api.fetchAccountTransactions({
                account: walletAddress,
                params: { limit }
            });

            totalTransactions = tx.paging.total;
            totalFetched += tx.transactions.length;
            allTransactions.push(...tx.transactions);

            console.log(`${totalFetched} / ${totalTransactions}`)

            while (totalFetched < totalTransactions) {
                skip += limit;
                const nextBatch = await api.fetchAccountTransactions({
                    account: walletAddress,
                    params: { limit, skip }
                });

                allTransactions.push(...nextBatch.transactions);
                totalFetched += nextBatch.transactions.length;
                setProgress(`${totalFetched} / ${totalTransactions}`)
            }

            return allTransactions

        } catch (error) {
            console.error(`Error fetching transactions:`, error);
        }
    }

    async queryOrderBookSwap(inputDenom: string, outputDenom: string, inputAmount: number) {
        const CW20_ADAPTER_ADDRESS = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
        const ORDERBOOK_SWAP_ADDRESS = "inj1tcl59pywlnkjgx33pempyluy8fyunmp02jdn6a"

        const contractAddress = ORDERBOOK_SWAP_ADDRESS

        let inputToken = inputDenom
        let outputToken = outputDenom
        if (inputToken.startsWith("inj") && inputToken !== "inj") {
            inputToken = `factory/${CW20_ADAPTER_ADDRESS}/${inputToken}`
        }
        if (outputToken.startsWith("inj") && outputToken !== "inj") {
            outputToken = `factory/${CW20_ADAPTER_ADDRESS}/${outputToken}`
        }

        const query = Buffer.from(
            JSON.stringify({
                get_output_quantity: {
                    from_quantity: inputAmount.toLocaleString('fullwide', { useGrouping: false }),
                    source_denom: inputToken,
                    target_denom: outputToken,
                }
            })
        ).toString("base64");

        const info = await this.chainGrpcWasmApi.fetchSmartContractState(
            contractAddress,
            query
        );

        const r = JSON.parse(new TextDecoder().decode(info.data))

        return r
    }
}

export default TokenUtils;
