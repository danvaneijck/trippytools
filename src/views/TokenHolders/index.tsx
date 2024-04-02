/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useCallback, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";


const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network"
}

interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: number; // Adjust according to actual property names
}

interface Holder {
    address: string;
    balance: string; // or string if it represents a big number
    percentageHeld: string; // Adjust according to actual property names and types
}


const TokenHolders = () => {
    const [contractAddress, setContractAddress] = useState(
        "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
    );

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [holders, setHolders] = useState<Holder[]>([]);
    const [queriesPerformed, setQueriedPerformed] = useState<number>(0);

    const [loading, setLoading] = useState(false);

    const getTokenHolders = useCallback(() => {
        console.log(contractAddress);
        setLoading(true);
        setQueriedPerformed(0)
        setHolders([])

        const module = new TokenUtils(MAIN_NET);

        module.getTokenInfo(contractAddress).then(r => {
            setTokenInfo(r)
        }).catch((e: unknown) => {
            console.log(e)
        });

        module.getTokenHolders(contractAddress, setQueriedPerformed).then((r: Holder[]) => {
            console.log(r);
            setHolders(r)
            setLoading(false)
        }).catch((e: unknown) => {
            console.log(e)
            setLoading(false)
        });

    }, [contractAddress]);

    return (
        <div className="flex justify-center items-center w-full pt-10 pb-20 ">

            <div>
                <div className="text-white text-xl">Get cw20 token holders</div>
                <br />
                <div>token address</div>
                <input
                    type="text"
                    className="text-black w-full"
                    onChange={(e) => setContractAddress(e.target.value)}
                    value={contractAddress}
                />
                <br />
                <button
                    disabled={loading}
                    onClick={getTokenHolders}
                    className="bg-gray-800 rounded p-2 mt-5 w-full text-white border border-white"
                >
                    Get token holders
                </button>

                {tokenInfo !== null &&
                    <div className="mt-2">
                        <div>name: {tokenInfo.name}</div>
                        <div>symbol: {tokenInfo.symbol}</div>
                        <div>decimals: {tokenInfo.decimals}</div>
                        <div>total supply: {tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)}</div>
                    </div>
                }

                {loading && <div className="items-center justify-center flex flex-col pt-5">
                    <GridLoader color="#36d7b7" /> <br />
                    <div>queries performed: {queriesPerformed}</div>
                </div>}

                {holders.length > 0 && <div>
                    <div className="my-2">Total holders: {holders.length}</div>
                    <div className="">Address, Balance, Percentage held</div>
                </div>
                }
                {holders.length > 0 && holders.map((holder, index) => {
                    return <div key={index}>
                        <a className="hover:cursor-pointer" href={`https://explorer.injective.network/account/${holder.address}`}>{holder.address}</a>,
                        {holder.balance} {tokenInfo && tokenInfo.symbol}, {holder.percentageHeld}%
                    </div>
                })

                }
            </div>
        </div>
    );
};

export default TokenHolders;
