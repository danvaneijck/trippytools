export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    total_supply?: number;
    description?: string
}

export interface Holder {
    address: string;
    balance: string | number;
    percentageHeld: string;
}

export interface TokenMeta {
    denom: string;
}

export interface PairInfo {
    token0Meta: TokenMeta;
    token1Meta: TokenMeta;
    liquidity_token: string;
    contract_addr: string;
}

export interface MarketingInfo {
    project: string
    description: string
    logo: {
        url: string
    },
    marketing: string
}


