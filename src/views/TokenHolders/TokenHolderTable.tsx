import { FixedSizeList as List } from 'react-window';
import HolderRow from './HolderRow';

const ROW_HEIGHT = 30;


const TokenHoldersTable = ({ holders, startIndex, hasSplitBalances, WALLET_LABELS, lastLoadedAddress, liquidity, findingLiq }) => {
    const totalHolders = holders.length;

    return (
        <div className="mt-2 overflow-x-auto">
            <div
                className={`grid grid-cols-${hasSplitBalances ? 7 : 6} items-center gap-x-4 `}
            >
                <div className="col-span-1">Position</div>
                <div className="col-span-2">Address</div>
                <div className="col-span-1">{hasSplitBalances ? "CW20 Balance" : "Balance"}</div>
                {hasSplitBalances && <div className="col-span-1">Bank Balance</div>}
                <div className="col-span-1">Percentage</div>
                <div className="col-span-1">USD</div>
            </div>
            <List
                height={500}
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
                }}
            >
                {HolderRow}
            </List>
        </div>
    );
};

export default TokenHoldersTable