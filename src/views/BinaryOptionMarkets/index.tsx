import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import moment from "moment";
import ViewMarketModal from "./ViewMarketModal";
import NewMarketModal from "./NewMarketModal";
import { useSearchParams } from 'react-router-dom';
import MarketDetails from "./MarketDetails";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";


const BinaryOptionMarkets = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const [viewMarket, setViewMarket] = useState(null);
    const [showNewMarket, setShowNewMarket] = useState(false);

    const [status, setStatus] = useState("active");

    const [marketId, setMarketId] = useState(searchParams.get("marketId"))

    const getOptionMarkets = useCallback(async () => {
        console.log("get option markets")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchBinaryOptionMarkets(status);
            console.log(markets)
            return markets.sort((a, b) => a.expirationTimestamp - b.expirationTimestamp);
        } catch (error) {
            console.error('Failed to fetch option markets:', error);
            throw error;
        }
    }, [networkConfig, status]);

    useEffect(() => {
        if (markets.length == 0 && !loaded && !loading) {
            getOptionMarkets().then(r => {
                setMarkets(r)
                setLoaded(true)
            })
        }
    }, [markets, loading, loaded, getOptionMarkets])

    useEffect(() => {
        setLoaded(false)
        setMarkets([])
    }, [currentNetwork, status])

    useEffect(() => {
        const marketId = searchParams.get("marketId")
        if (marketId) {
            setMarketId(marketId)
        }
        else {
            setMarketId(null)
        }
    }, [searchParams])


    return (
        <>
            {marketId && <MarketDetails marketId={marketId} />}
            {!marketId &&

                <>
                    {viewMarket !== null && <ViewMarketModal setShowModal={setViewMarket} marketId={viewMarket} setLoaded={setLoaded} />}
                    {showNewMarket && <NewMarketModal setShowModal={setShowNewMarket} setLoaded={setLoaded} />}

                    <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                        <div className="pt-14 flex-grow mx-2 pb-20">
                            <div className="flex justify-center items-center min-h-full">
                                <div className="w-full max-w-screen-xl px-2 py-10">
                                    <div className="text-center">
                                        <div className="text-xl">
                                            Binary Option Markets
                                        </div>
                                        <div className="text-xs">on Injective {currentNetwork}</div>
                                    </div>


                                    <div className="flex flex-row justify-around mt-2" >
                                        <div className="flex flex-row" onClick={() => {
                                            setStatus("active")
                                        }}>
                                            <input
                                                type="checkbox"
                                                className="text-black w-full rounded p-1 text-sm"
                                                onChange={() => {
                                                    setStatus("active")

                                                }}
                                                checked={status == "active"}
                                            />
                                            <label
                                                className="block text-white ml-5"
                                            >
                                                active
                                            </label>
                                        </div>
                                        <div className="flex flex-row" onClick={() => {
                                            setStatus("expired")
                                        }}>
                                            <input
                                                type="checkbox"
                                                className="text-black w-full rounded p-1 text-sm"
                                                onChange={() => {
                                                    setStatus("expired")

                                                }}
                                                checked={status == "expired"}
                                            />
                                            <label
                                                className="block text-white ml-5"
                                            >
                                                expired
                                            </label>
                                        </div>
                                        <div className="flex flex-row" onClick={() => {
                                            setStatus("demolished")
                                        }}>
                                            <input
                                                type="checkbox"
                                                className="text-black w-full rounded p-1 text-sm"
                                                onChange={() => {
                                                    setStatus("demolished")

                                                }}
                                                checked={status == "demolished"}
                                            />
                                            <label
                                                className="block text-white ml-5"
                                            >
                                                demolished
                                            </label>
                                        </div>
                                    </div>

                                    <div className="my-2">
                                        <button
                                            onClick={() => { setShowNewMarket(true) }}
                                            className="my-2 bg-slate-700 shadow-lg p-2 rounded-lg text-sm ml-2 hover:font-bold"
                                        >
                                            Create New Market
                                        </button>
                                    </div>


                                    {markets.length > 0 ?
                                        <div className="overflow-x-auto mt-4 text-sm">
                                            <table className="table-auto w-full">
                                                <thead className="text-white text-left">
                                                    <tr>
                                                        <th className="px-4 py-2">
                                                            Ticker
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Status
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Quote
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Oracle Symbol
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Oracle Provider
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Settlement Time
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Expiration Time
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Settlement Price
                                                        </th>
                                                        <th className="px-4 py-2">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {markets.map((market, index) => (
                                                        <tr
                                                            key={index}
                                                            className="text-white border-b text-left"
                                                        >
                                                            <td className="px-6 py-1">
                                                                {market.ticker}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {market.marketStatus}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {market.quoteToken.name}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {market.oracleSymbol}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {market.oracleProvider}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {moment.unix(market.settlementTimestamp).fromNow()}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {moment.unix(market.expirationTimestamp).fromNow()}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                {market.settlementPrice}
                                                            </td>
                                                            <td className="px-6 py-1">
                                                                <button
                                                                    className="my-2 bg-slate-700 shadow-lg p-1 rounded-lg text-xs"
                                                                    onClick={() => setSearchParams({
                                                                        marketId: market.marketId
                                                                    })}
                                                                >
                                                                    View
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        :
                                        <div className="text-center mt-10">
                                            No binary option markets right now
                                        </div>
                                    }

                                </div>
                            </div>
                        </div>

                        <Footer />
                    </div>
                </>
            }
        </>

    );
};

export default BinaryOptionMarkets;
