import { ClipLoader } from "react-spinners";

const HolderRow = ({ index, style, data }) => {
    const holder = data.holders[index];
    const { startIndex, hasSplitBalances, WALLET_LABELS, lastLoadedAddress, liquidity, findingLiq } = data;

    return (
        <div
            key={index + startIndex}
            style={style}
            className={`text-white border-b grid grid-cols-${hasSplitBalances ? 7 : 6} gap-4 items-center text-left min-w-[700px]`}
        >
            <div className="col-span-1 overflow-hidden text-ellipsis">{startIndex + index + 1}</div>
            <div className="col-span-2 whitespace-nowrap overflow-hidden text-ellipsis">
                <a
                    className="hover:text-indigo-900"
                    href={`https://explorer.injective.network/account/${holder.address}`}
                >
                    {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)}
                </a>
                {WALLET_LABELS[holder.address] && (
                    <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                        {WALLET_LABELS[holder.address].label}
                    </span>
                )}
                {holder.address == lastLoadedAddress && (
                    <span className="text-red-500 ml-2">
                        {" "}token contract 🔥
                    </span>
                )}
                {liquidity.length > 0 && holder.address == liquidity[0].infoDecoded.contract_addr && (
                    <span className="text-blue-500 ml-2">
                        {" "}liquidity pool
                    </span>
                )}
            </div>
            <div className="col-span-1 overflow-hidden text-ellipsis">
                {hasSplitBalances ? holder.cw20Balance.toFixed(2) : holder.balance.toFixed(2)}
            </div>
            {hasSplitBalances && (
                <div className="col-span-1 overflow-hidden text-ellipsis">
                    {holder.bankBalance.toFixed(2)}
                </div>
            )}
            <div className="col-span-1 overflow-hidden text-ellipsis">
                {holder.percentageHeld.toFixed(2)}%
            </div>
            <div className="col-span-1 overflow-hidden text-ellipsis">
                {holder.usdValue?.toFixed(2) || (
                    !holder.usdValue && findingLiq && (
                        <ClipLoader size={20} color="white" />
                    )
                )}
            </div>
        </div>
    );
};

export default HolderRow