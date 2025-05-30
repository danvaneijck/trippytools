import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    MsgInstantSpotMarketLaunch,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import SpotMarketConfigDropdownTable from "../../components/App/SpotMarketOptionsTable";
import { getKeplrOfflineSigner, handleSendTx } from "../../utils/keplr";


const CreateSpotMarketModal = (props: {
    token: any
}) => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [priceTickSize, setPriceTickSize] = useState('0.0000001');
    const [quantityTickSize, setQuantityTickSize] = useState(100);

    const [marketLink, setMarketLink] = useState(null)

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)


    const create = useCallback(async () => {
        setError(null)
        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;
        if (connectedAddress !== injectiveAddress) {
            setError("Wrong wallet connected")
            return
        }
        else {
            setError(null)
        }
        if (!props.token) return
        let minPriceTick
        const priceTickDecimals = (18 - props.token.metadata.decimals)

        if (priceTickDecimals == 0) {
            minPriceTick = priceTickSize
        }
        else {
            minPriceTick = (Number(priceTickSize) * Math.pow(10, priceTickDecimals)).toLocaleString('fullwide', { useGrouping: false })
        }
        const minQuantityTick = (Number(quantityTickSize) * Math.pow(10, props.token.metadata.decimals)).toLocaleString('fullwide', { useGrouping: false })

        console.log(minPriceTick, minQuantityTick)

        const minNotional = 1 * Math.pow(10, 18)

        const msgCreateSpotMarket = MsgInstantSpotMarketLaunch.fromJSON({
            proposer: injectiveAddress,
            market: {
                sender: injectiveAddress,
                ticker: `${props.token.metadata.symbol}/INJ`,
                baseDenom: props.token.token,
                quoteDenom: 'inj',
                minPriceTickSize: minPriceTick.toString(),
                minQuantityTickSize: minQuantityTick.toString(),
                minNotional: minNotional.toString()
            }
        });

        console.log("spot market msg", msgCreateSpotMarket)
        setProgress(`Create instant spot market`)

        const response = await handleSendTx(networkConfig, pubKey, msgCreateSpotMarket, injectiveAddress, offlineSigner)
        console.log(response)
        let market = null
        const contract = response['events']?.find(x => x.type === 'injective.exchange.v1beta1.EventSpotMarketUpdate')
        if (contract) {
            market = contract['attributes'].find(x => x.key === "market").value
        }
        if (market) {
            const decoded = JSON.parse(market)
            console.log(decoded['market_id'])
            setMarketLink(`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}helixapp.com/spot/?marketId=${decoded['market_id']}`)
        }
        setProgress("Spot market created! Go back and refresh")

    }, [connectedAddress, props.token, quantityTickSize, priceTickSize, currentNetwork, networkConfig])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Create instant spot market
                            </h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <p>
                                Completing this action will instantly launch a spot market on Helix
                            </p>
                            <div className="my-2 text-lg">
                                TICKER: {`${props.token.metadata.symbol}/INJ`}
                            </div>
                            <div className="flex flex-col md:flex-row">
                                <div>
                                    <div>Connected address: {connectedAddress && connectedAddress}</div>
                                    <div>Token denom: {props.token && props.token.token}</div>
                                    <div className="mt-4 ">
                                        <label
                                            className=" block font-bold text-white "
                                        >
                                            Price Tick Size
                                        </label>
                                        <span className="text-xs">
                                            the number of decimals in the quote token (INJ)
                                        </span>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setPriceTickSize(e.target.value)
                                            }
                                            value={priceTickSize}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label
                                            className="block font-bold text-white"
                                        >
                                            Quantity Tick Size
                                        </label>
                                        <span className="text-xs">
                                            the minimum trade amount of your token
                                        </span>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setQuantityTickSize(e.target.value)
                                            }
                                            value={quantityTickSize}
                                        />
                                    </div>
                                    <SpotMarketConfigDropdownTable />
                                </div>
                            </div>
                            <div className="mt-5 text-base">
                                Fee for spot market creation: <span className="font-bold text-xl">{currentNetwork == "mainnet" ? 20 : 100} INJ</span>
                            </div>
                            {marketLink &&
                                <div className="mt-4">
                                    <Link
                                        className="underline mt-2 text-xl"
                                        target="_blank"
                                        to={marketLink}
                                    >
                                        Helix Spot Market Link
                                    </Link>
                                </div>
                            }
                            {progress && <div className="mt-5 whitespace-pre">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => {
                                    if (marketLink !== null) {
                                        props.setLoaded(false)
                                    }
                                    props.setShowModal(null)
                                }}
                            >
                                Back
                            </button>
                            {marketLink === null &&
                                <button
                                    className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                    type="button"
                                    onClick={() => create().then(() => console.log("done")).catch(e => {
                                        console.log(e)
                                        setError(e.message)
                                        setProgress("")
                                        setTxLoading(false)
                                    })}
                                >
                                    Create
                                </button>
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default CreateSpotMarketModal