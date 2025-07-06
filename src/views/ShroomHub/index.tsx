import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import Footer from "../../components/App/Footer";
import { humanReadableAmount } from "../../utils/helpers";
import { SiConvertio } from "react-icons/si";
import ConvertModal from "./ConvertModal";
import DisclaimerModal from "../../components/Modals/DisclaimerModal";
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts";
import { INJ_DENOM } from "@injectivelabs/utils";
import { gql, useQuery } from "@apollo/client";
import { toast, ToastContainer } from "react-toastify";
import { Link } from "react-router-dom";
import choice from "../../assets/choice.svg"
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";

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
    holders_query_progress
    holders_save_progress
  }
  holders: wallet_tracker_balance(where: {token_id: {_in: $addresses}, balance: { _gt: $balanceMin }}, order_by: {balance:desc}) {
    wallet_id
    balance
    percentage_held
    token_id
    id
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

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
const SHROOM_BANK_DENOM = `factory/${CW20_ADAPTER}/${SHROOM_TOKEN_ADDRESS}`
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
const SHROOM_CHOICE_PAIR_ADDRESS = "inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5"

const HELIX_MARKET_ID = "0xc6b6d6627aeed8b9c29810163bed47d25c695d51a2aa8599fc5e39b2d88ef934"
const ORDERBOOK_SWAP_ADDRESS = "inj1tcl59pywlnkjgx33pempyluy8fyunmp02jdn6a"
const MITO_VAULT_ADDRESS = "inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp"


const TokenView = ({ token, setSwapAmount, inputDisabled, swapAmount, outputAmount }) => {
    return (
        <div className="flex flex-col sm:flex-row p-4 rounded-md bg-black bg-opacity-30 justify-between items-start sm:items-center gap-4">
            {/* Token Info */}
            <div className="flex flex-row w-full sm:w-1/2 items-center">
                <img
                    src={token.imgSrc}
                    alt={`${token.name} logo`}
                    className="w-12 h-12 mr-4 rounded-full"
                />
                <div className="flex flex-col">
                    <span className="text-lg font-semibold text-white">{token.symbol}</span>
                    <span className="text-sm text-gray-400 mt-1">
                        Available: {humanReadableAmount(token.available)} ({humanReadableAmount(token.priceDisplayAmount)} USD)
                    </span>
                </div>
            </div>

            {/* Input Section */}
            <div className="flex flex-col w-full sm:w-auto mt-1 sm:mt-0">
                <div className="flex items-end w-full">
                    <input
                        type="number"
                        placeholder="0.0"
                        disabled={inputDisabled}
                        step={0.0001}
                        className={`text-left sm:text-right  text-lg font-semibold text-white bg-black bg-opacity-0 rounded-md w-full sm:w-36 ${inputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onChange={(e) => setSwapAmount(parseFloat(e.target.value) || 0)}
                        value={inputDisabled ? outputAmount.toFixed(5) : swapAmount}
                    />
                    {!inputDisabled && (
                        <button
                            onClick={() => setSwapAmount(token.available)}
                            className="text-white text-sm font-semibold ml-2 whitespace-nowrap"
                        >
                            MAX
                        </button>
                    )}
                </div>
                <div className="text-left sm:text-right text-sm text-gray-400 mt-1">
                    ${inputDisabled ? (outputAmount * token.price).toFixed(2) : (swapAmount * token.price).toFixed(2)}
                </div>
            </div>
        </div>
    );
};

const ShroomHub = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [injPrice, setInjPrice] = useState(0)
    const [shroomPrice, setShroomPrice] = useState(0)
    const [injBalance, setInjBalance] = useState(0)
    const [cw20Balance, setCw20Balance] = useState(0)
    const [bankBalance, setBankBalance] = useState(0)

    const [totalSupply, setTotalSupply] = useState(0)
    const [marketCap, setMarketCap] = useState(0)
    const [mitoLiquidity, setMitoLiquidity] = useState(0)
    const [dojoLiquidity, setDojoLiquidity] = useState(0)
    const [choiceLiquidity, setChoiceLiquidity] = useState(0)

    const [numHolders, setNumHolders] = useState(0)
    const [burnedAmount, setBurnedAmount] = useState(0)

    const [isSwappingToFrom, setIsSwappingToFrom] = useState(false);
    const [gettingRoute, setGettingRoute] = useState(false)

    const [swapAmount, setSwapAmount] = useState(1)

    const [error, setError] = useState(null);
    const [convertModal, setConvertModal] = useState(false)

    const [txHash, setTxHash] = useState()


    const [dropdownList, setDropdownList] = useState([{
        imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Finjective%2Fimages%2Finj.svg&n=-1&w=64&h=64",
        name: "Injective",
        symbol: "INJ",
        denom: 'inj',
        address: 'inj',
        decimals: 18,
        available: 0,
        priceDisplayAmount: 0,
        price: 0,
        info: {
            native_token: {
                denom: "inj"
            }
        }
    },
    {
        imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64",
        name: "Shroomin",
        symbol: "SHROOM",
        denom: SHROOM_TOKEN_ADDRESS,
        address: SHROOM_TOKEN_ADDRESS,
        decimals: 18,
        available: 0,
        priceDisplayAmount: 0,
        price: 0,
        info: {
            token: {
                contract_addr: SHROOM_TOKEN_ADDRESS
            }
        }
    }])

    const [to, setTo] = useState(dropdownList[1])
    const [from, setFrom] = useState(dropdownList[0])

    const { data } = useQuery(HOLDER_QUERY, {
        fetchPolicy: "network-only",
        pollInterval: 60000,
        variables: {
            address: SHROOM_TOKEN_ADDRESS,
            addresses: [
                SHROOM_TOKEN_ADDRESS,
                SHROOM_BANK_DENOM
            ],
            balanceMin: 0,
        }
    });

    const handleSwap = () => {
        setIsSwappingToFrom(true);
        setTimeout(() => {
            setFrom(to);
            setTo(from);
            setIsSwappingToFrom(false);
        }, 500);
    };

    useEffect(() => {
        if (!data) return;

        const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
        const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

        const BURN_ADDRESSES = [
            dojoBurnAddress,
            injBurnAddress,
            SHROOM_TOKEN_ADDRESS
        ]

        const balances = data.holders;

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
            if (holder.wallet_id === CW20_ADAPTER) {
                return sum + 0;
            }
            return sum + (holder.cw20Balance + holder.bankBalance);

        }, 0);

        totalSupply = Math.round(totalSupply)

        setTotalSupply(totalSupply)

        const finalHolderList = Object.entries(groupedByWallet).map(([wallet_id, holder]) => {
            return {
                address: wallet_id,
                balance: holder.cw20Balance + holder.bankBalance,
                percentageHeld: (holder.cw20Balance + holder.bankBalance) / totalSupply * 100,
                cw20Balance: holder.cw20Balance ? holder.cw20Balance : 0,
                bankBalance: holder.bankBalance ? holder.bankBalance : 0,
            };
        }).filter(x => x.balance !== 0).sort((a, b) => b.balance - a.balance)

        setNumHolders(finalHolderList.length);

        const totalBurnedBalance = finalHolderList
            .filter(addressObj => BURN_ADDRESSES.includes(addressObj.address))
            .reduce((total, addressObj) => {
                return total + addressObj.balance;
            }, 0);

        setBurnedAmount(totalBurnedBalance)
    }, [data]);

    useEffect(() => {
        if (shroomPrice && totalSupply) {
            setMarketCap(shroomPrice * (totalSupply - burnedAmount))
        }
    }, [shroomPrice, totalSupply, burnedAmount])

    const loadLiquidity = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        const mitoVault = await module.fetchMitoVault(MITO_VAULT_ADDRESS)

        if (mitoVault) {
            setMitoLiquidity(mitoVault.currentTvl)
        }

        const [baseAssetPrice, pairInfo, poolAmountsDojo, poolAmountsChoice] = await Promise.all([
            module.getINJPrice(),
            module.getPairInfo(SHROOM_PAIR_ADDRESS),
            module.getPoolAmounts(SHROOM_PAIR_ADDRESS),
            module.getPoolAmounts(SHROOM_CHOICE_PAIR_ADDRESS)
        ]);

        const baseAssetAmountDojo = poolAmountsDojo.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === INJ_DENOM;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === INJ_DENOM;
            }
            return false;
        })?.amount || 0;

        const baseAssetAmountChoice = poolAmountsChoice.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === INJ_DENOM;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === INJ_DENOM;
            }
            return false;
        })?.amount || 0;

        const injAmountDojo = baseAssetAmountDojo / Math.pow(10, 18)
        const dojoLiquidity = injAmountDojo * baseAssetPrice
        setDojoLiquidity(dojoLiquidity * 2)

        const injAmountChoice = baseAssetAmountChoice / Math.pow(10, 18)
        const choiceLiquidity = injAmountChoice * baseAssetPrice
        setChoiceLiquidity(choiceLiquidity * 2)

        const quote = await module.getSellQuoteRouter(pairInfo, 1 + "0".repeat(18));
        const returnAmount = Number(quote.amount) / Math.pow(10, 18);
        const totalUsdValue = (returnAmount * baseAssetPrice);
        setShroomPrice(totalUsdValue);
        setInjPrice(baseAssetPrice)

    }, [networkConfig])

    const loadBalance = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        try {
            const [cw20Balance, bankBalance, injBalance] = await Promise.all([
                module.queryTokenForBalance(SHROOM_TOKEN_ADDRESS, connectedAddress),
                module.getBalanceOfToken(SHROOM_BANK_DENOM, connectedAddress),
                module.getBalanceOfToken('inj', connectedAddress)
            ]);
            setCw20Balance(Number(cw20Balance.balance) / Math.pow(10, 18))
            setBankBalance(Number(bankBalance.amount) / Math.pow(10, 18))
            setInjBalance(Number(injBalance.amount) / Math.pow(10, 18))
            return
        } catch (error) {
            console.error('Failed to update balance and USD value:', error);
        }
    }, [connectedAddress, networkConfig])

    useEffect(() => {
        if (currentNetwork == "mainnet" && connectedAddress) {
            loadBalance().then(() => {
                console.log("loaded prices and balances")
            }).catch(e => {
                console.log(e)
            })
        }
        loadLiquidity().then(() => {
            console.log("loaded liquidity")
        }).catch(e => {
            console.log(e)
        })
    }, [currentNetwork, networkConfig, connectedAddress, loadBalance, loadLiquidity])

    useEffect(() => {
        setDropdownList(
            [
                {
                    imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Finjective%2Fimages%2Finj.svg&n=-1&w=64&h=64",
                    name: "Injective",
                    symbol: "INJ",
                    denom: 'inj',
                    address: 'inj',
                    decimals: 18,
                    available: injBalance,
                    priceDisplayAmount: injBalance * injPrice,
                    price: injPrice,
                    info: {
                        native_token: {
                            denom: "inj"
                        }
                    }
                },
                {
                    imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64",
                    name: "Shroomin",
                    symbol: "SHROOM",
                    denom: SHROOM_TOKEN_ADDRESS,
                    address: SHROOM_TOKEN_ADDRESS,
                    decimals: 18,
                    available: cw20Balance + bankBalance,
                    priceDisplayAmount: (cw20Balance + bankBalance) * shroomPrice,
                    price: shroomPrice,
                    info: {
                        token: {
                            contract_addr: SHROOM_TOKEN_ADDRESS
                        }
                    }
                }
            ]
        )
    }, [shroomPrice, injPrice, cw20Balance, bankBalance, injBalance])

    useEffect(() => {
        if (from.denom == "inj") {
            setTo(dropdownList[1])
            setFrom(dropdownList[0])
        }
        else {
            setTo(dropdownList[0])
            setFrom(dropdownList[1])
        }
    }, [dropdownList, from.denom])

    const convertToBank = useCallback(async (amount) => {
        const injectiveAddress = connectedAddress

        const module = new TokenUtils(networkConfig)
        const msg = module.constructCW20ToBankMsg(
            SHROOM_TOKEN_ADDRESS,
            amount,
            18,
            injectiveAddress
        )

        setTxHash(null)
        const result = await performTransaction(
            injectiveAddress,
            [msg]

        )
        setTxHash(result['txHash'])

        const content = (
            <div>
                Converted {humanReadableAmount(amount)} CW20 SHROOM to bank
                <br />
                <a
                    href={`https://injscan.com/transaction/${result['txHash']}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 text-sm"
                >
                    View transaction on explorer
                </a>
            </div>
        );

        toast.success(content, {
            autoClose: 5000,
            theme: "dark"
        });

        setConvertModal(false)
        await loadBalance()
    }, [networkConfig, loadBalance, connectedAddress])

    const convertToCw20 = useCallback(async (amount) => {
        const injectiveAddress = connectedAddress

        const module = new TokenUtils(networkConfig)
        const msg = module.constructBankToCW20Msg(
            SHROOM_TOKEN_ADDRESS,
            amount,
            18,
            injectiveAddress
        )

        setTxHash(null)
        const result = await performTransaction(
            injectiveAddress,
            [msg]
        )
        setTxHash(result['txHash'])

        const content = (
            <div>
                Converted {humanReadableAmount(amount)} bank SHROOM to CW20
                <br />
                <a
                    href={`https://injscan.com/transaction/${result['txHash']}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 text-sm"
                >
                    View transaction on explorer
                </a>
            </div>
        );

        toast.success(content, {
            autoClose: 5000,
            theme: "dark"
        });

        setConvertModal(false)
        await loadBalance()
    }, [connectedAddress, loadBalance, networkConfig])
    //     // Conditions to call getRoute (e.g., valid swapAmount and 'to' token)
    //     if (swapAmount > 0 && to && networkConfig) {
    //         // Cancel any previous ongoing getRoute operation
    //         if (getRouteAbortControllerRef.current) {
    //             getRouteAbortControllerRef.current.abort();
    //             console.log("Previous getRoute call aborted.");
    //         }

    //         // Create a new AbortController for the current operation
    //         const controller = new AbortController();
    //         getRouteAbortControllerRef.current = controller;

    //         setGettingRoute(true);
    //         setError(null);
    //         // Optionally reset states immediately for better UX
    //         setOutputAmount(0);
    //         setRouteDisplay(null);
    //         setRoute(null);

    //         getRoute(swapAmount, to, controller.signal)
    //             .finally(() => {
    //                 // Only set gettingRoute to false if this controller is still the current one
    //                 // (i.e., not aborted by a newer call)
    //                 if (getRouteAbortControllerRef.current === controller) {
    //                     setGettingRoute(false);
    //                     getRouteAbortControllerRef.current = null; // Clear the ref once done
    //                 }
    //             });
    //     } else {
    //         // If inputs are not valid, cancel any ongoing request and clear states
    //         if (getRouteAbortControllerRef.current) {
    //             getRouteAbortControllerRef.current.abort();
    //             getRouteAbortControllerRef.current = null;
    //         }
    //         setGettingRoute(false);
    //         setOutputAmount(0);
    //         setRouteDisplay(null);
    //         setRoute(null);
    //         setError(null);
    //     }

    //     // Cleanup function for when the component unmounts or dependencies change
    //     // This ensures that if the component unmounts while a request is in flight, it's cancelled.
    //     return () => {
    //         if (getRouteAbortControllerRef.current) {
    //             console.log("Effect cleanup: Aborting active getRoute call.");
    //             getRouteAbortControllerRef.current.abort();
    //             getRouteAbortControllerRef.current = null;
    //         }
    //     };
    // }, [swapAmount, to, networkConfig, refreshKey, getRoute]); 

    const handleRefreshPrices = useCallback(() => {
        if (!networkConfig) {
            setError("Cannot refresh: Network configuration not available.");
            return;
        }
        if (swapAmount <= 0) {
            setError("Cannot refresh: Swap amount must be greater than 0.");
            return;
        }
        // Optional: Prevent spamming if already getting route, or decide if refresh should interrupt.
        // The current useEffect logic will abort the previous one if refreshKey changes.
        if (gettingRoute) {
            console.log("Refresh requested, but a route is already being fetched. The new request will abort the current one.");
        }
        console.log("Manual refresh triggered.");
        setRefreshKey(prevKey => prevKey + 1); // Incrementing the key
    }, [gettingRoute, networkConfig, swapAmount]);

    const sendMarketMake = useCallback(async () => {

        const injectiveAddress = connectedAddress

        const msgMarketMake = MsgExecuteContractCompat.fromJSON({
            sender: injectiveAddress,
            contractAddress: "inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp",
            msg: {
                market_make: {}
            },
        });

        setTxHash(null)
        const result = await performTransaction(
            injectiveAddress,
            [msgMarketMake]
        )
        setTxHash(result['txHash'])

        const content = (
            <div>
                Successfully sent market make
                <br />
                <a
                    href={`https://injscan.com/transaction/${result['txHash']}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 text-sm"
                >
                    View transaction on explorer
                </a>
            </div>
        );

        toast.success(content, {
            autoClose: 5000,
            theme: "dark"
        });

        await loadBalance()
        handleRefreshPrices()
    }, [handleRefreshPrices, loadBalance, connectedAddress])


    return (
        <>
            <ToastContainer />
            {convertModal &&
                <ConvertModal
                    bankBalance={bankBalance}
                    cw20Balance={cw20Balance}
                    onClose={() => setConvertModal(false)}
                    convertToBank={convertToBank}
                    convertToCW20={convertToCw20}
                />
            }

            <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                <div className="pt-14 md:pt-24 mx-2 pb-20">
                    <div className="min-h-full mt-2 md:mt-0">
                        <div className="text-white text-center text-3xl font-magic mt-5 md:mt-0 flex items-center justify-center">
                            Shroom Stats
                            <img
                                className="w-10 rounded-full ml-2 h-10"
                                src={"https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64"}
                            />
                        </div>

                        {/** Token Stats */}
                        <div className="p-2 rounded-2xl shadow-md">
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-center">
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://dexscreener.com/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                                    >
                                        Price
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${shroomPrice.toFixed(6)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg">
                                    <div className="text-sm text-white">Market Cap</div>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(marketCap)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg">
                                    <div className="text-sm text-white">Total Liquidity</div>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(dojoLiquidity + mitoLiquidity + choiceLiquidity)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://mito.fi/vault/inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp/"
                                    >
                                        Mito Liquidity
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(mitoLiquidity)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://dojo.trading/swap?type=swap&from=inj&to=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
                                    >
                                        DojoSwap Liquidity
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(dojoLiquidity)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://choice.exchange/swap?input=inj&output=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8&volumeSplitting=true"
                                    >
                                        Choice Liquidity
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(choiceLiquidity)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg col-span-1">
                                    <div className="text-sm text-white">Total Holders</div>
                                    <div className="text-xl font-semibold text-trippyYellow">{humanReadableAmount(numHolders)}</div>
                                </div>
                                <div className="bg-black bg-opacity-50 p-4 rounded-lg col-span-1">
                                    <div className="text-sm text-white">Tokens Burned</div>
                                    <div className="text-xl font-semibold text-trippyYellow">
                                        {humanReadableAmount(burnedAmount)} (${humanReadableAmount(burnedAmount * shroomPrice)})
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="m-auto text-center mt-5 text-2xl font-semibold">
                            <Link
                                className="text-center hover:underline flex justify-center"
                                to={'https://choice.exchange/swap?input=inj&output=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8&volumeSplitting=true'}
                            >
                                Trade on Choice Exchange <img src={choice} className="w-6 ml-4" />
                            </Link>
                        </div>


                        {/** Swap */}
                        {/* <div
                            className="lg:w-1/2 m-auto"
                        >
                            <div className="font-magic text-center text-3xl mt-5">
                                Swap
                            </div>

                            <div className="mt-4">
                                <TokenView
                                    token={from}
                                    inputDisabled={false}
                                    setSwapAmount={setSwapAmount}
                                    swapAmount={swapAmount}
                                    outputAmount={outputAmount}
                                />
                                <div className="flex justify-center my-4">
                                    <button
                                        onClick={handleSwap}
                                        className={isSwappingToFrom ? 'animate-spin' : ''}
                                    >
                                        <FaExchangeAlt className="text-xl" />
                                    </button>
                                </div>
                                <TokenView
                                    token={to}
                                    inputDisabled={true}
                                    setSwapAmount={setSwapAmount}
                                    swapAmount={swapAmount}
                                    outputAmount={outputAmount}
                                />
                            </div>
                            {gettingRoute &&
                                <div className="m-auto text-center flex flex-col justify-center text-sm mt-5">
                                    <div className="mb-2">
                                        Finding best route
                                    </div>
                                    <CircleLoader size={30} className="m-auto" color="white" />
                                </div>
                            }

                            {routeDisplay !== null && !gettingRoute &&
                                <div className="text-center mt-5 text-sm">
                                    {routeDisplay}
                                </div>
                            }

                            <div className="flex flex-row justify-center">
                                <button
                                    onClick={() => {
                                        loadBalance().then(() => {
                                            handleRefreshPrices()
                                        }).catch(e => {
                                            console.log(e)
                                        })
                                    }}
                                    disabled={gettingRoute}
                                    className="w-1/2 lg:w-full rounded-lg mt-5 "
                                >
                                    <div className="transform transition duration-300 hover:scale-110">
                                        Refresh prices
                                    </div>
                                </button>

                            </div>

                            <div className="flex flex-row justify-center">
                                <button
                                    onClick={() => void sendTx()}
                                    disabled={gettingRoute}
                                    className="w-1/2 lg:w-full p-2 rounded-lg mt-5 border "
                                >
                                    <div className="transform transition duration-300 hover:scale-110">
                                        Swap
                                    </div>
                                </button>
                            </div>

                            {txHash &&
                                <div className="text-emerald-500 mt-5 text-xs overflow-hidden">
                                    Transaction success!
                                    <br />
                                    <a
                                        className="underline text-white "
                                        href={`https://explorer.injective.network/transaction/${txHash}`}
                                    >
                                        {`https://explorer.injective.network/transaction/${txHash}`}
                                    </a>
                                </div>
                            }

                            {error &&
                                <div
                                    className="text-rose-500 mt-5"
                                >
                                    {error}
                                </div>
                            }
                        </div> */}

                        {/** Balances */}
                        <div
                            className="bg-black bg-opacity-50 lg:w-1/2 m-auto p-4 rounded-lg mt-5"
                        >
                            <div className="text-center mb-2 text-lg font-bold text-ellipsis  overflow-hidden m-auto">
                                {connectedAddress !== null ? `${connectedAddress.slice(0, 8)}...${connectedAddress.slice(-8)}` : "Connect your wallet"}
                            </div>
                            <div
                                className="flex flex-row space-x-5 md:space-x-20 justify-center text-center items-center"
                            >
                                <div>
                                    <p className="font-bold text-lg">
                                        CW20 balance
                                    </p>
                                    <div>
                                        {humanReadableAmount(cw20Balance)} SHROOM
                                    </div>
                                    <div>
                                        {(cw20Balance * shroomPrice).toFixed(2)} USD
                                    </div>
                                </div>

                                <div
                                    onClick={() => setConvertModal(true)}
                                    className="text-center text-xs hover:cursor-pointer border px-5 py-1 rounded-lg transform transition duration-300 hover:scale-110"
                                >
                                    <SiConvertio
                                        size={30}
                                        className="m-auto"
                                    />
                                    <div className="mt-1">Convert</div>
                                </div>

                                <div>
                                    <p className="font-bold text-lg">
                                        Bank balance
                                    </p>
                                    <div>
                                        {humanReadableAmount(bankBalance)} SHROOM
                                    </div>
                                    <div>
                                        {(bankBalance * shroomPrice).toFixed(2)} USD
                                    </div>
                                </div>

                            </div>

                            <div className="text-center mt-2">
                                <p className="font-bold text-lg">
                                    Total balance
                                </p>
                                <div>
                                    {humanReadableAmount(bankBalance + cw20Balance)} SHROOM
                                </div>
                                <div>
                                    ${humanReadableAmount((cw20Balance + bankBalance) * shroomPrice)} USD
                                </div>
                            </div>
                            <div className="flex justify-center mt-5">
                                <button
                                    onClick={() => void sendMarketMake()}
                                    className="p-1 rounded-lg border"
                                >
                                    <div className="text-sm">
                                        Tighten mito orders
                                    </div>
                                </button>
                            </div>
                        </div>


                    </div>
                </div>
                <Footer />
            </div>
        </>

    );
}

export default ShroomHub