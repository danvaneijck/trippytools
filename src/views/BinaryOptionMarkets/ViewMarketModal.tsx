import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    MsgSetDenomMetadata,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import TokenUtils from "../../modules/tokenUtils";
import moment from "moment";


const ViewMarketModal = (props: {
    marketId: string
}) => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const navigate = useNavigate();


    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [market, setMarket] = useState(null)
    const [orders, setOrders] = useState([])

    const [error, setError] = useState(null)

    const getOptionMarket = useCallback(async () => {
        console.log("get option market")
        const module = new TokenUtils(networkConfig);
        try {
            const market = await module.fetchBinaryOptionMarket(props.marketId);
            const orders = await module.getDerivativeMarketOrders(props.marketId)
            console.log(market)
            console.log(orders)
            setMarket(market)
            setOrders(orders.sort((a, b) => b.createdAt - a.createdAt))
            return market;
        } catch (error) {
            console.error('Failed to fetch option market:', error);
            throw error;
        }
    }, [networkConfig, props]);

    useEffect(() => {
        if (market == null && !loaded && !loading) {
            setLoading(true)
            getOptionMarket().then(r => {
                setLoaded(true)
                setLoading(false)
            }).catch(e => {
                console.log(e)
                setLoading(false)
            })
        }
    }, [market, loading, loaded, getOptionMarket])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-5xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-sm">
                            <h3 className="text-xl font-semibold">
                                View Market {market && market.ticker}
                            </h3>
                        </div>
                        {loading &&
                            <div className="text-base p-5">
                                Loading...
                            </div>
                        }
                        {market && (<div className="relative p-6 flex-auto">


                            <div>
                                <div className="text-base mb-1">Ticker: {market.ticker}</div>
                                <div className="flex flex-row justify-between">
                                    <div className="pr-4">
                                        <div>Market ID: {market.marketId.slice(0, 5)}...{market.marketId.slice(-5)}</div>
                                        <div>Status: {market.marketStatus}</div>
                                        <div>Oracle Symbol: {market.oracleSymbol}</div>
                                        <div>Oracle Provider: {market.oracleProvider}</div>
                                        <div>Oracle Type: {market.oracleType}</div>
                                        <div>Expiration Timestamp: {new Date(market.expirationTimestamp * 1000).toLocaleString()}</div>
                                        <div>Settlement Timestamp: {new Date(market.settlementTimestamp * 1000).toLocaleString()}</div>
                                    </div>
                                    <div className="pl-2">
                                        <div>Quote Denom: {market.quoteDenom.slice(0, 5)}...{market.quoteDenom.slice(-5)}</div>
                                        <div>Quote Token Name: {market.quoteToken.name}</div>
                                        <div>Maker Fee Rate: {market.makerFeeRate}</div>
                                        <div>Taker Fee Rate: {market.takerFeeRate}</div>
                                        <div>Service Provider Fee: {market.serviceProviderFee}</div>
                                        <div>Min Price Tick Size: {market.minPriceTickSize}</div>
                                        <div>Min Quantity Tick Size: {market.minQuantityTickSize}</div>
                                    </div>
                                </div>
                                <div className="text-base mt-1">Settlement Price: {market.settlementPrice || "n/a"}</div>
                            </div>

                            <div className="mt-2">
                                Order History
                            </div>
                            {orders.length > 0 ?
                                <div className="overflow-x-auto mt-1 text-sm overflow-y-scroll max-h-80">

                                    <table className="table-auto w-full">
                                        <thead className="text-white text-left">
                                            <tr>
                                                <th className="py-2">
                                                    Created
                                                </th>
                                                <th className="py-2">
                                                    Direction
                                                </th>
                                                <th className="py-2">
                                                    Type
                                                </th>
                                                <th className="py-2">
                                                    Price
                                                </th>
                                                <th className="py-2">
                                                    Quantity
                                                </th>
                                                <th className="py-2">
                                                    Filled
                                                </th>
                                                <th className="py-2">
                                                    State
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs">
                                            {orders.map((order, index) => (
                                                <tr
                                                    key={index}
                                                    className="text-white border-b text-left"
                                                >
                                                    <td className="py-1">
                                                        {moment(order.createdAt).format()}
                                                    </td>
                                                    <td className="py-1">
                                                        {order.direction}
                                                    </td>
                                                    <td className="py-1">
                                                        {order.executionType}
                                                    </td>
                                                    <td className="py-1">
                                                        {order.price}
                                                    </td>
                                                    <td className="py-1">
                                                        {order.quantity}
                                                    </td>
                                                    <td className="py-1">
                                                        {order.filledQuantity}
                                                    </td>
                                                    <td className="py-1">
                                                        {order.state}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                :
                                <div className="text-center mt-5">
                                    No order history
                                </div>
                            }


                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>)}
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(null)}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default ViewMarketModal