import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";

const AirdropModal = (props) => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

    const sendAirdrops = useCallback(async () => {

    }, [])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Perform pre sale airdrop
                            </h3>

                        </div>

                        <div className="relative p-6 flex-auto mx-5">
                            <div>
                                <p>
                                    Airdropping token: {props.tokenInfo.symbol}
                                </p>
                                <p>
                                    Required {props.tokenInfo.symbol}: {props.airdropDetails.reduce((accumulator, current) => {
                                        return accumulator + current.amount;
                                    }, 0) / Math.pow(10, props.tokenInfo.decimals)} {props.tokenInfo.symbol}
                                </p>
                                {props.airdropDetails !== null && props.airdropDetails.length > 0 &&
                                    <div className="mt-5">
                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                            <div>Total wallets to airdrop: {props.airdropDetails.length}</div>
                                            <div className="mt-2">
                                                <table className="table-auto w-full text-left">
                                                    <thead className="text-white">
                                                        <tr>
                                                            <th className="px-4 py-2">
                                                                Address
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Airdrop
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {props.airdropDetails.filter(x => Number(Number(x.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0).map((holder, index) => (
                                                            <tr key={index} className="text-white border-b text-xs">
                                                                <td className="px-4 py-1 whitespace-nowrap">
                                                                    <a
                                                                        className="hover:text-indigo-900"
                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                    >
                                                                        {holder.address}
                                                                        {
                                                                            WALLET_LABELS[holder.address] ? (
                                                                                <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                    {WALLET_LABELS[holder.address].label}
                                                                                </span>
                                                                            ) : null
                                                                        }
                                                                    </a>
                                                                </td>
                                                                <td className="px-4 py-1">
                                                                    {(Number(holder.amountFormatted))} {props.tokenInfo.symbol}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                }
                                {
                                    props.airdropDetails !== null && props.airdropDetails.length == 0 &&
                                    <div
                                        className="my-5 text-lg"
                                    >
                                        No airdrops to send
                                    </div>
                                }
                            </div>
                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>
                        <div className="pl-6 mb-5">If the airdrop TX fails, up the gas !</div>

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
                                onClick={() => sendAirdrops().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Send Airdrops
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default AirdropModal