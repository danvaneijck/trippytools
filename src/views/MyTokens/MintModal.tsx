import {
    MsgMint,
} from "@injectivelabs/sdk-ts";
import { useCallback, useState } from "react";
import { CircleLoader } from "react-spinners";
import useWalletStore from "../../store/useWalletStore";
import { performTransaction } from "../../utils/walletStrategy";


const MintModal = (props: {
    token: any
}) => {

    const { connectedWallet: connectedAddress } = useWalletStore()

    const [amount, setAmount] = useState('100');

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)


    const mint = useCallback(async () => {
        console.log(props.token)
        setError(null)

        const injectiveAddress = connectedAddress

        if (connectedAddress !== injectiveAddress) {
            setError("Wrong wallet connected")
            return
        }
        else {
            setError(null)
        }

        const msgMint = MsgMint.fromJSON({
            sender: injectiveAddress,
            amount: {
                amount: (Number(amount) * Math.pow(10, props.token.metadata.decimals)).toLocaleString('fullwide', { useGrouping: false }),
                denom: props.token.token
            }
        });

        console.log("mint", msgMint)
        setProgress(`Mint tokens`)

        await performTransaction(injectiveAddress, [msgMint])

        setProgress("Done...")

        props.setLoaded(false)
        props.setShowModal(null)
    }, [props, connectedAddress, amount])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Mint tokens
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
                                            Amount
                                        </label>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setAmount(e.target.value)
                                            }
                                            value={amount}
                                        />
                                    </div>

                                </div>

                            </div>

                            {progress && <div className="mt-5 whitespace-pre">progress: {progress}</div>}
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
                                onClick={() => mint().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Mint
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default MintModal