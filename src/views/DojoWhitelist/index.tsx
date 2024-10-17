import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useCallback, useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenUtils from "../../modules/tokenUtils";
import { MsgExecuteContract, MsgSend } from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";
import Footer from "../../components/App/Footer";
import { humanReadableAmount } from "../../utils/helpers";
import { getKeplrOfflineSigner, handleSendTx } from "../../utils/keplr";
import IPFSImage from "../../components/App/IpfsImage";

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
const DOJO_FACTORY = "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk"


const DojoWhitelist = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [denom, setDenom] = useState("factory/inj1sy2aad37tku3dz0353epczxd95hvuhzl0lhfqh/FUN")
    const [tokenInfo, setTokenInfo] = useState(null)
    const [tokenOwner, setTokenOwner] = useState(null)

    const shroomCost = 5000
    const [shroomPrice, setShroomPrice] = useState(null)
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const getShroomCost = async () => {
            const module = new TokenUtils(networkConfig)
            try {
                const [baseAssetPrice, pairInfo] = await Promise.all([
                    module.getINJPrice(),
                    module.getPairInfo(SHROOM_PAIR_ADDRESS)
                ]);
                const quote = await module.getSellQuoteRouter(pairInfo, shroomCost + "0".repeat(18));
                console.log(quote)
                const returnAmount = Number(quote.amount) / Math.pow(10, 18);
                const totalUsdValue = (returnAmount * baseAssetPrice).toFixed(3);
                setShroomPrice(totalUsdValue);
                return totalUsdValue
            } catch (error) {
                console.error('Failed to update balance and USD value:', error);
            }
        }
        if (currentNetwork == "mainnet") {
            getShroomCost().then(r => {
                console.log(r)
            }).catch(e => {
                console.log(e)
            })
        }
    }, [currentNetwork, networkConfig, shroomCost])

    const getTokenInfo = useCallback(() => {
        const module = new TokenUtils(networkConfig)
        module.getDenomExtraMetadata(denom)
            .then((meta) => {
                setTokenInfo(meta);
                const owner = meta.denom.split("/")[1]
                setTokenOwner(owner)
            }).catch(e => {
                console.log(e)
            })
    }, [networkConfig, denom])

    const sendWhitelist = useCallback(async () => {
        if (!denom) {
            return
        }

        const { key, offlineSigner } = await getKeplrOfflineSigner(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (connectedAddress !== injectiveAddress) {
            setError("wrong address connected")
            return
        }
        setError(null)

        if (connectedAddress !== tokenOwner) {
            setError("You are trying to whitelist using the wrong wallet address")
            return
        }
        setError(null)

        const feeMsg = MsgExecuteContract.fromJSON({
            contractAddress: SHROOM_TOKEN_ADDRESS,
            sender: injectiveAddress,
            msg: {
                transfer: {
                    recipient: FEE_COLLECTION_ADDRESS,
                    amount: (shroomCost).toFixed(0) + "0".repeat(18),
                },
            },
        });

        const msgSend = MsgSend.fromJSON({
            amount: {
                denom: tokenInfo.denom,
                amount: "1"
            },
            dstInjectiveAddress: DOJO_FACTORY,
            srcInjectiveAddress: injectiveAddress
        });

        const addTokenDecimals = MsgExecuteContract.fromJSON({
            contractAddress: DOJO_FACTORY,
            sender: injectiveAddress,
            msg: {
                add_native_token_decimals: {
                    denom: tokenInfo.denom,
                    decimals: tokenInfo.decimals
                }
            },
            funds: []
        })

        console.log(msgSend)
        console.log(addTokenDecimals)

        // const gas = {
        //     amount: [
        //         {
        //             denom: "inj",
        //             amount: '3500000'
        //         }
        //     ],
        //     gas: '3500000'
        // };

        const result = await handleSendTx(
            networkConfig,
            pubKey,
            [
                // feeMsg,
                msgSend,
                addTokenDecimals
            ],
            injectiveAddress,
            offlineSigner,
            // gas
        )

        if (result) {
            setSuccess(true)
        }
    }, [denom, networkConfig, connectedAddress, tokenOwner, tokenInfo])

    return (
        <div className="flex flex-col min-h-screen pb-10">
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-xs md:text-sm">
                    <Link to="/" className="ml-5 font-bold hover:underline mr-5">
                        home
                    </Link>
                    <Link
                        to="/token-holders"
                        className="font-bold hover:underline mr-5"
                    >
                        holder tool
                    </Link>
                    <Link
                        to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                        className="font-bold hover:underline "
                    >
                        liquidity tool
                    </Link>

                </div>
                <div className="m-2">
                    <ConnectKeplr />
                </div>
            </header>
            <div className="pt-14 mx-2 pb-20">
                {currentNetwork == "mainnet" && <div className="mt-2 md:mt-0"><ShroomBalance /></div>}
                <div className="min-h-full mt-2 md:mt-0 ">
                    <div className="text-white text-center text-3xl font-magic">
                        Whitelist native token on DojoSwap factory
                    </div>
                    <div className="w-full md:w-1/2 text-center text-sm m-auto mt-2">
                        This tool whitelists a native token factory token on the DojoSwap factory so you can add LP.
                    </div>
                    <div className="w-full md:w-1/2 text-center text-sm m-auto mt-2">
                        Note: We will send 0.00001 units of token to the factory for whitelisting
                    </div>
                    <div className="mt-2 w-full md:w-1/2 m-auto">
                        <label
                            className="text-base font-bold text-white "
                        >
                            Token denom
                        </label>
                        <input
                            type="text"
                            className="text-black w-full rounded p-1 text-sm"
                            onChange={(e) =>
                                setDenom(e.target.value)
                            }
                            value={denom}
                        />
                        <button
                            onClick={getTokenInfo}
                            className="p-2 rounded-lg text-center bg-slate-700 hover:bg-slate-800 mt-2"
                        >
                            Get token details
                        </button>

                        {tokenInfo &&
                            <div className="mt-5 text-white mr-20 flex flex-row justify-between">
                                <div>

                                    <div className="font-bold">address: {tokenInfo.denom}</div>
                                    <div>name: {tokenInfo.name}</div>
                                    <div>symbol: {tokenInfo.symbol}</div>
                                    {tokenInfo.decimals !== null && <div>decimals: {tokenInfo.decimals}</div>}
                                </div>
                                {tokenInfo.logo &&
                                    <IPFSImage
                                        width={100}
                                        className={'mb-2 rounded-lg ml-10'}
                                        ipfsPath={tokenInfo.logo}
                                    />
                                }
                            </div>
                        }
                    </div>

                    {shroomPrice &&
                        <div className="w-full md:w-1/2 m-auto mt-5">
                            Fee: {humanReadableAmount(shroomCost)} shroom (${shroomPrice ? shroomPrice : '0'}) <br />
                            <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                        </div>

                    }
                    {tokenOwner &&
                        <div className="w-full md:w-1/2 text-center text-sm m-auto mt-2">
                            Note: Please make sure to use {tokenOwner} address to whitelist
                        </div>
                    }
                    {tokenInfo !== null &&
                        <div
                            className="bg-slate-800 w-40 m-auto mt-5 p-2 text-center rounded shadow-lg hover:cursor-pointer"
                            onClick={sendWhitelist}
                        >
                            Whitelist token
                        </div>
                    }

                    {error !== null &&
                        <div className="text-rose-600 text-lg mt-5 text-center">
                            {error}
                        </div>
                    }
                    {success &&
                        <div className="text-emerald-600 text-lg mt-5 text-center">
                            Token successfully whitelisted
                        </div>
                    }
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default DojoWhitelist