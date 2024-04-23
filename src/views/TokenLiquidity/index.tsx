/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, PairInfo, TokenInfo } from "../../types";
import { useSearchParams } from 'react-router-dom';
import { IoIosWarning } from "react-icons/io";

const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network",
};

const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

const TokenLiquidity = () => {

    const [module, setModule] = useState<TokenUtils | null>(null);

    const [contractAddress, setContractAddress] = useState(
        "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
    );

    const [lastLoadedAddress, setLastLoadedAddress] = useState("")
    const [searchParams, setSearchParams] = useSearchParams();
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [holders, setHolders] = useState<Holder[]>([]);
    const [queriesPerformed, setQueriedPerformed] = useState<number>(0);
    const [pairInfo, setPairInfo] = useState<PairInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null)

    useEffect(() => {
        const address = searchParams.get("address")
        if (address && address !== lastLoadedAddress && module) {
            setContractAddress(address)
            getTokenHolders(address)
        }
    }, [searchParams, lastLoadedAddress, module])

    const setAddress = useCallback(() => {
        setSearchParams({
            address: contractAddress
        })
    }, [setSearchParams, contractAddress])

    useEffect(() => {
        if (!module) {
            setModule(new TokenUtils(MAIN_NET))
        }
    }, [])

    const getTokenHolders = useCallback((address: string) => {
        if (!module) return

        setError(null)
        setLoading(true);
        setTokenInfo(null);
        setPairInfo(null);
        setPairMarketing(null);
        setQueriedPerformed(0);
        setHolders([]);

        module
            .getPairInfo(address)
            .then((r: PairInfo) => {
                console.log(r);
                setPairInfo(r);

                const memeAddress =
                    r.token0Meta.denom === "inj"
                        ? r.token1Meta.denom
                        : r.token0Meta.denom;

                if (
                    memeAddress.includes("factory") ||
                    memeAddress.includes("peggy") ||
                    memeAddress.includes("ibc")
                ) {
                    module
                        .getDenomMetadata(memeAddress)
                        .then((r) => {
                            setTokenInfo(r);
                        })
                        .catch((e: unknown) => {
                            console.log(e);
                        });
                } else {
                    module
                        .getTokenInfo(memeAddress)
                        .then((r: any) => {
                            setTokenInfo(r);
                        })
                        .catch((e: unknown) => {
                            console.log(e);
                        });
                    module.getTokenMarketing(memeAddress).then(r => {
                        console.log(r)
                        setPairMarketing(r)
                    }).catch(e => {
                        console.log(e)
                    })
                }

                const liquidityToken = r.liquidity_token;
                module
                    .getTokenHolders(liquidityToken, setQueriedPerformed)
                    .then((r: Holder[]) => {
                        console.log(r);
                        setHolders(r);
                        setLoading(false);
                    })
                    .catch((e: unknown) => {
                        console.log(e);
                        setLoading(false);
                    });
            })
            .catch((e) => {
                setLoading(false);
                console.log(e);
                setError(e.message)
            });

        setLastLoadedAddress(address)

    }, [module]);

    return (
        <div className="flex flex-col min-h-screen">
            <header className="bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-base">
                    <Link to="/" className="font-bold hover:underline mr-5">
                        home
                    </Link>
                    {/* <Link
                        to="/trippy-distribution"
                        className="font-bold hover:underline mr-5"
                    >
                        $TRIPPY distribution
                    </Link> */}
                    <Link
                        to="/token-holders?address=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
                        className="font-bold hover:underline "
                    >
                        token holder tool
                    </Link>
                </div>
            </header>

            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center w-full py-10">
                    <div className="w-full max-w-screen-xl px-2">
                        <div className="text-center text-white">
                            <div className="text-xl">
                                Get cw20 liquidity token holders
                            </div>
                            <div className="text-xs">on Injective main net</div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label
                                htmlFor="token-address"
                                className="block text-white"
                            >
                                Pair address
                            </label>
                            <input
                                type="text"
                                className="text-black w-full"
                                onChange={(e) =>
                                    setContractAddress(e.target.value)
                                }
                                value={contractAddress}
                            />
                        </div>

                        <button
                            disabled={loading}
                            onClick={setAddress}
                            className="bg-gray-800 rounded p-2 mt-5 w-full text-white border border-white"
                        >
                            Get token liquidity
                        </button>

                        {error && <div className="text-red-500 mt-2">
                            {error}
                        </div>
                        }

                        <div className="flex flex-col md:flex-row justify-between">
                            {tokenInfo && (
                                <div className="mt-5 text-base text-white">
                                    <div>name: {tokenInfo.name}</div>
                                    <div>symbol: {tokenInfo.symbol}</div>
                                    <div>decimals: {tokenInfo.decimals}</div>
                                    {tokenInfo.total_supply && (
                                        <div>
                                            total supply:{" "}
                                            {tokenInfo.total_supply /
                                                Math.pow(10, tokenInfo.decimals)}
                                        </div>
                                    )}
                                </div>
                            )}
                            {pairMarketing && (
                                <div className="mt-5 text-base text-white">
                                    <img
                                        src={pairMarketing.logo.url}
                                        style={{ width: 50, height: 50 }}
                                        className="mb-2"
                                        alt="logo"
                                    />
                                    <div>project: {pairMarketing.project}</div>
                                    <div>description: {pairMarketing.description}</div>
                                    <div>marketing: {pairMarketing.marketing}</div>
                                    
                                </div>
                            )}
                        </div>


                        {pairInfo && (
                            <div className="mt-2 text-white">
                                <div>
                                    pair address: {pairInfo.contract_addr}
                                </div>
                                <div>
                                    liquidity token: {pairInfo.liquidity_token}
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center justify-center pt-5">
                                <GridLoader color="#36d7b7" />
                                <div className="text-sm mt-2">
                                    wallets checked: {queriesPerformed}
                                </div>
                            </div>
                        )}

                        {holders.length > 0 && (
                            <div className="mt-2 overflow-x-auto">
                                <div>Total liquidity holders: {holders.length}</div>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="">
                                        <tr>
                                            <th className="px-4 py-2">
                                                Address
                                            </th>
                                            <th className="px-4 py-2">
                                                Balance
                                            </th>
                                            <th className="px-4 py-2">
                                                Percentage
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="">
                                        {holders.map((holder, index) => (
                                            <tr
                                                key={index}
                                                className="border-b"
                                            >
                                                <td className="px-4 py-1 text-blue-600 flex flex-row items-center">
                                                    <a
                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                    >
                                                        {holder.address}
                                                    </a>
                                                    {holder.address ===
                                                        dojoBurnAddress && (
                                                            <span className="text-red-500 ml-2">
                                                                {" "}
                                                                DOJO BURN ADDY 🔒
                                                            </span>
                                                        )}
                                                    {holder.address ===
                                                        injBurnAddress && (
                                                            <span className="text-red-500 ml-2">
                                                                {" "}
                                                                INJ BURN ADDY 🔒
                                                            </span>
                                                        )}
                                                    {holder.address ==
                                                        "inj1lq9wn94d49tt7gc834cxkm0j5kwlwu4gm65lhe" && (
                                                            <span className="text-green-400 ml-2">
                                                                {" "}
                                                                trippykiwi (dev) 🥷
                                                            </span>
                                                        )}
                                                    {pairInfo && holder.address == pairInfo.contract_addr && (
                                                        <span className="text-blue-400 ml-2">
                                                            {" "}
                                                            pair contract
                                                        </span>
                                                    )}
                                                    {holder.address != dojoBurnAddress && holder.address != injBurnAddress && Number(holder.percentageHeld) > 99 && (
                                                        <span className="text-orange-400 ml-2 flex text-xl">
                                                            <IoIosWarning />
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {holder.balance}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {holder.percentageHeld}%
                                                </td>
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
