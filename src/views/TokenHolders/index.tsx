import { useCallback, useEffect, useMemo, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, TokenInfo } from "../../constants/types";
import { useSearchParams } from 'react-router-dom';
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";
import IPFSImage from "../../components/App/IpfsImage";
import { WALLET_LABELS } from "../../constants/walletLabels";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { CW404_TOKENS, NFT_COLLECTIONS, TOKENS } from "../../constants/contractAddresses";
import { CSVLink } from 'react-csv';
import HoldersChart from "../../components/App/HoldersChart";
import { MdWarning } from "react-icons/md";
import Footer from "../../components/App/Footer";
import { humanReadableAmount } from "../../utils/helpers";
import { gql, useMutation, useQuery } from "@apollo/client";
import moment from "moment";
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GrStatusUnknown } from "react-icons/gr";
import TokenHoldersTable from "./TokenHolderTable";
import Header from "../../components/App/Header";

const INJ_CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";


const HOLDER_QUERY = gql`
query getTokenHolders($address: String!, $addresses: [String!], $balanceMin: float8) {
  token_info:token_tracker_token_by_pk(address: $address){
    address
    name
    symbol
    total_supply
    circulating_supply
    decimals
    holders_last_updated
  }
  holders: wallet_tracker_balance(where: {token_id: {_in: $addresses}, balance: { _gt: $balanceMin }}, order_by: {balance:desc}) {
    wallet_id
    balance
    percentage_held
    token_id
  }
  holder_aggregate: wallet_tracker_balance_aggregate(
    where: {
      token_id: { _in: $addresses }
      balance: { _gt: 0 } 
    }
  ) {
    aggregate {
      count
    }
  }
}
`

const UPDATE_TOKEN_HOLDERS_MUTATION = gql`
mutation updateTokenHolders($address: String!){
  updateTokenHolders(address: $address){
    success
  }
}
`

const ITEMS_PER_PAGE = 50;

