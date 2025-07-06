import {
    MsgCreateDenom,
    MsgMint,
    MsgSetDenomMetadata,
} from "@injectivelabs/sdk-ts";
import { BigNumberInBase } from "@injectivelabs/utils";
import { useCallback, useState } from "react";
import { MdImageNotSupported } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import IPFSImage from "../../components/App/IpfsImage";
import { sendTelegramMessage } from "../../modules/telegram";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";


const TokenConfirmModal = (props: {
    tokenDescription: string;
    tokenImage: string;
    tokenDecimals: number;
    tokenSupply: number;
    tokenSymbol: string;
    tokenName: string;
    setShowModal: (arg0: boolean) => void;
}) => {

    const { connectedWallet } = useWalletStore()
    const { networkKey } = useNetworkStore()

    const navigate = useNavigate();

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

    const createAndMint = useCallback(async () => {
        if (!connectedWallet) return
        setError(null)

        const subdenom = props.tokenSymbol
        const denom = `factory/${connectedWallet}/${subdenom}`;
        const amount = props.tokenSupply
        const description = props.tokenDescription
        const image = props.tokenImage
        const name = props.tokenName
        const decimals = props.tokenDecimals

        const msgCreateDenom = MsgCreateDenom.fromJSON({
            subdenom,
            sender: connectedWallet,
        });

        const msgMint = MsgMint.fromJSON({
            sender: connectedWallet,
            amount: {
                denom: `factory/${connectedWallet}/${subdenom}`,
                amount: new BigNumberInBase(amount)
                    .toWei(props.tokenDecimals)
                    .toFixed()
            }
        });

        const msgSetDenomMetadata = MsgSetDenomMetadata.fromJSON({
            sender: connectedWallet,
            metadata: {
                base: denom,
                description: description,
                display: subdenom,
                name: name,
                symbol: subdenom,
                uri: image,
                decimals: decimals,
                denomUnits: [
                    {
                        denom: denom,
                        exponent: 0,
                        aliases: [`u${subdenom.toLowerCase()}`]
                    },
                    {
                        denom: subdenom,
                        exponent: decimals,
                        aliases: []
                    },
                ],
                uriHash: ""
            }
        });


        setProgress("Create new denom")
        await performTransaction(connectedWallet, [msgCreateDenom, msgMint, msgSetDenomMetadata])

        setProgress("Done...")

        if (networkKey == "mainnet") await sendTelegramMessage(`wallet ${connectedWallet} created a new token on trippyinj!\nname: ${props.tokenName}\nsymbol: ${props.tokenSymbol}\ndenom: ${denom}`)

        navigate('/manage-tokens');

    }, [connectedWallet, networkKey, props.tokenSymbol, props.tokenSupply, props.tokenDecimals, props.tokenDescription, props.tokenName, props.tokenImage, navigate])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Launch on {networkKey}
                            </h3>
                        </div>
                        {connectedWallet &&
                            <div className="relative p-6 flex-auto">
                                <div className="flex flex-col md:flex-row">
                                    <div>
                                        <div>Name: {props.tokenName}</div>
                                        <div>Symbol: {props.tokenSymbol}</div>
                                        <div>Supply: {props.tokenSupply}</div>
                                        <div>Decimals: {props.tokenDecimals}</div>
                                        <div>Admin address: {connectedWallet}</div>
                                        <div>Token denom: {`factory/${connectedWallet}/${props.tokenSymbol}`}</div>
                                        <div>Tokens to your wallet: {(props.tokenSupply).toFixed(props.tokenDecimals)}</div>
                                    </div>
                                    <div className="ml-0 mt-5 md:ml-10 md:mt-0">
                                        token image
                                        {props.tokenImage ?
                                            <IPFSImage
                                                width={100}
                                                className={'rounded'}
                                                ipfsPath={props.tokenImage}

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
                        }

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
                                onClick={() => createAndMint().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Launch
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default TokenConfirmModal