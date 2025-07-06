import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Holder, MarketingInfo, PairInfo, TokenInfo } from "../../constants/types";
import { Link, useSearchParams } from 'react-router-dom';
import { IoIosWarning } from "react-icons/io";
import IPFSImage from "../../components/App/IpfsImage";
import { WALLET_LABELS } from "../../constants/walletLabels";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { CSVLink } from 'react-csv';
import Footer from "../../components/App/Footer";
import useNetworkStore from "../../store/useNetworkStore";
import useLiquidityPoolStore from "../../store/usePoolStore";

import choicelogo from "../../assets/choice.svg"
import dojologo from "../../assets/dojo.svg"
import whitewhale from "../../assets/whitewhale.svg"
import PoolReserves from "../../components/App/PoolReserves";
import { formatNumber } from "../../utils/helpers";
import { CHOICE_FACTORY } from "../../constants/contractAddresses";


const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

const TokenLiquidity = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const { pools } = useLiquidityPoolStore()

    const [selectedPool, setSelectedPool] = useState(pools.find(x => x.contract_addr == "inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5") ?? null);

    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [contractAddress, setContractAddress] = useState(
        pools.filter(p => p.liquidity_token !== null).map((p) => {
            return {
                value: p.contract_addr,
                label: `${p.asset_1.symbol}/${p.asset_2.symbol} (${p.dex.name})`,
                img: p.asset_1.icon,
            }
        }).find(x => x.value == searchParams.get("address") ?? "inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5")
    );

    const [lastLoadedAddress, setLastLoadedAddress] = useState("")
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [holders, setHolders] = useState<Holder[]>([]);
    const [progress, setProgress] = useState<string>("");
    const [pairInfo, setPairInfo] = useState<PairInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);
    const [liquidityToken, setLiquidityToken] = useState(null);

    const [poolReserves, setPoolReserves] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null)


    useEffect(() => {
        if (contractAddress && contractAddress.value) {
            setSelectedPool(null)
            setSearchParams({
                address: contractAddress.value
            })
        }

    }, [contractAddress, setSearchParams])

    useEffect(() => {
        setLastLoadedAddress("")
        setSelectedPool(null);
    }, [networkConfig])

    const getTokenHolders = useCallback(async (address: string) => {
        if (loading) return
        const module = new TokenUtils(networkConfig);
        setError(null);
        setLoading(true);
        setTokenInfo(null);
        setPairInfo(null);
        setPairMarketing(null);
        setProgress("");
        setHolders([]);

        try {
            const pairInfo = await module.getPairInfo(address);
            console.log(pairInfo)
            setPairInfo(pairInfo);
            setSelectedPool(pools.find(x => x.contract_addr == address) ?? null);

            try {
                const reserves = await module.getPoolAmounts(address);
                console.log(reserves)
                setPoolReserves(reserves)
            }
            catch (e) {
                console.log("Error getting pool reserves", e);
                setPoolReserves(null);
            }

            const memeAddress =
                pairInfo.token0Meta.denom === "inj"
                    ? pairInfo.token1Meta.denom
                    : pairInfo.token0Meta.denom;

            try {
                if (memeAddress.includes("factory") || memeAddress.includes("peggy") || memeAddress.includes("ibc") || memeAddress == "inj") {
                    const denomMetadata = await module.getDenomExtraMetadata(memeAddress);
                    console.log(denomMetadata)
                    setTokenInfo(denomMetadata);
                } else {
                    const tokenInfo = await module.getTokenInfo(memeAddress);
                    setTokenInfo({ ...tokenInfo, denom: memeAddress });

                    const marketingInfo = await module.getTokenMarketing(memeAddress);
                    setPairMarketing(marketingInfo);
                }
            } catch (innerError) {
                console.log(innerError);
            }

            const liquidityToken = pairInfo.liquidity_token;
            let liqAddress = pairInfo.liquidity_token
            if (liquidityToken.native_token) {
                liqAddress = liquidityToken.native_token.denom
            }
            if (liquidityToken.token) {
                liqAddress = liquidityToken.token.contract_addr
            }
            setLiquidityToken(liqAddress)
            if (liqAddress.includes("factory/")) {
                const holders = await module.getTokenFactoryTokenHolders(liqAddress, setProgress);
                setHolders(holders);
            }
            else {
                const holders = await module.getCW20TokenHolders(liqAddress, setProgress);
                setHolders(holders);
            }

        } catch (e) {
            console.log(e);
            if (e && e.message) {
                setError(e.message);
            }
        } finally {
            setLoading(false);
            setLastLoadedAddress(address);
        }
    }, [networkConfig, loading, pools]);

    useEffect(() => {
        const address = searchParams.get("address")
        if (address && address !== lastLoadedAddress) {
            getTokenHolders(address)
            setContractAddress(address => pools.map((p) => {
                return {
                    value: p.contract_addr,
                    label: `${p.asset_1.symbol}/${p.asset_2.symbol} (${p.dex.name})`,
                    img: p.asset_1.icon,
                }
            }).find(v => v.value == address) ?? address)
        }
    }, [searchParams, lastLoadedAddress, getTokenHolders, pools])

    const renderDex = (pool) => {
        let link
        if (pool.dex.name == 'Choice') {
            link = `https://choice.exchange/swap?input=${pool.asset_1.address}&output=${pool.asset_2.address}`
        }
        if (pool.dex.name == 'DojoSwap') {
            link = `https://coinhall.org/injective/${pool.contract_addr}`
        }
        if (pool.dex.name == 'White Whale') {
            link = `https://coinhall.org/injective/${pool.contract_addr}`
        }
        return (
            <Link to={link} >
                <div className="items-center underline">
                    DEX: {pool.dex.name}
                    {pool.dex.name == 'Choice' && <img src={choicelogo} alt="Choice Logo" className="inline-block ml-2" style={{ width: 20, height: 20 }} />}
                    {pool.dex.name == 'DojoSwap' && <img src={dojologo} alt="Dojo Logo" className="inline-block ml-2" style={{ width: 20, height: 20 }} />}
                    {pool.dex.name == 'White Whale' && <img src={whitewhale} alt="White Whale Logo" className="inline-block ml-2" style={{ width: 20, height: 20 }} />}
                </div>
            </Link>

        )
    }

    const headers = [
        { label: "Holder Address", key: "address" },
        { label: "Balance", key: "balance" },
        { label: "Percentage Held", key: "percentageHeld" }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-customGray">
            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center w-full py-10">
                    <div className="w-full max-w-screen-lg px-2">
                        <div className="text-center text-white font-magic">
                            <div className="text-3xl">
                                Liquidity holders
                            </div>
                            <div className="text-lg">on Injective main net</div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label
                                htmlFor="token-address"
                                className="block text-white"
                            >
                                Pair address
                            </label>
                            <TokenSelect
                                options={
                                    pools.filter(p => p.liquidity_token !== null).sort((a, b) => {
                                        const aChoice = a.dex.factory_address === CHOICE_FACTORY;
                                        const bChoice = b.dex.factory_address === CHOICE_FACTORY;

                                        if (aChoice === bChoice) {
                                            // same class → fall back to a secondary sort (e.g. pair symbol)
                                            return `${a.asset_1.symbol}/${a.asset_2.symbol}`.localeCompare(
                                                `${b.asset_1.symbol}/${b.asset_2.symbol}`
                                            );
                                        }
                                        // Choice pools first
                                        return aChoice ? -1 : 1;
                                    }).map((p) => {
                                        return {
                                            value: p.contract_addr,
                                            label: `${p.asset_1.symbol}/${p.asset_2.symbol} (${p.dex.name})`,
                                            img: p.asset_1.icon,
                                        }
                                    })
                                }
                                selectedOption={contractAddress}
                                setSelectedOption={setContractAddress}
                            />
                        </div>

                        {/* <button
                            disabled={loading}
                            onClick={setAddress}
                            className="bg-gray-800 hover:bg-gray-900 rounded-lg p-2 mt-5 w-full text-white border border-slate-800 shadow-lg font-bold"
                        >
                            Get token liquidity
                        </button> */}

                        {error && <div className="text-red-500 mt-2">
                            {error}
                        </div>}

                        <div className="flex flex-col md:flex-row justify-between">

                            {tokenInfo && (
                                <div className="mt-5 text-sm text-white">
                                    <div className="text-xl">Token Info</div>

                                    <div>name: {tokenInfo.name}</div>
                                    <div>symbol: {tokenInfo.symbol}</div>
                                    <div>decimals: {tokenInfo.decimals}</div>
                                    {tokenInfo.total_supply && (
                                        <div>
                                            total supply:{" "}
                                            {formatNumber(tokenInfo.total_supply /
                                                Math.pow(10, tokenInfo.decimals))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {!pairMarketing && tokenInfo && tokenInfo.logo && (
                                <div className="mt-5 text-sm text-white">
                                    <IPFSImage
                                        width={100}
                                        className={'mb-2 rounded-lg'}
                                        ipfsPath={tokenInfo.logo}

                                    />
                                    <a href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}explorer.injective.network/account/${tokenInfo.admin}`}>
                                        admin: {tokenInfo.admin.slice(0, 5) + '...' + tokenInfo.admin.slice(-5)}
                                        {
                                            WALLET_LABELS[tokenInfo.admin] ? (
                                                <span className={`${WALLET_LABELS[tokenInfo.admin].bgColor} ${WALLET_LABELS[tokenInfo.admin].textColor} ml-2`}>
                                                    {WALLET_LABELS[tokenInfo.admin].label}
                                                </span>
                                            ) : null
                                        }
                                    </a>
                                </div>
                            )}
                            {pairMarketing && pairMarketing.logo && (
                                <div className="mt-5 text-sm text-white">

                                    <img
                                        src={pairMarketing.logo.url}
                                        style={{ width: 50, height: 50 }}
                                        className="mb-2"
                                        alt="logo"
                                    />
                                    <div>project: {pairMarketing.project}</div>
                                    <div>description: {pairMarketing.description}</div>
                                    <div>
                                        marketing: {pairMarketing.marketing}
                                        {
                                            WALLET_LABELS[pairMarketing.marketing] ? (
                                                <span className={`${WALLET_LABELS[pairMarketing.marketing].bgColor} ${WALLET_LABELS[pairMarketing.marketing].textColor} ml-2`}>
                                                    {WALLET_LABELS[pairMarketing.marketing].label}
                                                </span>
                                            ) : null
                                        }
                                    </div>

                                </div>
                            )}
                        </div>
                        {/* {pairInfo && <div className="mt-6 md:mt-0"><a href={"https://coinhall.org/injective/" + pairInfo.contract_addr}
                            className="bg-gray-800 rounded-lg p-2 text-white border border-slate-800 shadow-lg font-bold "
                        >
                            Trade on coinhall
                        </a></div>
                        } */}

                        {pairInfo && (
                            <div className="mt-4 text-white text-sm">
                                <div className="text-xl">Liquidity Info</div>

                                {selectedPool &&
                                    <div>
                                        {renderDex(selectedPool)}
                                    </div>

                                }
                                <div>
                                    pair address: {pairInfo.contract_addr}
                                </div>
                                <div>
                                    liquidity token: {liquidityToken}
                                </div>
                            </div>
                        )}

                        {poolReserves && selectedPool && (
                            <div className="mt-4">
                                <PoolReserves
                                    reserves={poolReserves}
                                    pool={selectedPool}
                                />
                            </div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center justify-center pt-5">
                                <GridLoader color="#f9d73f" />
                                {progress.length > 0 && <div className="text-sm mt-2">
                                    {progress}
                                </div>
                                }
                            </div>
                        )}
                        {!loading && holders.length == 0 && lastLoadedAddress &&
                            <div className="mt-10 text-center">
                                no liquidity yet
                            </div>
                        }
                        {holders.length > 0 && (
                            <div className="mt-2 overflow-x-auto text-sm">
                                <CSVLink data={holders} headers={headers} filename={"holders.csv"}>
                                    <button className="p-2 bg-gray-800 hover:bg-gray-900 rounded mb-2 mt-2 font-semibold">Download CSV</button>
                                </CSVLink>
                                <div>Total liquidity holders: {holders.length}</div>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="">
                                        <tr>
                                            <th className="px-4 py-2">
                                                Position
                                            </th>
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
                                                <td className="px-6 py-1">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-1 text-blue-600 flex flex-row items-center">
                                                    <a
                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                    >
                                                        {holder.address}
                                                    </a>
                                                    {
                                                        WALLET_LABELS[holder.address] ? (
                                                            <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                {WALLET_LABELS[holder.address].label}
                                                            </span>
                                                        ) : null
                                                    }

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
                                                    {formatNumber(holder.balance)}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {holder.percentageHeld.toFixed(2)}%
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

            <Footer />
        </div>
    );
};

export default TokenLiquidity;