const TokenHolders = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [contractAddress, setContractAddress] = useState(() => {
        const address = searchParams.get("address");
        if (!address) {
            return TOKENS[0];
        }
        return TOKENS.find(x => x.value === address) || { label: address, value: address };
    });

    const { data, loading: queryLoading } = useQuery(HOLDER_QUERY, {
        skip: !contractAddress || !contractAddress.value,
        pollInterval: 60000,
        variables: {
            address: contractAddress?.value || "",
            addresses: contractAddress ? [
                contractAddress.value,
                `factory/${INJ_CW20_ADAPTER}/${contractAddress.value}`
            ] : [],
            balanceMin: contractAddress && contractAddress.value == "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt" ? 1 : 0,
        }
    });

    const [updateTokenHolders] = useMutation(UPDATE_TOKEN_HOLDERS_MUTATION)

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [holders, setHolders] = useState<Holder[]>([]);
    const [totalHolderCount, setTotalHolderCount] = useState(null)
    const [hasSplitBalances, setHasSplitBalances] = useState(false)

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState(null)

    const [lastLoadedAddress, setLastLoadedAddress] = useState("")
    const [holdersLastUpdated, setHoldersLastUpdated] = useState(null)

    const [liquidity, setLiquidity] = useState([])
    const [findingLiq, setFindingLiq] = useState(false)
    const [liqError, setLiqError] = useState(false)
    const [totalBurned, setTotalBurned] = useState(null)
    const [totalTreasuryHoldings, setTotalTreasuryHoldings] = useState(null)

    const [mitoVault, setMitoVault] = useState(null)
    const [tokenPrice, setTokenPrice] = useState(null)

    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("");

    const startIndex = useMemo(() => {
        return (currentPage - 1) * ITEMS_PER_PAGE;
    }, [currentPage]);

    const endIndex = useMemo(() => {
        return startIndex + ITEMS_PER_PAGE;
    }, [startIndex]);

    const paginatedHolders = useMemo(() => {
        return holders
            .slice(startIndex, endIndex);
    }, [holders, startIndex, endIndex]);

    const totalPages = useMemo(() => {
        return Math.ceil(holders.length / ITEMS_PER_PAGE);
    }, [holders.length]);


    const handlePageInput = (e) => {
        const value = e.target.value;
        if (value === "" || /^[0-9\b]+$/.test(value)) {
            setPageInput(value);
        }
    };

    const goToPage = (e) => {
        e.preventDefault();
        const pageNumber = parseInt(pageInput, 10);
        if (!isNaN(pageNumber) && pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
        setPageInput("");
    };

    useEffect(() => {
        if (contractAddress) {
            setSearchParams({
                address: contractAddress.value ? contractAddress.value : contractAddress
            })
        }
    }, [contractAddress, setSearchParams])

    useEffect(() => {
        console.log("clear last loaded address")
        setLastLoadedAddress("")
    }, [networkConfig])

    const handleUpdateTokenHolders = useCallback(() => {
        updateTokenHolders({
            variables: {
                address: contractAddress.value ? contractAddress.value : contractAddress
            }
        }).then(r => {
            console.log(r)
            toast.success('Request sent to update holders. May take a few minutes...', {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                transition: Bounce,
            });
        }).catch(e => {
            console.log(e)
        })
    }, [contractAddress, updateTokenHolders])

    useEffect(() => {
        if (!data) return;

        const BURN_ADDRESSES = [
            dojoBurnAddress,
            injBurnAddress,
        ]

        if (data.token_info && data.token_info.address) {
            BURN_ADDRESSES.push(data.token_info.address)
            setHoldersLastUpdated(data.token_info.holders_last_updated)
        }
        else {
            setHoldersLastUpdated(null)
        }

        const balances = data.holders;
        const tokenIds = new Set(balances.map(holder => holder.token_id));

        if (tokenIds.size === 2) {
            setHasSplitBalances(true);
        } else {
            setHasSplitBalances(false);
        }

        const groupedByWallet = balances.reduce((acc, holder) => {
            if (!acc[holder.wallet_id]) {
                acc[holder.wallet_id] = {
                    cw20Balance: 0,
                    bankBalance: 0,
                    totalBalance: 0,
                    hasBothTokens: false,
                    wallet_id: holder.wallet_id
                };
            }
            const isFactoryToken = holder.token_id.includes("factory");
            const balanceValue = parseFloat(holder.balance);
            if (isFactoryToken) {
                acc[holder.wallet_id].bankBalance += balanceValue; // Accumulate bankBalance
            } else {
                acc[holder.wallet_id].cw20Balance += balanceValue; // Accumulate cw20Balance
            }
            if (acc[holder.wallet_id].cw20Balance > 0 && acc[holder.wallet_id].bankBalance > 0) {
                acc[holder.wallet_id].hasBothTokens = true;
            }
            return acc;
        }, {});

        let totalSupply = Object.values(groupedByWallet).reduce((sum, holder) => {
            if (holder.wallet_id === INJ_CW20_ADAPTER) {
                return sum + 0; // Only include cw20Balance, exclude factory token balance
            }
            return sum + (holder.cw20Balance + holder.bankBalance);

        }, 0);
        totalSupply = Math.round(totalSupply)

        const finalHolderList = Object.entries(groupedByWallet).map(([wallet_id, holder]) => {
            return {
                address: wallet_id,
                balance: holder.cw20Balance + holder.bankBalance,  // Total combined balance
                percentageHeld: (holder.cw20Balance + holder.bankBalance) / totalSupply * 100,
                cw20Balance: holder.cw20Balance ? holder.cw20Balance : 0,
                bankBalance: holder.bankBalance ? holder.bankBalance : 0,
                usdValue: tokenPrice ? Number(holder.cw20Balance + holder.bankBalance) * tokenPrice : null
            };
        }).filter(x => x.balance !== 0).sort((a, b) => b.balance - a.balance)

        setHolders(finalHolderList);
        console.log("set holders list")
        if (tokenIds.size === 1) {
            setTotalHolderCount(data.holder_aggregate.aggregate.count)
        }
        else {
            setTotalHolderCount(finalHolderList.length)
        }

        const totalBurnedBalance = finalHolderList
            .filter(addressObj => BURN_ADDRESSES.includes(addressObj.address))
            .reduce((total, addressObj) => {
                return total + addressObj.balance;
            }, 0);

        setTotalBurned(totalBurnedBalance)

        const totalTreasuryHoldings = finalHolderList
            .filter(addressObj => WALLET_LABELS[addressObj.address]?.treasury)
            .reduce((total, addressObj) => {
                return total + addressObj.balance;
            }, 0);

        if (data.token_info.address == "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt") {
            setTotalTreasuryHoldings(totalTreasuryHoldings);
        }
        else {
            setTotalTreasuryHoldings(0)
        }
    }, [data, tokenPrice]);

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

    const findLiquidity = useCallback(async (signal) => {
        let assetInfo = {};
        if (tokenInfo?.denom.includes("factory")) {
            assetInfo = {
                native_token: {
                    denom: tokenInfo.denom
                }
            };
        } else {
            assetInfo = {
                token: {
                    contract_addr: tokenInfo.denom
                }
            };
        }
        const module = new TokenUtils(networkConfig);
        setFindingLiq(true);

        try {
            let denom = tokenInfo.denom;
            if (!denom.includes("factory")) {
                denom = `factory/${INJ_CW20_ADAPTER}/${tokenInfo.denom}`;
            }

            console.log("Fetching spot markets and mito vaults...");
            const [spotMarkets, mitoVaults] = await Promise.all([
                getSpotMarkets(),
                getMitoVaults()
            ]);

            console.log("Matching spot market to vault");

            const market = spotMarkets.slice().reverse().find(market => market.baseDenom.toString() === denom.toString());
            let vault = null;

            if (market) {
                vault = mitoVaults.slice().reverse().find(vault => vault.marketId.toString() === market.marketId.toString());
            }

            let currentMitoPrice = null;

            if (vault) {
                console.log("Found vault:", vault);
                setMitoVault(vault);
                currentMitoPrice = await module.getHelixMarketQuote(vault.marketId, 18 - tokenInfo?.decimals);

                setTokenPrice(currentMitoPrice);
            }

            console.log("Got price from mito", currentMitoPrice);

            if (currentMitoPrice) {
                setHolders(prevHolders => prevHolders.map(holder => ({
                    ...holder,
                    usdValue: Number(holder.balance) * currentMitoPrice
                })));
            }

            console.log("Checking liquidity...");

            const liquidity = await module.checkForLiquidity(assetInfo);

            console.log("Liquidity fetched:", liquidity);

            if (liquidity.length === 0) {
                setFindingLiq(false);
                setLiqError(true);
                return;
            }

            setLiquidity(liquidity);

            if (!currentMitoPrice) {
                setHolders(prevHolders => prevHolders.map(holder => ({
                    ...holder,
                    usdValue: Number(holder.balance) * liquidity[0]?.price
                })));
                setTokenPrice(liquidity[0]?.price);
            }

            setFindingLiq(false);
            console.log("Liquidity finding process finished");

        } catch (e) {
            console.error("Error during liquidity fetch:", e);
            if (!signal.aborted) {
                setFindingLiq(false);
                setLiqError(true);
            }
        }
    }, [tokenInfo, networkConfig, getSpotMarkets, getMitoVaults]);

    useEffect(() => {
        if (tokenInfo && holders.length > 0 && liquidity.length === 0 && !findingLiq && !liqError) {
            const abortController = new AbortController();
            const { signal } = abortController;

            console.log("Starting liquidity fetch...");
            findLiquidity(signal)
                .then(() => {
                    console.log("Finished getting liquidity");
                })
                .catch(e => {
                    console.log("Error getting liquidity:", e);
                });
            return () => {
                console.log("Aborting previous fetch...");
                abortController.abort();
            };
        }
    }, [tokenInfo, holders, findLiquidity, liquidity, findingLiq, liqError]);


    const getTokenHolders = useCallback(async (address: string) => {
        if (loading) return
        if (lastLoadedAddress == address) return
        const module = new TokenUtils(networkConfig);

        console.log("get token holders")

        setLoading(true);
        setError(null);
        setTokenInfo(null);
        setPairMarketing(null);

        setProgress("");
        setLiquidity([])
        setMitoVault(null)
        setTokenPrice(null)
        setFindingLiq(false)
        setLiqError(false)

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
            }
            else {
                try {
                    const tokenInfo = await module.getTokenInfo(address);
                    setTokenInfo({ ...tokenInfo, denom: address });
                    const marketingInfo = await module.getTokenMarketing(address);
                    setPairMarketing(marketingInfo);
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
                    else if (error.message.includes("Error parsing into type talis_nft") || error.message.includes("Error parsing into type cw721_base")) {
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
            throw e
        } finally {
            setLoading(false);

        }
    }, [loading, lastLoadedAddress, networkConfig]);

    useEffect(() => {
        const address = searchParams.get("address")
        if (address && address !== lastLoadedAddress && !loading) {
            getTokenHolders(address).then(() => console.log("got token holders")).catch(e => {
                console.log(e)
                setLastLoadedAddress(address);
            })
            setContractAddress(address => TOKENS.find(v => v.value == address) ?? address)
        }
    }, [searchParams, lastLoadedAddress, getTokenHolders, loading])

    const headers = [
        { label: "Holder Address", key: "address" },
        { label: "Balance", key: "balance" },
        { label: "Percentage Held", key: "percentageHeld" }
    ];

    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">
            <ToastContainer />
            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-lg px-2 py-10">
                        <div className="text-center text-white font-magic">
                            <div className="text-3xl">
                                Token holders
                            </div>
                            <div className="text-lg">on Injective main net</div>
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
                                        label: "TOKENS",
                                        options: TOKENS
                                    },
                                    {
                                        label: "CW404",
                                        options: CW404_TOKENS
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

                        {!loading && !queryLoading &&
                            <>
                                {holdersLastUpdated ?
                                    <div className="mt-4 flex flex-row items-center">
                                        <div>
                                            Holders last updated: {moment(holdersLastUpdated).fromNow()}
                                        </div>
                                        <div
                                            onClick={handleUpdateTokenHolders}
                                            className="ml-5 p-2 rounded shadow-lg rounded-lg bg-slate-700 hover:bg-slate-800 text-lg hover:cursor-pointer text-center font-magic"
                                        >
                                            Refresh
                                        </div>
                                    </div>
                                    :
                                    <div className="mt-4 flex flex-row items-center">
                                        <div className="flex flex-row items-center">
                                            Unknown last updated <GrStatusUnknown className="ml-4 text-lg" />
                                        </div>
                                        <div
                                            onClick={handleUpdateTokenHolders}
                                            className="ml-5 p-2 rounded shadow-lg rounded-lg bg-slate-700 hover:bg-slate-800 text-lg hover:cursor-pointer text-center font-magic"
                                        >
                                            Refresh
                                        </div>
                                    </div>
                                }
                            </>
                        }

                        {error && <div className="text-red-500 mt-2">
                            {error}
                        </div>
                        }

                        <div className="flex flex-col md:flex-row justify-between text-sm ">
                            {tokenInfo && (
                                <div className="mt-5 text-white mr-20">
                                    <div className="font-bold">address: {tokenInfo.denom}</div>
                                    <div>name: {tokenInfo.name}</div>
                                    <div>symbol: {tokenInfo.symbol}</div>
                                    {tokenInfo.decimals !== null && <div>decimals: {tokenInfo.decimals}</div>}
                                    {tokenInfo.description && tokenInfo.description.length > 0 && <div>description: {tokenInfo.description}</div>}
                                    {tokenInfo.total_supply && (
                                        <div>
                                            total supply:{" "}
                                            {humanReadableAmount(tokenInfo.total_supply /
                                                Math.pow(10, tokenInfo.decimals))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {!pairMarketing && tokenInfo && (
                                <div className="mt-5 text-sm text-white">
                                    {tokenInfo.denom == "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt" &&
                                        <IPFSImage
                                            width={100}
                                            className={'mb-2 rounded-lg'}
                                            ipfsPath={"https://wsrv.nl/?url=https%3A%2F%2Fi.ibb.co%2FRBHCm14%2Fbennypfp.png&n=-1"}
                                        />
                                    }
                                    {tokenInfo.logo &&
                                        <IPFSImage
                                            width={100}
                                            className={'mb-2 rounded-lg'}
                                            ipfsPath={tokenInfo.logo}
                                        />
                                    }
                                    {tokenInfo.admin &&
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
                                    }
                                    {tokenInfo.admin !== dojoBurnAddress && tokenInfo.admin !== injBurnAddress &&
                                        <div className="text-red-500 flex flex-row items-center">admin can mint more supply <MdWarning className="ml-2" /></div>
                                    }
                                </div>
                            )}
                            {pairMarketing && pairMarketing.logo && (
                                <div className="mt-5 text-sm text-white">
                                    <img
                                        src={pairMarketing.logo.url}
                                        style={{ width: 100 }}
                                        className="mb-2 rounded-lg"
                                        alt="logo"
                                    />
                                    <div>project: {pairMarketing.project}</div>
                                    <div>description: {pairMarketing.description}</div>
                                    {pairMarketing.marketing &&
                                        <div>
                                            marketing: <a href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}explorer.injective.network/account/${pairMarketing.marketing}`}>
                                                {pairMarketing.marketing.slice(0, 5) + '...' + pairMarketing.marketing.slice(-5)}
                                            </a>
                                            {
                                                WALLET_LABELS[pairMarketing.marketing] ? (
                                                    <span className={`${WALLET_LABELS[pairMarketing.marketing].bgColor} ${WALLET_LABELS[pairMarketing.marketing].textColor} ml-2`}>
                                                        {WALLET_LABELS[pairMarketing.marketing].label}
                                                    </span>
                                                ) : null
                                            }
                                        </div>
                                    }

                                </div>
                            )}
                        </div>

                        {totalBurned !== null && totalBurned !== 0 && tokenInfo !== null && (
                            <div>
                                {/* Total Burned Tokens */}
                                Total burned tokens: {humanReadableAmount(totalBurned)} 🔥{" "}
                                {(liquidity.length > 0 || tokenPrice) && `$${humanReadableAmount(totalBurned * (tokenPrice !== null ? tokenPrice : liquidity[0].price))}`}
                                <br />

                                {/* Total Treasury Holdings */}
                                {totalTreasuryHoldings !== null && totalTreasuryHoldings !== 0 && tokenInfo.denom == "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt" && (
                                    <div>
                                        Total treasury holdings: {humanReadableAmount(totalTreasuryHoldings)} 💰{" "}
                                        {(liquidity.length > 0 || tokenPrice) && `$${humanReadableAmount(totalTreasuryHoldings * (tokenPrice !== null ? tokenPrice : liquidity[0].price))}`}
                                    </div>
                                )}


                                {/* Circulating Supply */}
                                Circulating supply: {humanReadableAmount(
                                    (tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)) - (totalBurned + totalTreasuryHoldings)
                                )}{" "}
                                {(liquidity.length > 0 || tokenPrice) && `$${humanReadableAmount(
                                    ((tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)) - (totalBurned + totalTreasuryHoldings)) *
                                    (tokenPrice !== null ? tokenPrice : liquidity[0].price)
                                )}`}
                            </div>
                        )}


                        <div className="flex flex-row justify-center mt-2">
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
                                <div className="text-sm mx-2 bg-slate-800 p-2 rounded-lg shadow-lg ">
                                    <a href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}mito.fi/vault/${mitoVault.contractAddress}`}
                                        className="text-white hover:cursor-pointer font-bold"
                                    >
                                        Mito vault found
                                    </a>
                                    <br />
                                    APY: {mitoVault.apy.toFixed(2)}%
                                    <br />
                                    liquidity: ${humanReadableAmount(mitoVault.currentTvl)}
                                    <br />
                                    {tokenPrice && <div>
                                        price: ${tokenPrice.toFixed(6)}
                                        <br />
                                    </div>
                                    }
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
                                <GridLoader color="#f9d73f" />
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
                                <div className="flex flex-col md:flex-row items-center justify-between">
                                    <div>
                                        <CSVLink data={holders} headers={headers} filename={"holders.csv"}>
                                            <button className="p-1 bg-slate-700 hover:bg-slate-800 rounded mb-2">Download Holders CSV</button>
                                        </CSVLink>
                                        <div>Total token holders: {totalHolderCount}</div>
                                    </div>
                                    <div>
                                        <form onSubmit={goToPage} className="mt-4">
                                            <label htmlFor="pageSearch" className="mr-2">Go to page:</label>
                                            <input
                                                id="pageSearch"
                                                type="text"
                                                value={pageInput}
                                                onChange={handlePageInput}
                                                placeholder="Enter page number"
                                                className="px-4 py-2 border border-gray-300 rounded text-black"
                                            />
                                            <button
                                                type="submit"
                                                className="ml-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded"
                                            >
                                                Go
                                            </button>
                                            <span className="px-4">Page {currentPage} of {totalPages}</span>
                                        </form>
                                    </div>
                                </div>

                                {/* Virtualized table */}
                                <TokenHoldersTable
                                    holders={paginatedHolders}
                                    startIndex={startIndex}
                                    hasSplitBalances={hasSplitBalances}
                                    WALLET_LABELS={WALLET_LABELS}
                                    lastLoadedAddress={lastLoadedAddress}
                                    liquidity={liquidity}
                                    findingLiq={findingLiq}
                                />

                                {/* Pagination controls */}
                                <div className="pagination-controls mt-4">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 mr-2 bg-gray-800 text-white disabled:bg-gray-500"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-4">Page {currentPage} of {totalPages}</span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 ml-2 bg-gray-800 text-white disabled:bg-gray-500"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default TokenHolders;
