import { FixedSizeList as List } from 'react-window';
import HolderRow from './HolderRow';

const ROW_HEIGHT = 30;


const TokenHoldersTable = ({ holders, startIndex, hasSplitBalances, WALLET_LABELS, lastLoadedAddress, liquidity, findingLiq }) => {
    const totalHolders = holders.length;

    return (
        <div className="overflow-x-auto mt-5">
            <div
                className={`grid ${hasSplitBalances ? 'grid-cols-7' : 'grid-cols-6'} gap-4 items-center text-left`}
            >
                <div className="col-span-1 overflow-hidden text-ellipsis font-bold">Position</div>
                <div className="col-span-2 overflow-hidden text-ellipsis font-bold">Address</div>
                <div className="col-span-1 overflow-hidden text-ellipsis font-bold">{hasSplitBalances ? "CW20 Balance" : "Balance"}</div>
                {hasSplitBalances && <div className="col-span-1 overflow-hidden text-ellipsis font-bold">Bank Balance</div>}
                <div className="col-span-1 overflow-hidden text-ellipsis font-bold">Percentage</div>
                <div className="col-span-1 overflow-hidden text-ellipsis font-bold">USD</div>
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
                }}
            >
                {HolderRow}
            </List>
        </div>
    );
};

export default TokenHoldersTable