import { FixedSizeList as List } from 'react-window';
import HolderRow from './HolderRow';

const ROW_HEIGHT = 30;

export interface TokenHolderRow {
    address: string;
    balance: number;
    percentageHeld: number;
    cw20Balance?: number;
    bankBalance?: number;
    usdValue?: number | null;
}

export type WalletLabel = { label: string; bgColor: string; textColor: string };
export type WalletLabelMap = Record<string, WalletLabel | undefined>;

export interface TokenHoldersTableProps {
    holders: TokenHolderRow[];
    startIndex: number;
    hasSplitBalances: boolean;
    WALLET_LABELS: WalletLabelMap;
    lastLoadedAddress: string;
    liquidity: any[];
    findingLiq: boolean;
    // When true, render holder addresses in their EVM (0x) form, linked to the
    // Blockscout explorer for the given network.
    showEvm?: boolean;
    network?: "mainnet" | "testnet";
}

const TokenHoldersTable = ({ holders, startIndex, hasSplitBalances, WALLET_LABELS, lastLoadedAddress, liquidity, findingLiq, showEvm, network }: TokenHoldersTableProps) => {
    const totalHolders = holders.length;

    return (
        <div className="mt-5 overflow-x-auto font-sans">
            <div
                className={`grid ${hasSplitBalances ? 'grid-cols-7' : 'grid-cols-6'} items-center gap-4 border-b border-white/10 pb-2 text-left text-[11px] uppercase tracking-wide text-white/50 min-w-175`}
            >
                <div className="col-span-1 overflow-hidden text-ellipsis">Position</div>
                <div className="col-span-2 overflow-hidden text-ellipsis">{showEvm ? "EVM Address" : "Address"}</div>
                <div className="col-span-1 overflow-hidden text-ellipsis">{hasSplitBalances ? "CW20 Balance" : "Balance"}</div>
                {hasSplitBalances && <div className="col-span-1 overflow-hidden text-ellipsis">Bank Balance</div>}
                <div className="col-span-1 overflow-hidden text-ellipsis">Percentage</div>
                <div className="col-span-1 overflow-hidden text-ellipsis">USD</div>
            </div>
            <List
                height={400}
                itemCount={totalHolders}
                itemSize={ROW_HEIGHT}
                width="100%"
                itemData={{
                    holders,
                    startIndex,
                    hasSplitBalances,
                    WALLET_LABELS,
                    lastLoadedAddress,
                    liquidity,
                    findingLiq,
                    showEvm,
                    network,
                }}
            >
                {HolderRow}
            </List>
        </div>
    );
};

export default TokenHoldersTable
