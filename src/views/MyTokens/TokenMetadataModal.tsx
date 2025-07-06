import {
    MsgSetDenomMetadata,
} from "@injectivelabs/sdk-ts";
import { useCallback, useState } from "react";
import { MdImageNotSupported } from "react-icons/md";
import { CircleLoader } from "react-spinners";
import IPFSImage from "../../components/App/IpfsImage";
import useWalletStore from "../../store/useWalletStore";
import { performTransaction } from "../../utils/walletStrategy";


const TokenMetadataModal = (props: {
    token: any
}) => {

    const { connectedWallet: connectedAddress } = useWalletStore()

    const [tokenImage, setTokenImageUrl] = useState("https://");
    const [tokenDescription, setTokenDescription] = useState("new token description!");

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

    const updateMetadata = useCallback(async () => {
        setError(null)
        const injectiveAddress = connectedAddress

        const msgSetDenomMetadata = MsgSetDenomMetadata.fromJSON({
            sender: injectiveAddress,
            metadata: {
                base: props.token.metadata.denom,
                description: tokenDescription,
                display: props.token.metadata.symbol,
                name: props.token.metadata.name,
                symbol: props.token.metadata.symbol,
                uri: tokenImage,
                denomUnits: props.token.metadata.denomUnits,
                decimals: props.token.metadata.decimals,
                uriHash: ""
            }
        });

        console.log("metadata", msgSetDenomMetadata)
        setProgress("Upload denom metadata")
        await performTransaction(injectiveAddress, [msgSetDenomMetadata])

        setProgress("Done...")

        props.setLoaded(false)
        props.setShowModal(null)
    }, [props, tokenDescription, tokenImage, connectedAddress])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Update token metadata
                            </h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <div className="flex flex-col md:flex-row">
                                <div>
                                    <div>Connected address: {connectedAddress && connectedAddress}</div>

                                    <div>Token denom: {props.token && props.token.token}</div>
                                    <div className="mt-2 ">
                                        <label
                                            className="font-bold text-white "
                                        >
                                            Token description
                                        </label>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setTokenDescription(e.target.value)
                                            }
                                            value={tokenDescription}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label
                                            className="block font-bold text-white"
                                        >
                                            Token image URL
                                        </label>
                                        <span className="text-xs">the logo of your token, should be hosted on IPFS and should be a small webp image</span>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setTokenImageUrl(e.target.value)
                                            }
                                            value={tokenImage}
                                        />
                                    </div>
                                </div>
                                <div className="ml-0 mt-5 md:ml-10 md:mt-0">
                                    token image
                                    {tokenImage ?
                                        <IPFSImage
                                            width={100}
                                            className={'rounded'}
                                            ipfsPath={tokenImage}

                                        />
                                        :
                                        <MdImageNotSupported className="text-5xl text-slate-500" />
                                    }
                                </div>
                            </div>
                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(null)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => updateMetadata().then(() => console.log("done")).catch(e => {
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

export default TokenMetadataModal