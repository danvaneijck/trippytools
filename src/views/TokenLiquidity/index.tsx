/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useCallback, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from 'react-router-dom';


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
    total_supply: number;
}

interface Holder {
    address: string;
    balance: string;
    percentageHeld: string;
}

interface TokenMeta {
    denom: string;
}

interface PairInfo {
    token0Meta: TokenMeta;
    token1Meta: TokenMeta;
    liquidity_token: string;
    contract_addr: string;
}


const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";


const TokenLiquidity = () => {
    const [contractAddress, setContractAddress] = useState(
        "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
    );

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

    const [holders, setHolders] = useState<Holder[]>([]);
    const [queriesPerformed, setQueriedPerformed] = useState<number>(0);
    const [pairInfo, setPairInfo] = useState<PairInfo | undefined>(undefined);

    const [loading, setLoading] = useState(false);

    const getTokenHolders = useCallback(() => {
        console.log(contractAddress);
        setLoading(true);
        setQueriedPerformed(0);
        setHolders([]);

        const module = new TokenUtils(MAIN_NET);

        module.getPairInfo(contractAddress).then((r: PairInfo) => {
            console.log(r);
            setPairInfo(r);

            const memeAddress = r.token0Meta.denom === 'inj'
                ? r.token1Meta.denom
                : r.token0Meta.denom;

            module.getTokenInfo(memeAddress).then((r: any) => { // Assuming getTokenInfo's return type is dynamic, otherwise define an interface
                setTokenInfo(r);
            }).catch((e: unknown) => {
                console.log(e);
            });

            const liquidityToken = r.liquidity_token;
            module.getTokenHolders(liquidityToken, setQueriedPerformed).then((r: Holder[]) => {
                console.log(r);
                setHolders(r);
                setLoading(false);
            }).catch((e: unknown) => {
                console.log(e);
                setLoading(false);
            });
        }).catch(e => {
            console.log(e);
        });

    }, [contractAddress]);

    return (
        <div className="flex flex-col min-h-screen">
            <header className="bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2">
                    <Link to="/" className="text-base font-bold hover:underline mr-5">
                        $TRIPPY pre sale
                    </Link>
                    <Link to="/trippy-distribution" className="text-base font-bold hover:underline mr-5">
                        $TRIPPY distribution
                    </Link>
                    <Link to="/token-holders" className="text-base font-bold hover:underline ">
                        token holder tool
                    </Link>
                </div>
            </header>

            {/* Adjust padding-top to match header height + some space */}
            <div className="pt-20 flex-grow">
                <div className="flex justify-center items-center w-full py-10">
                    <div className="w-full max-w-screen-xl px-2">
                        <div className="text-center text-white">
                            <div className="text-xl">Get cw20 liquidity token holders</div>
                            <div className="text-xs">on Injective main net</div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label htmlFor="token-address" className="block text-white">Pair address</label>
                            <input
                                type="text"
                                className="text-black w-full"
                                onChange={(e) => setContractAddress(e.target.value)}
                                value={contractAddress}
                            />
                        </div>

                        <button
                            disabled={loading}
                            onClick={getTokenHolders}
                            className="bg-gray-800 rounded p-2 mt-5 w-full text-white border border-white"
                        >
                            Get token liquidity
                        </button>

                        {tokenInfo && (
                            <div className="mt-5 text-base text-white">
                                <div>name: {tokenInfo.name}</div>
                                <div>symbol: {tokenInfo.symbol}</div>
                                <div>decimals: {tokenInfo.decimals}</div>
                                <div>total supply: {tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)}</div>
                            </div>
                        )}

                        {pairInfo && (
                            <div className="mt-2 text-white">
                                <div>pair address: {pairInfo.contract_addr}</div>
                                <div>liquidity token: {pairInfo.liquidity_token}</div>
                            </div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center justify-center pt-5">
                                <GridLoader color="#36d7b7" />
                                <div className="text-sm mt-2">queries performed: {queriesPerformed}</div>
                            </div>
                        )}

                        {holders.length > 0 && (
                            <div className="mt-2 overflow-x-auto">
                                <div>Total holders: {holders.length}</div>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="">
                                        <tr>
                                            <th className="px-4 py-2">Address</th>
                                            <th className="px-4 py-2">Balance</th>
                                            <th className="px-4 py-2">Percentage Held</th>
                                        </tr>
                                    </thead>
                                    <tbody className="">
                                        {holders.filter(holder => Number(holder.balance) !== 0).map((holder, index) => (
                                            <tr key={index} className="border-b">
                                                <td className="px-4 py-1 text-blue-600">
                                                    <a href={`https://explorer.injective.network/account/${holder.address}`}>
                                                        {holder.address}
                                                    </a>
                                                    {holder.address === dojoBurnAddress && <span className="text-red-500 ml-2">  DOJO BURN ADDY 🔒</span>}
                                                    {holder.address === injBurnAddress && <span className="text-red-500 ml-2">  INJ BURN ADDY 🔒</span>}
                                                </td>
                                                <td className="px-4 py-2">{holder.balance}</td>
                                                <td className="px-4 py-2">{holder.percentageHeld}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="bg-gray-800 text-white text-xs p-4 fixed bottom-0 left-0 right-0">
                buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
            </footer>
        </div>

    );
};

export default TokenLiquidity;
