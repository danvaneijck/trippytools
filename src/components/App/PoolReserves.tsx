import React from "react";
import { LiquidityPool, TokenInfo } from "../../utils/types";
import { formatNumber } from "../../utils/helpers";

/**
 * Props for the PoolReserves component.
 */
interface PoolReservesProps {
    /**
     * Raw reserve data returned from the chain.
     */
    reserves: {
        assets: {
            info: TokenInfo;
            amount: string;
        }[];
        total_share: string;
    };

    /**
     * The pool definition selected by the user – used for metadata such as
     * token decimals, symbols, icons, prices, etc.
     */
    pool: LiquidityPool | null;
}

/**
 * Convert a raw on‑chain integer amount into a human‑readable decimal string
 * using the provided token decimal precision.
 */
const formatAmount = (raw: string, decimals: number): string => {
    const bn = BigInt(raw);
    const divisor = 10n ** BigInt(decimals);
    const whole = (bn / divisor).toString();
    const fraction = (bn % divisor)
        .toString()
        .padStart(decimals, "0")
        .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole;
};

/**
 * Given a TokenInfo object and the current pool, find the matching Token
 * instance (asset_1 or asset_2) to retrieve decimals / symbol / price info.
 */
const getTokenFromInfo = (
    info: TokenInfo,
    pool: LiquidityPool
): LiquidityPool["asset_1"] | LiquidityPool["asset_2"] | null => {
    if ("native_token" in info) {
        if (pool.asset_1.address === info.native_token.denom) return pool.asset_1;
        if (pool.asset_2.address === info.native_token.denom) return pool.asset_2;
    } else {
        if (pool.asset_1.address === info.token.contract_addr) return pool.asset_1;
        if (pool.asset_2.address === info.token.contract_addr) return pool.asset_2;
    }
    return null;
};

/**
 * Display the reserve balances for a given liquidity pool.
 */
const PoolReserves: React.FC<PoolReservesProps> = ({ reserves, pool }) => {
    if (!pool) return null;

    return (
        <div className="w-full 2xl:rounded-2xl shadow-md p-4 bg-trippyYellow/10 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
                {reserves.assets.map((asset, idx) => {
                    const token = getTokenFromInfo(asset.info, pool);
                    if (!token) return null;

                    const amountFormatted = formatNumber(asset.amount / Math.pow(10, token.decimals));
                    const usdValue = token.price
                        ? Number(amountFormatted) * token.price
                        : null;

                    return (
                        <div key={idx} className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                                {token.icon && (
                                    <img
                                        src={token.icon}
                                        alt={token.symbol}
                                        className="w-6 h-6 rounded-full"
                                    />
                                )}
                                <span className="font-semibold">{token.symbol}</span>
                            </div>

                            <span className="text-xl font-mono break-all">
                                {amountFormatted}
                            </span>

                            {usdValue !== null && (
                                <span className="text-sm text-muted-foreground">
                                    ≈ ${usdValue.toLocaleString(undefined, {
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Display total LP share at the bottom */}
            <div className="mt-4  text-xs text-muted-foreground">
                Total LP Shares: {formatAmount(reserves.total_share, pool.liquidity_token.decimals)} {pool.liquidity_token.symbol}
            </div>
        </div>
    );
};

export default PoolReserves;
