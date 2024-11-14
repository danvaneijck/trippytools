import { useSelector } from "react-redux";
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { Buffer } from "buffer";
import Footer from "../../components/App/Footer";
import { humanReadableAmount } from "../../utils/helpers";
import { getKeplrOfflineSigner, handleSendTx } from "../../utils/keplr";
import { FaExchangeAlt } from "react-icons/fa";
import { CircleLoader } from "react-spinners";
import { SiConvertio } from "react-icons/si";
import ConvertModal from "./ConvertModal";
import DisclaimerModal from "../../components/Modals/DisclaimerModal";
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts";


const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"
const INJ_CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
const SHROOM_BANK_DENOM = `factory/${INJ_CW20_ADAPTER}/${SHROOM_TOKEN_ADDRESS}`
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
const HELIX_MARKET_ID = "0xc6b6d6627aeed8b9c29810163bed47d25c695d51a2aa8599fc5e39b2d88ef934"

const BUY = 1
const SELL = 2


const TokenView = ({ token, setSwapAmount, inputDisabled, swapAmount, outputAmount }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center p-4 rounded-md bg-black bg-opacity-30">
            <img
                src={token.imgSrc}
                alt={`${token.name} logo`}
                className="w-16 h-16 mr-4 rounded-full"
            />

            <div className="flex flex-col flex-grow">
                <span className="text-lg font-semibold text-white">
                    {token.name} ({token.symbol})
                </span>
                <span className="text-sm text-gray-400">
                    Available: {token.available.toFixed(4)} ({token.priceDisplayAmount.toFixed(2)} USD)
                </span>
            </div>

            <div className="flex flex-col mt-5 md:mt-0">
                <div className="flex items-center">
                    <input
                        type="number"
                        placeholder="0.0"
                        disabled={inputDisabled}
                        step={0.0001}
                        className={`text-right text-lg font-semibold text-white bg-black bg-opacity-0 rounded-md flex-grow ${inputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onChange={(e) => setSwapAmount(parseFloat(e.target.value) || 0)}
                        value={inputDisabled ? outputAmount.toFixed(5) : swapAmount}
                    />
                    {!inputDisabled && (
                        <button
                            onClick={() => setSwapAmount(token.available)}
                            className="text-white text-sm font-semibold"
                        >
                            MAX
                        </button>
                    )}
                </div>
                <div className="text-right text-sm pr-4 text-gray-400 mt-1">
                    ${inputDisabled ? (outputAmount * token.price).toFixed(2) : (swapAmount * token.price).toFixed(2)}
                </div>
            </div>
        </div>
    );
};

const debounce = (func, delay) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, delay);
    };
};


const ShroomHub = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [injPrice, setInjPrice] = useState(0)
    const [shroomPrice, setShroomPrice] = useState(0)
    const [injBalance, setInjBalance] = useState(0)
    const [cw20Balance, setCw20Balance] = useState(0)
    const [bankBalance, setBankBalance] = useState(0)

    const [isSwappingToFrom, setIsSwappingToFrom] = useState(false);
    const [gettingRoute, setGettingRoute] = useState(false)

    const [route, setRoute] = useState(null)
    const [routeDisplay, setRouteDisplay] = useState(null)

    const [swapAmount, setSwapAmount] = useState(1)
    const [outputAmount, setOutputAmount] = useState(0)

    const [error, setError] = useState(null);
    const [convertModal, setConvertModal] = useState(false)

    const [txHash, setTxHash] = useState()

    const [dropdownList, setDropdownList] = useState([{
        imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Finjective%2Fimages%2Finj.svg&n=-1&w=64&h=64",
        name: "Injective",
        symbol: "INJ",
        denom: 'inj',
        available: 0,
        priceDisplayAmount: 0,
        price: 0
    },
    {
        imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64",
        name: "Shroomin",
        symbol: "SHROOM",
        denom: SHROOM_TOKEN_ADDRESS,
        available: 0,
        priceDisplayAmount: 0,
        price: 0
    }])

    const [to, setTo] = useState(dropdownList[1])
    const [from, setFrom] = useState(dropdownList[0])

    const handleSwap = () => {
        setIsSwappingToFrom(true);
        setTimeout(() => {
            setFrom(to);
            setTo(from);
            setIsSwappingToFrom(false);
        }, 500);
    };

    const loadBalance = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        try {
            const [baseAssetPrice, pairInfo] = await Promise.all([
                module.getINJPrice(),
                module.getPairInfo(SHROOM_PAIR_ADDRESS)
            ]);
            const quote = await module.getSellQuoteRouter(pairInfo, 1 + "0".repeat(18));
            const returnAmount = Number(quote.amount) / Math.pow(10, 18);
            const totalUsdValue = (returnAmount * baseAssetPrice);
            setShroomPrice(totalUsdValue);
            setInjPrice(baseAssetPrice)

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
            loadBalance().then(r => {
                console.log("loaded prices and balances")
            }).catch(e => {
                console.log(e)
            })
        }
    }, [currentNetwork, networkConfig, connectedAddress, loadBalance])

    useEffect(() => {
        setDropdownList(
            [
                {
                    imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Finjective%2Fimages%2Finj.svg&n=-1&w=64&h=64",
                    name: "Injective",
                    symbol: "INJ",
                    denom: 'inj',
                    available: injBalance,
                    priceDisplayAmount: injBalance * injPrice,
                    price: injPrice
                },
                {
                    imgSrc: "https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64",
                    name: "Shroomin",
                    symbol: "SHROOM",
                    denom: SHROOM_TOKEN_ADDRESS,
                    available: cw20Balance + bankBalance,
                    priceDisplayAmount: (cw20Balance + bankBalance) * shroomPrice,
                    price: shroomPrice
                }
            ]
        )
    }, [shroomPrice, injPrice, cw20Balance, bankBalance, injBalance])

    useEffect(() => {
        setTo(dropdownList[1])
        setFrom(dropdownList[0])
    }, [dropdownList])

    const convertToBank = useCallback(async (amount) => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const module = new TokenUtils(networkConfig)
        const msg = module.constructCW20ToBankMsg(
            SHROOM_TOKEN_ADDRESS,
            amount,
            18,
            injectiveAddress
        )

        setTxHash(null)
        const result = await handleSendTx(
            networkConfig,
            pubKey,
            [msg],
            injectiveAddress,
            offlineSigner,
        )
        setTxHash(result['txHash'])

        setConvertModal(false)
        await loadBalance()
    }, [networkConfig, loadBalance])

    const convertToCw20 = useCallback(async (amount) => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const module = new TokenUtils(networkConfig)
        const msg = module.constructBankToCW20Msg(
            SHROOM_TOKEN_ADDRESS,
            amount,
            18,
            injectiveAddress
        )

        setTxHash(null)
        const result = await handleSendTx(
            networkConfig,
            pubKey,
            [msg],
            injectiveAddress,
            offlineSigner,
        )
        setTxHash(result['txHash'])

        setConvertModal(false)
        await loadBalance()
    }, [networkConfig, loadBalance])

    const getRoute = useCallback(async () => {
        setError(null);
        setGettingRoute(true);

        const module = new TokenUtils(networkConfig);
        const pairInfo = await module.getPairInfo(SHROOM_PAIR_ADDRESS);

        let bestOutputAmount = 0;
        let bestRoute = null;
        let bestDisplay = "";

        const market = await module.getSpotMarket(HELIX_MARKET_ID);
        const orders = await module.getSpotMarketOrders(HELIX_MARKET_ID);

        for (let ratio = 0; ratio <= 1; ratio += 0.1) {
            const dojoPortion = swapAmount * ratio;
            const helixPortion = swapAmount * (1 - ratio);

            const formattedDojoPortion = (dojoPortion * Math.pow(10, 18)).toLocaleString('fullwide', { useGrouping: false });

            let dojoQuote, helixQuote;

            if (to.denom === 'inj') {
                dojoQuote = await module.getSellQuoteRouter(pairInfo, formattedDojoPortion);
                helixQuote = await module.getHelixShroomSellQuote(market, orders, helixPortion, 18);
            } else {
                dojoQuote = await module.getBuyQuoteRouter(pairInfo, formattedDojoPortion);
                helixQuote = await module.getHelixShroomBuyQuote(market, orders, helixPortion, 18);
            }

            const dojoAmount = Number(dojoQuote.amount) / Math.pow(10, 18);
            const helixAmount = helixQuote.totalQuantity;
            const combinedOutput = dojoAmount + helixAmount;

            if (combinedOutput > bestOutputAmount) {
                bestOutputAmount = combinedOutput;
                bestRoute = {
                    dojo: {
                        inputAmount: dojoPortion * Math.pow(10, 18),
                        amount: Number(dojoQuote.amount),
                        ratio: (ratio * 100).toFixed(0)
                    },
                    helix: {
                        inputAmount: helixPortion,
                        amount: Number(helixQuote.totalQuantity) * Math.pow(10, 18),
                        price: helixQuote.averagePrice,
                        worstPrice: helixQuote.worstAcceptablePrice,
                        ratio: ((1 - ratio) * 100).toFixed(0)
                    }
                };
                bestDisplay = `${(ratio * 100).toFixed(0)}% DojoSwap ${dojoAmount.toFixed(4)} ${to.symbol}, ${((1 - ratio) * 100).toFixed(0)}% INJ Orderbook ${helixAmount.toFixed(4)} ${to.symbol}`;
            }
        }

        setOutputAmount(bestOutputAmount);
        setRouteDisplay(bestDisplay);
        setRoute(bestRoute);
        setGettingRoute(false);
    }, [networkConfig, swapAmount, to]);

    useEffect(() => {
        const debouncedGetRoute = debounce(getRoute, 2000);

        if (swapAmount === 0) {
            setOutputAmount(0);
        } else {
            debouncedGetRoute();
        }

        const intervalId = setInterval(() => {
            void loadBalance()
            void getRoute();
        }, 30000);

        return () => {
            clearTimeout(debouncedGetRoute);
            clearInterval(intervalId);
        };
    }, [networkConfig, swapAmount, to, from, getRoute, loadBalance]);

    const sendTx = useCallback(async () => {

        console.log(route)

        if (from.symbol == "SHROOM" && cw20Balance + bankBalance < swapAmount) {
            setError("You do not have enough tokens")
            return
        }
        else {
            setError(null)
        }

        if (from.symbol == "INJ" && injBalance < swapAmount) {
            setError("You do not have enough tokens")
            return
        }
        else {
            setError(null)
        }

        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (connectedAddress != injectiveAddress) {
            return
        }

        const module = new TokenUtils(networkConfig);

        const INJ = { native_token: { denom: 'inj' } }
        const SHROOM = { token: { contract_addr: "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8" } }

        const txMessages = []

        let msgDojoSwap = null
        let msgOrderBookSwap = null

        if (to.symbol == 'SHROOM') {
            console.log("construct buy")

            msgOrderBookSwap = await module.constructSpotMarketOrder(
                HELIX_MARKET_ID,
                route['helix'].price,
                route['helix'].amount / Math.pow(10, 18),
                BUY,
                18,
                injectiveAddress,
                FEE_COLLECTION_ADDRESS,
            )

            console.log(msgOrderBookSwap)
            if (route['helix'].ratio > 0) {
                console.log("add order book message")
                txMessages.push(msgOrderBookSwap)
            }

            const injToBaseAsset = [
                {
                    address: SHROOM_PAIR_ADDRESS,
                    offerAsset: INJ,
                    returnAsset: SHROOM
                },
            ]

            msgDojoSwap = module.constructExecuteRouteMessage(
                injectiveAddress,
                injToBaseAsset,
                INJ,
                route['dojo'].inputAmount.toLocaleString('fullwide', { useGrouping: false }),
                ((route['dojo'].amount - (route['dojo'].amount * 0.000001))).toLocaleString('fullwide', { useGrouping: false }),
                { denom: 'inj', amount: (route['dojo'].inputAmount).toLocaleString('fullwide', { useGrouping: false }) }
            )

            console.log(msgDojoSwap)
            if (route['dojo'].ratio > 0) {
                console.log("add dojo swap message")
                txMessages.push(msgDojoSwap)
            }

        }
        else {
            console.log("construct sell")

            if (route['helix'].ratio > 0 && route['helix'].inputAmount > bankBalance) {
                console.log("need to convert cw20 to bank")
                const msgConvertToBank = module.constructCW20ToBankMsg(
                    SHROOM_TOKEN_ADDRESS,
                    route['helix'].inputAmount - bankBalance,
                    18,
                    injectiveAddress
                )
                txMessages.push(msgConvertToBank)
            }

            if (route['dojo'].ratio > 0 && route['dojo'].inputAmount > cw20Balance) {
                console.log("need to convert bank to cw20")
                const msgConvertToCw20 = module.constructBankToCW20Msg(
                    SHROOM_TOKEN_ADDRESS,
                    (route['dojo'].inputAmount / Math.pow(10, 18)) - cw20Balance,
                    18,
                    injectiveAddress
                )
                txMessages.push(msgConvertToCw20)
            }

            msgOrderBookSwap = await module.constructSpotMarketOrder(
                HELIX_MARKET_ID,
                route['helix'].price,
                route['helix'].inputAmount,
                SELL,
                18,
                injectiveAddress,
                FEE_COLLECTION_ADDRESS,
            )

            if (route['helix'].ratio > 0) {
                console.log("add order book message")
                txMessages.push(msgOrderBookSwap)
            }

            const baseAssetToInj = [
                {
                    address: SHROOM_PAIR_ADDRESS,
                    offerAsset: SHROOM,
                    returnAsset: INJ
                },
            ]

            msgDojoSwap = module.constructExecuteRouteMessage(
                injectiveAddress,
                baseAssetToInj,
                SHROOM,
                route['dojo'].inputAmount.toLocaleString('fullwide', { useGrouping: false }),
                (route['dojo'].amount - (route['dojo'].amount * 0.000001)).toLocaleString('fullwide', { useGrouping: false }),
                { denom: 'inj', amount: (route['dojo'].inputAmount).toLocaleString('fullwide', { useGrouping: false }) }
            )

            if (route['dojo'].ratio > 0) {
                console.log("add dojo swap message")
                txMessages.push(msgDojoSwap)
            }
        }

        const gas = {
            amount: [
                {
                    denom: "inj",
                    amount: '2000000'
                }
            ],
            gas: '2000000'
        };

        console.log(txMessages)

        setTxHash(null)

        const result = await handleSendTx(
            networkConfig,
            pubKey,
            txMessages,
            injectiveAddress,
            offlineSigner,
            gas
        )
        setTxHash(result['txHash'])
        await loadBalance()
        setSwapAmount(0)

    }, [route, from, cw20Balance, bankBalance, swapAmount, networkConfig, connectedAddress, to, injBalance, loadBalance])

    const sendMarketMake = useCallback(async () => {
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const msgMarketMake = MsgExecuteContractCompat.fromJSON({
            sender: injectiveAddress,
            contractAddress: "inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp",
            msg: {
                market_make: {}
            },
        });

        const gas = {
            amount: [
                {
                    denom: "inj",
                    amount: '3500000'
                }
            ],
            gas: '3500000'
        };

        setTxHash(null)
        const result = await handleSendTx(
            networkConfig,
            pubKey,
            msgMarketMake,
            injectiveAddress,
            offlineSigner,
            gas
        )
        setTxHash(result['txHash'])

        await loadBalance()
        await getRoute()
    }, [getRoute, loadBalance, networkConfig])


    return (
        <>
            <DisclaimerModal />

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
                        <div className="text-white text-center text-3xl font-magic mt-5 md:mt-0">
                            Shroom Hub
                        </div>

                        <div
                            className="bg-black bg-opacity-30 lg:w-1/2 m-auto p-4 rounded-lg mt-2"
                        >
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
                                    {((cw20Balance + bankBalance) * shroomPrice).toFixed(2)} USD
                                </div>
                            </div>
                            <div className="flex justify-center mt-5">
                                <button
                                    onClick={sendMarketMake}
                                    className="p-1 rounded-lg border"
                                >
                                    <div className="text-sm">
                                        Tighten mito orders
                                    </div>
                                </button>
                            </div>
                        </div>


                        <div
                            className="lg:w-1/2 m-auto"
                        >
                            <div className="font-magic text-center text-3xl mt-5 md:mt-10">
                                Shroom Swap
                            </div>
                            <div className="text-sm text-center m-auto">
                                This trading tool optimizes your trade by finding the ideal split between DojoSwap's liquidity pool and Injective's order book, helping you secure a better price with minimized slippage!
                                Use the button above to tighten the spread on the mito vault before you trade to ensure best price.
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

                            {routeDisplay && !gettingRoute &&
                                <div className="text-center mt-5 text-sm">
                                    Route: {routeDisplay}
                                </div>
                            }

                            <div className="flex flex-row justify-center">
                                <button
                                    onClick={async () => {
                                        await loadBalance()
                                        await getRoute()
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
                                    onClick={sendTx}
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
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        </>

    );
}

export default ShroomHub