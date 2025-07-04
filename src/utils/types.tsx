import { Dayjs } from "dayjs";

export interface NativeTokenInfo {
    native_token: {
        denom: string;
    };
}

export interface ContractTokenInfo {
    token: {
        contract_addr: string;
    };
}

export type TokenInfo = NativeTokenInfo | ContractTokenInfo;

export interface Token {
    name: string;
    symbol: string;
    denom: string;
    address: string;
    info: TokenInfo;
    icon: string;
    decimals: number;
    show_on_ui: boolean;
    prices?: [Price];
    yesterday_price?: [Price];
    pools_asset_1?: LiquidityPool[];
    pools_asset_2?: LiquidityPool[];
    balance?: number;
    percentChange?: number;
    balanceUpdated?: Dayjs;
    usdBalance?: number;
    liquidity_token_pool?: LiquidityPool;
    price?: number;
    priceUpdated?: Dayjs
}

export interface LiquidityPool {
    contract_addr: string;
    liquidity_token: Token;
    asset_1: Token;
    asset_2: Token;
    dex: Dex;
    tvl?: number;
    tvlUpdated?: Dayjs;
    walletAmounts?: {
        balance: number,
        usdBalance: number,
        asset1Amount: number,
        asset2Amount: number,
        asset1Usd: number,
        asset2Usd: number,
        balanceUpdated?: Dayjs
    }
}

export interface Price {
    time: string;
    price: number;
}

export interface Dex {
    name: string;
    factory_address: string;
    router_address: string;
}