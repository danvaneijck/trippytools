import { useCallback, useState } from 'react';
import {
    MsgAdminUpdateBinaryOptionsMarket
} from "@injectivelabs/sdk-ts";
import { CircleLoader } from "react-spinners";
import moment from 'moment';
import useWalletStore from '../../store/useWalletStore';
import { performTransaction } from '../../utils/walletStrategy';

const MarketAdminModal = (props: { setShowModal: (show: boolean) => void, market: any, setLoaded: any }) => {

    const { connectedWallet: connectedAddress } = useWalletStore()

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [market, setMarket] = useState({
        expirationTimestamp: moment.unix(props.market.expirationTimestamp).format(),
        settlementTimestamp: moment.unix(props.market.settlementTimestamp).format(),
        settlementPrice: 1,
        marketStatus: props.market.marketStatus
    });

    const [error, setError] = useState(null)

    const updateMarket = useCallback(async () => {
        setError(null)

        const injectiveAddress = connectedAddress;

        const msgUpdateMarket = MsgAdminUpdateBinaryOptionsMarket.fromJSON({
            sender: injectiveAddress,
            marketId: props.market.marketId,
            settlementPrice: market.settlementPrice,
            expirationTimestamp: moment(market.expirationTimestamp).unix(),
            settlementTimestamp: moment(market.settlementTimestamp).unix(),
            status: market.marketStatus
        });

        console.log("msg", msgUpdateMarket)
        setProgress("Update binary options market")
        const result = await performTransaction(injectiveAddress, [msgUpdateMarket])

        setProgress("Done...")
        if (result) {
            props.setShowModal(false)
            props.setLoaded(false)
        }
    }, [connectedAddress, props, market])

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setMarket({ ...market, [name]: value });
    };

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm "
            >
                <div className="relative w-auto my-4 mx-auto w-full md:w-1/2">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Update Binary Options Market
                            </h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <form>

                                <div className='mt-1'>
                                    <label>Expiration Timestamp </label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="expirationTimestamp" value={market.expirationTimestamp} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Settlement Timestamp</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="settlementTimestamp" value={market.settlementTimestamp} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Settlement Price</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="settlementPrice" value={market.settlementPrice} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Market Status</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="marketStatus" value={market.marketStatus} onChange={handleInputChange} />
                                </div>
                            </form>
                            {progress && <div className="mt-5">Progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(false)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => updateMarket().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default MarketAdminModal;
