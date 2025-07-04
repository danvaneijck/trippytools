import { useCallback, useEffect, useState } from 'react';
import {
    MsgInstantBinaryOptionsMarketLaunch,
} from "@injectivelabs/sdk-ts";
import { CircleLoader } from "react-spinners";
import moment from 'moment';
import TokenUtils from '../../modules/tokenUtils';
import useWalletStore from '../../store/useWalletStore';
import useNetworkStore from '../../store/useNetworkStore';
import { performTransaction } from '../../utils/walletStrategy';

const NewMarketModal = (props: { setShowModal: (show: boolean) => void; }) => {

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [market, setMarket] = useState({
        ticker: `TEST ${connectedAddress ? connectedAddress.slice(-5) : "n/a"} ` + moment().unix().toString(),
        expirationTimestamp: moment().add(4, 'hours').unix(),
        makerFeeRate: "0",
        minPriceTickSize: "0.01",
        minQuantityTickSize: "1",
        oracleProvider: "Frontrunner",
        oracleScaleFactor: "6",
        oracleSymbol: "Frontrunner",
        oracleType: "provider",
        quoteDenom: "peggy0x87aB3B4C8661e07D6372361211B96ed4Dc36B1B5",
        settlementTimestamp: moment().add(5, 'hours').unix(),
        takerFeeRate: "0"
    });

    const [error, setError] = useState(null)

    useEffect(() => {

        const getOracles = async () => {
            const module = new TokenUtils(networkConfig)
            await module.fetchOracleList()
        }
        void getOracles()

    }, [networkConfig])


    const createMarket = useCallback(async () => {
        setError(null)

        const injectiveAddress = connectedAddress;

        const msgSetDenomMetadata = MsgInstantBinaryOptionsMarketLaunch.fromJSON({
            proposer: injectiveAddress,
            market: {
                admin: injectiveAddress,
                ticker: market.ticker,
                expirationTimestamp: market.expirationTimestamp,
                makerFeeRate: market.makerFeeRate,
                minPriceTickSize: market.minPriceTickSize,
                minQuantityTickSize: market.minQuantityTickSize,
                oracleProvider: market.oracleProvider,
                oracleScaleFactor: market.oracleScaleFactor,
                oracleSymbol: market.oracleSymbol,
                oracleType: 11,
                quoteDenom: market.quoteDenom,
                settlementTimestamp: market.settlementTimestamp,
                takerFeeRate: market.takerFeeRate
            }
        });

        console.log("msg", msgSetDenomMetadata)
        setProgress("Create binary options market")
        await performTransaction(injectiveAddress, [msgSetDenomMetadata])

        setProgress("Done...")

        props.setShowModal(false)
    }, [market, connectedAddress, props])

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
                                Create New Binary Options Market
                            </h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <form>
                                <div>
                                    <label>Ticker </label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="ticker" value={market.ticker} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Expiration Timestamp </label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="expirationTimestamp" value={market.expirationTimestamp} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Maker Fee Rate</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="makerFeeRate" value={market.makerFeeRate} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Min Price Tick Size</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="minPriceTickSize" value={market.minPriceTickSize} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Min Quantity Tick Size</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="minQuantityTickSize" value={market.minQuantityTickSize} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Oracle Provider</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="oracleProvider" value={market.oracleProvider} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Oracle Scale Factor</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="oracleScaleFactor" value={market.oracleScaleFactor} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Oracle Symbol</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="oracleSymbol" value={market.oracleSymbol} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Oracle Type</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="oracleType" value={market.oracleType} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Quote Denom</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="quoteDenom" value={market.quoteDenom} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Settlement Timestamp</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="settlementTimestamp" value={market.settlementTimestamp} onChange={handleInputChange} />
                                </div>
                                <div className='mt-1'>
                                    <label>Taker Fee Rate</label>
                                    <br />
                                    <input className='text-black w-full p-1 rounded-sm' type="text" name="takerFeeRate" value={market.takerFeeRate} onChange={handleInputChange} />
                                </div>
                            </form>
                            <div className='mt-2 text-lg'>Instant Market Creation Fee: {currentNetwork == "testnet" ? "10" : "?"} INJ</div>
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
                                onClick={() => createMarket().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default NewMarketModal;
