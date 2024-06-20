import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader, CircleLoader } from "react-spinners";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, TokenInfo } from "../../types";
import { useSearchParams } from 'react-router-dom';
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";
import IPFSImage from "../../components/App/IpfsImage";
import { WALLET_LABELS } from "../../constants/walletLabels";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { CW404_TOKENS, NFT_COLLECTIONS, TOKENS } from "../../constants/contractAddresses";
import { CSVLink } from 'react-csv';
import HoldersChart from "../../components/App/HoldersChart";

const INJ_CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"

const TokenHolders = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [contractAddress, setContractAddress] = useState(
        searchParams.get("address") ?? TOKENS[0]
    );

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [holders, setHolders] = useState<Holder[]>([]);

    const [hasSplitBalances, setHasSplitBalances] = useState(false)

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState(null)

    const [lastLoadedAddress, setLastLoadedAddress] = useState("")

    const [liquidity, setLiquidity] = useState([])
    const [findingLiq, setFindingLiq] = useState(false)
    const [liqError, setLiqError] = useState(false)

    const [mitoVault, setMitoVault] = useState(null)

    const setAddress = useCallback(() => {
        setSearchParams({
            address: contractAddress.value
        })
    }, [setSearchParams, contractAddress])

    useEffect(() => {
        setLastLoadedAddress("")
    }, [networkConfig])

    const getSpotMarkets = useCallback(async () => {
        console.log("get spot markets")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchSpotMarkets();
            return markets;
        } catch (error) {
            console.error('Failed to fetch spot markets:', error);
            throw error;
        }
    }, [networkConfig]);

    const getMitoVaults = useCallback(async () => {
        console.log("get mito vaults")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchMitoVaults();
            return markets;
        } catch (error) {
            console.error('Failed to fetch mito vaults:', error);
            throw error;
        }
    }, [networkConfig]);

    const findLiquidity = useCallback(async () => {
        let assetInfo = {}
        if (tokenInfo?.denom.includes("factory")) {
            assetInfo = {
                native_token: {
                    denom: tokenInfo.denom
                }
            }
        }
        else {
            assetInfo = {
                token: {
                    contract_addr: tokenInfo.denom
                }
            }
        }
        const module = new TokenUtils(networkConfig);
        setFindingLiq(true)
        try {
            const denom = `factory/${INJ_CW20_ADAPTER}/${tokenInfo.denom}`
            const liquidity = await module.checkForLiquidity(assetInfo)
            const spotMarkets = await getSpotMarkets();
            const mitoVaults = await getMitoVaults();

            const market = spotMarkets.find(market => market.baseDenom.toString() === denom.toString());
            let vault = null
            if (market) {
                vault = mitoVaults.find(vault => vault.marketId.toString() === market.marketId.toString());
            }
            console.log(vault)

            if (liquidity.length == 0) {
                setFindingLiq(false)
                setLiqError(true)
                return
            }

            setLiquidity(liquidity)
            setMitoVault(vault)
            setHolders(prevHolders => prevHolders.map(holder => ({
                ...holder,
                usdValue: Number(holder.balance) * liquidity[0]?.price
            })));
            setFindingLiq(false)
        }
        catch (e) {
            setFindingLiq(false)
            setLiqError(true)
        }

    }, [tokenInfo, networkConfig, getSpotMarkets, getMitoVaults])

    useEffect(() => {
        if (tokenInfo && holders.length > 0 && liquidity.length == 0 && !findingLiq && !liqError) {
            findLiquidity().then(r => {
                console.log("finished getting liq")
            }).catch(e => {
                console.log("error getting liq:", e)
            });
        }
    }, [tokenInfo, holders, findLiquidity, liquidity, findingLiq, liqError]);

    const getTokenHolders = useCallback(async (address: string) => {
        if (loading) return
        if (lastLoadedAddress == address) return
        console.log("get token holders")
        setLoading(true);
        const module = new TokenUtils(networkConfig);
        setError(null);
        setTokenInfo(null);
        setPairMarketing(null);

        setProgress("");
        setHolders([]);
        setLiquidity([])
        setMitoVault(null)
        setFindingLiq(false)
        setLiqError(false)
        setHasSplitBalances(false)

        try {
            const is404 = CW404_TOKENS.find(x => x.value == address) !== undefined
            const isNFT = NFT_COLLECTIONS.find(x => x.value == address) !== undefined

            if (is404) {
                const tokenInfo = await module.getCW404TokenInfo(address);
                setTokenInfo({ ...tokenInfo, denom: address });
                const holders = await module.getCW404Holders(address, setProgress)
                if (holders) setHolders(holders);
            }
            else if (isNFT) {
                const tokenInfo = await module.getNFTCollectionInfo(address)
                const holders = await module.getNFTHolders(address, setProgress)
                setTokenInfo({ ...tokenInfo, denom: address });
                if (holders) setHolders(holders);
            }
            else if (address.includes("factory") || address.includes("peggy") || address.includes("ibc")) {
                const metadata = await module.getDenomExtraMetadata(address);
                setTokenInfo(metadata);
                const tokenHolders = await module.getTokenFactoryTokenHolders(address, setProgress);
                if (tokenHolders) setHolders(tokenHolders);
            }
            else {
                try {
                    const tokenInfo = await module.getTokenInfo(address);
                    setTokenInfo({ ...tokenInfo, denom: address });

                    const marketingInfo = await module.getTokenMarketing(address);
                    setPairMarketing(marketingInfo);

                    const tokenHolders = await module.getCW20TokenHolders(address, setProgress);
                    const bankTokenHolders = await module.getTokenFactoryTokenHolders(`factory/${INJ_CW20_ADAPTER}/${address}`, setProgress)
                    console.log(tokenHolders)
                    console.log(bankTokenHolders)

                    const mergedHolders = {};

                    for (const holder of tokenHolders) {
                        const { address, balance } = holder;
                        if (!mergedHolders[address]) {
                            mergedHolders[address] = { address, cw20Balance: 0, bankBalance: 0, combinedBalance: 0 };
                        }
                        mergedHolders[address].cw20Balance = balance;
                    }
                    for (const holder of bankTokenHolders) {
                        const { address, balance } = holder;
                        if (!mergedHolders[address]) {
                            mergedHolders[address] = { address, cw20Balance: 0, bankBalance: 0, combinedBalance: 0 };
                        }
                        mergedHolders[address].bankBalance = balance / Math.pow(10, tokenInfo.decimals);
                    }
                    for (const address in mergedHolders) {
                        const holder = mergedHolders[address];
                        holder.balance = holder.cw20Balance + holder.bankBalance;
                        holder.percentageHeld = (holder.balance / ((tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)))) * 100;
                    }

                    const mergedList = Object.values(mergedHolders);

                    if (bankTokenHolders?.length > 0) {
                        setHasSplitBalances(true)
                        setHolders(mergedList);
                    }
                    else {
                        setHolders(tokenHolders);
                    }

                } catch (error) {
                    if (error.message.includes("Error parsing into type cw404")) {
                        try {
                            const tokenInfo = await module.getCW404TokenInfo(address);
                            setTokenInfo({ ...tokenInfo, denom: address });
                            const holders = await module.getCW404Holders(address, setProgress)
                            if (holders) setHolders(holders);
                        } catch (innerError) {
                            console.error("Error with CW404 token info retrieval:", innerError);
                        }
                    }
                    else if (error.message.includes("Error parsing into type talis_nft")) {
                        const tokenInfo = await module.getNFTCollectionInfo(address)
                        const holders = await module.getNFTHolders(address, setProgress)
                        setTokenInfo({ ...tokenInfo, denom: address });
                        if (holders) setHolders(holders);
                    }
                    else {
                        console.error("Error with token info retrieval:", error);
                    }
                }
            }

            setLastLoadedAddress(address);
        } catch (e) {
            console.log(e);
            if (e && e.message) {
                setError(e.message);
            }
        } finally {
            setLoading(false);

        }
    }, [loading, lastLoadedAddress, networkConfig]);

    useEffect(() => {
        const address = searchParams.get("address")
        if (address && address !== lastLoadedAddress && !loading) {
            getTokenHolders(address).then(() => console.log("got token holders")).catch(e => console.log(e))
            setContractAddress(address => TOKENS.find(v => v.value == address) ?? address)
        }
    }, [searchParams, lastLoadedAddress, getTokenHolders, loading])

    const headers = [
        { label: "Holder Address", key: "address" },
        { label: "Balance", key: "balance" },
        { label: "Percentage Held", key: "percentageHeld" }
    ];

    return (
        <div className="flex flex-col min-h-screen pb-10">
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-sm">
                    <Link to="/" className="font-bold hover:underline mx-5">
                        home
                    </Link>

                    <Link
                        to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                        className="font-bold hover:underline mr-5"
                    >
                        liquidity tool
                    </Link>
                    <Link
                        to="/manage-tokens"
                        className="font-bold hover:underline "
                    >
                        manage tokens
                    </Link>
                </div>
                <div className="m-2">
                    <ConnectKeplr />
                </div>
            </header>

            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-lg px-2 py-10">
                        <div className="text-center text-white">
                            <div className="text-xl">
                                Get token holders
                            </div>
                            <div className="text-xs">on Injective main net</div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label
                                htmlFor="token-address"
                                className="block text-white"
                            >
                                Token address
                            </label>
                            <TokenSelect
                                options={[
                                    {
                                        label: "CW404",
                                        options: CW404_TOKENS
                                    },
                                    {
                                        label: "TOKENS",
                                        options: TOKENS
                                    },
                                    {
                                        label: "NFT",
                                        options: NFT_COLLECTIONS
                                    }
                                ]}
                                selectedOption={contractAddress}
                                setSelectedOption={setContractAddress}
                            />
                        </div>

                        <button
                            disabled={loading}
                            onClick={setAddress}
                            className="mt-5 bg-gray-800 rounded-lg p-2 w-full text-white border border-slate-800 shadow-lg font-bold"
                        >
                            Get token holders
                        </button>
                        {error && <div className="text-red-500 mt-2">
                            {error}
                        </div>
                        }

                        <div className="flex flex-col md:flex-row justify-between text-sm">
                            {tokenInfo && (
                                <div className="mt-5 text-white">
                                    <div className="font-bold">address: {tokenInfo.denom}</div>
                                    <div>name: {tokenInfo.name}</div>
                                    <div>symbol: {tokenInfo.symbol}</div>
                                    {tokenInfo.decimals && <div>decimals: {tokenInfo.decimals}</div>}
                                    {tokenInfo.description && <div>description: {tokenInfo.description}</div>}
                                    {tokenInfo.total_supply && (
                                        <div>
                                            total supply:{" "}
                                            {tokenInfo.total_supply /
                                                Math.pow(10, tokenInfo.decimals)}
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

                        {holders.length > 0 &&
                            <button onClick={findLiquidity} className="p-1 bg-slate-800 rounded mb-2 px-2 mt-2">
                                {findingLiq ? <div className="text-sm text-center">
                                    <CircleLoader color="white" size={20} />
                                    <div className="mt-1 text-center">Finding liquidity</div>
                                </div> : "Find Liquidity"}
                            </button>
                        }

                        <div className="flex flex-row justify-center mt-5">
                            {liquidity.length > 0 && liquidity.map(({ infoDecoded, marketCap, price, factory, liquidity }, index) => {
                                return <div key={index} className="text-sm mx-2 bg-slate-800 p-2 rounded-lg shadow-lg">
                                    <a href={"https://coinhall.org/injective/" + infoDecoded.contract_addr}
                                        className="text-white hover:cursor-pointer font-bold"
                                    >
                                        pool found on {factory.name}
                                    </a>
                                    <br />
                                    price: ${price.toFixed(10)}
                                    <br />
                                    liquidity: ${liquidity.toFixed(2)}
                                    <br />
                                    market cap: {marketCap.toFixed(2)}
                                    <br />
                                    <Link to={`/token-liquidity?address=${infoDecoded.contract_addr}`} className="font-bold hover:underline mr-5">
                                        view liquidity holders
                                    </Link>

                                </div>
                            })}
                            {mitoVault !== null && tokenInfo &&
                                <div className="text-sm mx-2 bg-slate-800 p-2 rounded-lg shadow-lg">
                                    <a href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}mito.fi/vault/${mitoVault.contractAddress}`}
                                        className="text-white hover:cursor-pointer font-bold"
                                    >
                                        Mito vault found
                                    </a>
                                    <br />
                                    APY: {mitoVault.apy.toFixed(2)}%
                                    <br />
                                    liquidity: ${mitoVault.currentTvl.toFixed(2)}
                                    <br />
                                    {/* lp token price: ${(mitoVault.lpTokenPrice * Math.pow(10, tokenInfo.decimals)).toFixed(4)}
                                    <br /> */}
                                    <Link
                                        className="underline"
                                        target="_blank"
                                        to={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}mito.fi/vault/${mitoVault.contractAddress}`}
                                    >
                                        mito vault url
                                    </Link>
                                    <br />
                                    <Link
                                        className="underline"
                                        target="_blank"
                                        to={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}helixapp.com/spot/?marketId=${mitoVault.marketId}`}
                                    >
                                        helix market url
                                    </Link>
                                </div>
                            }
                        </div>

                        {loading && (
                            <div className="flex flex-col items-center justify-center pt-5">
                                <GridLoader color="#36d7b7" />
                                {progress.length > 0 &&
                                    <div className="mt-2">
                                        {progress}
                                    </div>
                                }
                            </div>
                        )}

                        {holders.length > 0 && (
                            <div className="mt-5 text-sm">
                                <HoldersChart data={holders} />
                                <CSVLink data={holders} headers={headers} filename={"holders.csv"}>
                                    <button className="p-1 bg-slate-800 rounded mb-2">Download Holders CSV</button>
                                </CSVLink>
                                <div>Total token holders: {holders.length}</div>
                                <div className="overflow-x-auto mt-2">
                                    <table className="table-auto w-full">
                                        <thead className="text-white text-left">
                                            <tr>
                                                <th className="px-4 py-2">
                                                    Position
                                                </th>
                                                <th className="px-4 py-2">
                                                    Address
                                                </th>
                                                <th className="px-4 py-2">
                                                    {hasSplitBalances ? "CW20 Balance" : "Balance"}
                                                </th>
                                                {hasSplitBalances &&
                                                    <th className="px-4 py-2">
                                                        Bank Balance
                                                    </th>
                                                }
                                                <th className="px-4 py-2">
                                                    Percentage
                                                </th>
                                                <th className="px-4 py-2">
                                                    USD
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {holders
                                                .filter(
                                                    (holder) =>
                                                        Number(
                                                            holder.balance
                                                        ) !== 0
                                                )
                                                .sort((a, b) => { return b.balance - a.balance })
                                                .map((holder, index) => (
                                                    <tr
                                                        key={index}
                                                        className="text-white border-b text-left"
                                                    >
                                                        <td className="px-6 py-1">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-6 py-1 whitespace-nowrap">
                                                            <a
                                                                className="hover:text-indigo-900"
                                                                href={`https://explorer.injective.network/account/${holder.address}`}
                                                            >
                                                                {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)}
                                                            </a>
                                                            {
                                                                WALLET_LABELS[holder.address] ? (
                                                                    <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                        {WALLET_LABELS[holder.address].label}
                                                                    </span>
                                                                ) : null
                                                            }
                                                            {holder.address ==
                                                                lastLoadedAddress && (
                                                                    <span className="text-red-500 ml-2">
                                                                        {" "}
                                                                        token contract 🔥
                                                                    </span>
                                                                )}
                                                            {liquidity.length > 0 && holder.address == liquidity[0].infoDecoded.contract_addr &&
                                                                <span className="text-blue-500 ml-2">
                                                                    {" "}
                                                                    liquidity pool
                                                                </span>
                                                            }
                                                        </td>
                                                        <td className="px-6 py-1">
                                                            {hasSplitBalances ? holder.cw20Balance.toFixed(2) : holder.balance.toFixed(2)}
                                                        </td>
                                                        {hasSplitBalances &&
                                                            <td className="px-6 py-1">
                                                                {holder.bankBalance.toFixed(2)}
                                                            </td>
                                                        }
                                                        <td className="px-6 py-1">
                                                            {
                                                                holder.percentageHeld.toFixed(2)
                                                            }
                                                            %
                                                        </td>
                                                        <td className="px-6 py-1">
                                                            {
                                                                holder.usdValue?.toFixed(2)
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
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

export default TokenHolders;
