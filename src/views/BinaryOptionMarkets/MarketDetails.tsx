import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ConnectWallet from "../../components/App/ConnectKeplr";
import TokenUtils from "../../modules/tokenUtils";
import moment from "moment";
import OrderPanel from "./OrderPanel";
import { useNavigate, useLocation } from 'react-router-dom';
import MarketAdminModal from "./MarketAdminModal";
import useNetworkStore from "../../store/useNetworkStore";



const MarketDetails = (props: {
    marketId: string
}) => {
    const { network: networkConfig } = useNetworkStore()

    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const [showAdminModal, setShowAdminModal] = useState(false);

    const [market, setMarket] = useState(null)

    const [orders, setOrders] = useState([])

    const navigate = useNavigate();
    const location = useLocation();

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
        if (!loaded && !loading) {
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
            {showAdminModal && <MarketAdminModal market={market} setShowModal={setShowAdminModal} setLoaded={setLoaded} />}
            <div className="flex flex-col min-h-screen pb-10">
                <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                    <div className="container mx-auto flex items-center p-2 text-xs md:text-sm">
                        <Link to="/" className="font-bold hover:underline mx-5">
                            home
                        </Link>

                        <Link
                            to="/manage-tokens"
                            className="font-bold hover:underline "
                        >
                            manage tokens
                        </Link>
                    </div>


                    <div className="m-2">
                        <ConnectWallet />
                    </div>
                </header>

                <div className="pt-14 flex-grow mx-2 pb-20">


                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-screen-xl px-2 py-5">
                            {market &&
                                <>
                                    <button
                                        className="bg-slate-700 shadow-lg p-2 rounded-lg text-sm hover:font-bold hover:cursor-pointer mb-4"
                                        onClick={() => { navigate(location.pathname) }}
                                    >
                                        Go back
                                    </button>
                                    <div className="text-lg">Binary Option Market</div>
                                    <div className="mt-2">
                                        Ticker: {market.ticker}
                                    </div>
                                    <div>
                                        Expiration time: {moment.unix(market.expirationTimestamp).format()} ({moment.unix(market.expirationTimestamp).fromNow()})
                                        <br />
                                        Settlement time: {moment.unix(market.settlementTimestamp).format()} ({moment.unix(market.settlementTimestamp).fromNow()})
                                        <br />
                                        Status: {market.marketStatus}
                                        <br />
                                        Settlement price: {market.settlementPrice}
                                    </div>
                                    <button
                                        className="bg-slate-700 shadow-lg p-2 rounded-lg text-sm hover:font-bold hover:cursor-pointer my-4"
                                        onClick={() => { setShowAdminModal(true) }}
                                    >
                                        Update Market (Admin)
                                    </button>
                                </>
                            }
                            <div className="flex flex-row">
                                {orders.length > 0 ?
                                    <div className="overflow-x-auto mt-1 text-sm max-h-100 w-full">
                                        <table className="table-auto w-full">
                                            <thead className="text-white text-left">
                                                <tr>
                                                    <th className="py-2">
                                                        Created
                                                    </th>
                                                    <th className="py-2">
                                                        Account
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
                                                            {moment(order.createdAt).fromNow()}
                                                        </td>
                                                        <td className="py-1">
                                                            {order.subaccountId.slice(0, 8)}...
                                                        </td>
                                                        <td className="py-1">
                                                            {order.direction}
                                                        </td>
                                                        <td className="py-1">
                                                            {order.executionType}
                                                        </td>
                                                        <td className="py-1">
                                                            {(Number(order.price) / Math.pow(10, market.quoteToken.decimals)).toFixed(4)} {market.quoteToken.symbol}
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
                                <div className="w-full">
                                    <OrderPanel marketId={props.marketId} market={market} setLoaded={setLoaded} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </>

    );
};

export default MarketDetails;
