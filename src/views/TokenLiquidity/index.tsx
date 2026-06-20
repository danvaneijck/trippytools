import { useCallback, useEffect, useMemo, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Holder, MarketingInfo, PairInfo, TokenInfo } from "../../constants/types";
import { Link, useSearchParams } from 'react-router-dom';
import { IoIosWarning } from "react-icons/io";
import { gql, useQuery } from "@apollo/client";
import IPFSImage from "../../components/App/IpfsImage";
import { WALLET_LABELS } from "../../constants/walletLabels";
import TokenSelect from "../../components/Inputs/TokenSelect";
import Footer from "../../components/App/Footer";
import useNetworkStore from "../../store/useNetworkStore";
import useLiquidityPoolStore from "../../store/usePoolStore";
import useTokenStore from "../../store/useTokenStore";
import choiceClient from "../../utils/choiceApolloClient";

import choicelogo from "../../assets/choice.svg"
import dojologo from "../../assets/dojo.svg"
import whitewhale from "../../assets/whitewhale.svg"
import PoolReserves from "../../components/App/PoolReserves";
import { formatNumber } from "../../utils/helpers";
import { shortAddress } from "../../utils/format";
import { arrayToCsv, downloadCsv } from "../../utils/csv";
import { CHOICE_FACTORY } from "../../constants/contractAddresses";
import { evmAddressUrl, injToEvm } from "../../utils/evm";
import { PANEL } from "../ShroomHub/styles";
import { SectionHeader, StatTile } from "../ShroomHub/ui";

const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";
const DEFAULT_POOL = "inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5";
const BTN =
    "rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40";

// Full pool list straight from the Choice API so the search covers every pool
// (not just the price-tracked subset the global store preloads).
const POOLS_QUERY = gql`
    query LiquiditySearchPools {
        liquidity_liquiditypool {
            contract_addr
            dex {
                name
                factory_address
            }
            liquidity_token {
                address
            }
            asset_1 {
                address
                symbol
                logo
            }
            asset_2 {
                address
                symbol
                logo
            }
        }
    }
`;

interface PoolOption {
    value: string;
    label: string;
    img?: string;
}

// Choice pools sort to the top, then alphabetically by pair — matches the old
// store-backed ordering.
const sortPools = (a: any, b: any): number => {
    const aChoice = a.dex?.factory_address === CHOICE_FACTORY;
    const bChoice = b.dex?.factory_address === CHOICE_FACTORY;
    if (aChoice === bChoice) {
        return `${a.asset_1.symbol}/${a.asset_2.symbol}`.localeCompare(
            `${b.asset_1.symbol}/${b.asset_2.symbol}`,
        );
    }
    return aChoice ? -1 : 1;
};

const toOption = (p: any): PoolOption => ({
    value: p.contract_addr,
    label: `${p.asset_1.symbol}/${p.asset_2.symbol} (${p.dex.name})`,
    img: p.asset_1.logo ?? p.asset_1.icon,
});

const TokenLiquidity = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const { pools } = useLiquidityPoolStore()
    const { tokens } = useTokenStore()

    const [selectedPool, setSelectedPool] = useState(pools.find(x => x.contract_addr == DEFAULT_POOL) ?? null);

    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    // Live, full pool list from Choice for the search dropdown.
    const { data: poolData } = useQuery(POOLS_QUERY, {
        client: choiceClient,
        fetchPolicy: "cache-and-network",
    });

    const poolOptions = useMemo<PoolOption[]>(() => {
        const source: any[] = poolData?.liquidity_liquiditypool?.length
            ? poolData.liquidity_liquiditypool
            : pools;
        return source
            .filter((p) => p.liquidity_token !== null && p.asset_1 != null && p.asset_2 != null)
            .slice()
            .sort(sortPools)
            .map(toOption);
    }, [poolData, pools]);

    const [contractAddress, setContractAddress] = useState<PoolOption | undefined>(
        () => poolOptions.find(x => x.value == (searchParams.get("address") ?? DEFAULT_POOL)),
    );

    const [lastLoadedAddress, setLastLoadedAddress] = useState("")
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [holders, setHolders] = useState<Holder[]>([]);
    const [progress, setProgress] = useState<string>("");
    const [pairInfo, setPairInfo] = useState<PairInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);
    const [liquidityToken, setLiquidityToken] = useState(null);

    const [poolReserves, setPoolReserves] = useState(null);

    // ERC-20 the underlying (non-INJ) token is paired with on the EVM, if any.
    const [erc20Pair, setErc20Pair] = useState<string | null>(null);
    // Show LP-holder addresses in their EVM (0x) form.
    const [showEvm, setShowEvm] = useState(false);

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
        setErc20Pair(null);

        try {
            const pairInfo = await module.getPairInfo(address);
            setPairInfo(pairInfo);
            setSelectedPool(pools.find(x => x.contract_addr == address) ?? null);

            try {
                const reserves = await module.getPoolAmounts(address);
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
                    setTokenInfo(denomMetadata as TokenInfo);
                    setErc20Pair(await module.getErc20Pair(memeAddress));
                } else {
                    const tokenInfo = await module.getTokenInfo(memeAddress);
                    setTokenInfo({ ...tokenInfo, denom: memeAddress } as TokenInfo);

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
            if (e && (e as any).message) {
                setError((e as any).message);
            }
        } finally {
            setLoading(false);
            setLastLoadedAddress(address);
        }
    }, [networkConfig, loading, pools]);

    useEffect(() => {
        const address = searchParams.get("address")
        if (address && address !== lastLoadedAddress) {
            void getTokenHolders(address)
            setContractAddress(poolOptions.find(v => v.value == address) ?? { value: address, label: address })
        }
    }, [searchParams, lastLoadedAddress, getTokenHolders, poolOptions])

    const renderDex = (pool: any) => {
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
            <Link to={link as string} className="inline-flex items-center underline">
                DEX: {pool.dex.name}
                {pool.dex.name == 'Choice' && <img src={choicelogo} alt="Choice Logo" className="ml-2 inline-block" style={{ width: 20, height: 20 }} />}
                {pool.dex.name == 'DojoSwap' && <img src={dojologo} alt="Dojo Logo" className="ml-2 inline-block" style={{ width: 20, height: 20 }} />}
                {pool.dex.name == 'White Whale' && <img src={whitewhale} alt="White Whale Logo" className="ml-2 inline-block" style={{ width: 20, height: 20 }} />}
            </Link>
        )
    }

    const downloadHoldersCsv = () => {
        const rows = holders.map(h => ({
            "Holder Address": h.address,
            "Balance": h.balance,
            "Percentage Held": h.percentageHeld,
        }));
        downloadCsv("holders.csv", arrayToCsv(rows, ["Holder Address", "Balance", "Percentage Held"]));
    };

    // Prefer Choice's registry logo over raw on-chain metadata (often a dead
    // IPFS link). CW20 marketing logos are kept as a final fallback.
    const choiceLogo = tokens.find((t) => t.address === tokenInfo?.denom)?.icon;
    const logoSrc = choiceLogo || tokenInfo?.logo || pairMarketing?.logo?.url || null;

    return (
        <div className="flex min-h-screen flex-col bg-customGray text-stone-100">
            <div className="mx-auto w-full max-w-5xl space-y-4 px-3 pt-20 pb-16 sm:px-5 md:space-y-5 md:pt-24">
                {/* ---- title ---- */}
                <div className="text-center">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                        Injective mainnet
                    </div>
                    <h1 className="font-magic text-3xl text-white md:text-4xl">Liquidity holders</h1>
                </div>

                {/* ---- search ---- */}
                <section className={`${PANEL} p-5 md:p-6`}>
                    <label htmlFor="token-address" className="mb-2 block font-sans text-sm text-white/60">
                        Pair address
                    </label>
                    <TokenSelect
                        options={poolOptions}
                        selectedOption={contractAddress}
                        setSelectedOption={setContractAddress}
                    />
                    {error && <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 font-sans text-sm text-red-400">
                        {error}
                    </div>}
                </section>

                {/* ---- token + pair overview ---- */}
                {(tokenInfo || pairInfo) && (
                    <section className={`${PANEL} p-5 md:p-6`}>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                            {logoSrc &&
                                <IPFSImage
                                    width={88}
                                    className="shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                                    ipfsPath={logoSrc}
                                />
                            }
                            <div className="min-w-0 flex-1 font-sans text-sm text-white/65">
                                {tokenInfo && (
                                    <>
                                        <div className="flex flex-wrap items-baseline gap-x-2">
                                            <span className="text-2xl font-semibold text-white">{tokenInfo.name}</span>
                                            {tokenInfo.symbol &&
                                                <span className="text-lg text-white/45">{tokenInfo.symbol}</span>
                                            }
                                        </div>
                                        {erc20Pair && (
                                            <div className="mt-1">
                                                ERC-20:{" "}
                                                <a
                                                    className="break-all text-emerald-400 underline"
                                                    target="_blank"
                                                    href={evmAddressUrl(currentNetwork, erc20Pair)}
                                                >
                                                    {shortAddress(erc20Pair)}
                                                </a>
                                                <span className="block text-xs text-white/40">paired on Injective EVM</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                {pairMarketing && (
                                    <div className="mt-2 space-y-0.5">
                                        {pairMarketing.project && <div>project: <span className="text-white/85">{pairMarketing.project}</span></div>}
                                        {pairMarketing.description && <div>{pairMarketing.description}</div>}
                                        {pairMarketing.marketing &&
                                            <div>
                                                marketing: {shortAddress(pairMarketing.marketing)}
                                                {(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing] && (
                                                    <span className={`${(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].bgColor} ${(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].textColor} ml-2`}>
                                                        {(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].label}
                                                    </span>
                                                )}
                                            </div>
                                        }
                                    </div>
                                )}
                                {!pairMarketing && tokenInfo?.admin && (
                                    <div className="mt-2">
                                        <a className="underline" href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}explorer.injective.network/account/${tokenInfo.admin}`}>
                                            admin: {shortAddress(tokenInfo.admin)}
                                            {(WALLET_LABELS as Record<string, any>)[tokenInfo.admin] && (
                                                <span className={`${(WALLET_LABELS as Record<string, any>)[tokenInfo.admin].bgColor} ${(WALLET_LABELS as Record<string, any>)[tokenInfo.admin].textColor} ml-2`}>
                                                    {(WALLET_LABELS as Record<string, any>)[tokenInfo.admin].label}
                                                </span>
                                            )}
                                        </a>
                                    </div>
                                )}
                                {selectedPool && (
                                    <div className="mt-2">{renderDex(selectedPool)}</div>
                                )}
                            </div>
                        </div>

                        {/* stat tiles */}
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {tokenInfo && <StatTile label="Decimals" value={tokenInfo.decimals ?? "—"} />}
                            {tokenInfo?.total_supply != null && (
                                <StatTile
                                    label="Total supply"
                                    value={formatNumber(tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals))}
                                />
                            )}
                            {pairInfo && <StatTile label="Pair address" value={shortAddress(pairInfo.contract_addr)} />}
                            {liquidityToken && <StatTile label="LP token" value={shortAddress(liquidityToken)} />}
                        </div>

                        {poolReserves && selectedPool && (
                            <div className="mt-4">
                                <PoolReserves
                                    reserves={poolReserves}
                                    pool={selectedPool}
                                />
                            </div>
                        )}
                    </section>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-10">
                        <GridLoader color="#f9d73f" />
                        {progress.length > 0 && <div className="mt-3 font-sans text-sm text-white/60">{progress}</div>}
                    </div>
                )}

                {!loading && holders.length == 0 && lastLoadedAddress &&
                    <div className="py-10 text-center font-sans text-white/50">no liquidity yet</div>
                }

                {/* ---- LP holders ---- */}
                {holders.length > 0 && (
                    <section className={`${PANEL} p-5 md:p-6`}>
                        <SectionHeader
                            eyebrow="Providers"
                            title="Liquidity holders"
                            sub={`${holders.length.toLocaleString()} total`}
                        >
                            <div className="flex flex-wrap items-center gap-3 font-sans">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
                                    <input type="checkbox" className="accent-trippyYellow" checked={showEvm} onChange={(e) => setShowEvm(e.target.checked)} />
                                    EVM (0x) addresses
                                </label>
                                <button onClick={downloadHoldersCsv} className={BTN}>Download CSV</button>
                            </div>
                        </SectionHeader>

                        <div className="overflow-x-auto font-sans text-sm">
                            <div className="grid min-w-150 grid-cols-[3rem_1fr_8rem_6rem] gap-4 border-b border-white/10 pb-2 text-[11px] uppercase tracking-wide text-white/50">
                                <div>#</div>
                                <div>{showEvm ? "EVM Address" : "Address"}</div>
                                <div className="text-right">Balance</div>
                                <div className="text-right">Percentage</div>
                            </div>
                            {holders.map((holder, index) => {
                                // inj1 and 0x are the same account — show whichever the toggle asks for.
                                const evmAddr = showEvm ? injToEvm(holder.address) : null;
                                const label = (WALLET_LABELS as Record<string, any>)[holder.address];
                                return (
                                    <div
                                        key={index}
                                        className="grid min-w-150 grid-cols-[3rem_1fr_8rem_6rem] items-center gap-4 border-b border-white/5 py-1.5 text-white/90 hover:bg-white/5"
                                    >
                                        <div className="text-white/50">{index + 1}</div>
                                        <div className="flex flex-row items-center overflow-hidden">
                                            <a
                                                className="truncate text-sky-400 hover:text-sky-300"
                                                target="_blank"
                                                href={evmAddr ? evmAddressUrl(currentNetwork, evmAddr) : `https://explorer.injective.network/account/${holder.address}`}
                                            >
                                                {evmAddr ?? shortAddress(holder.address)}
                                            </a>
                                            {label && (
                                                <span className={`${label.bgColor} ${label.textColor} ml-2`}>
                                                    {label.label}
                                                </span>
                                            )}
                                            {pairInfo && holder.address == pairInfo.contract_addr && (
                                                <span className="ml-2 text-sky-300">pair contract</span>
                                            )}
                                            {holder.address != dojoBurnAddress && holder.address != injBurnAddress && Number(holder.percentageHeld) > 99 && (
                                                <span className="ml-2 flex text-xl text-orange-400">
                                                    <IoIosWarning />
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right tabular-nums">{formatNumber(holder.balance as number)}</div>
                                        <div className="text-right tabular-nums">{holder.percentageHeld.toFixed(2)}%</div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            <Footer />
        </div>
    );
};

export default TokenLiquidity;
