import { useSelector } from "react-redux";
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import Footer from "../../components/App/Footer";
import { processAccountTx } from "../../modules/parseTx";
import { formatTransactionData } from "../../modules/formatTx";
import moment from "moment";
import { GridLoader } from "react-spinners";
import { useSearchParams } from 'react-router-dom';


const WalletExport = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [searchParams, setSearchParams] = useSearchParams();


    const [transactions, setTransactions] = useState([])
    const [processedTx, setProcessedTx] = useState([])
    const [csvData, setCsvData] = useState(null)
    const [finalJson, setFinalJson] = useState(null)

    const [walletAddress, setWalletAddress] = useState("")
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const [loading, setLoading] = useState(false);

    const [progress, setProgress] = useState("");

    useEffect(() => {
        const wallet = searchParams.get("wallet")
        if (wallet) {
            setWalletAddress(wallet)
        }
    }, [searchParams])


    const getWalletTransactions = useCallback(async () => {
        console.log("get wallet tx")
        setTransactions([])
        setFinalJson([])
        setLoading(true)
        const module = new TokenUtils(networkConfig)
        const allTx = await module.getAllAccountTx(walletAddress, setProgress)
        setTransactions(allTx)
        setLoading(false)
    }, [networkConfig, walletAddress])

    const parseWalletTransactions = useCallback(async () => {
        console.log("parse wallet tx")
        const parsed = processAccountTx(transactions, walletAddress)
        setProcessedTx(parsed)
        const array = formatTransactionData(parsed)
        setFinalJson(array)
    }, [transactions, walletAddress])

    useEffect(() => {
        if (connectedAddress && transactions.length == 0 && walletAddress && !loading) {
            getWalletTransactions().then(() => console.log("got tx")).catch(e => console.log(e))
        }
    }, [connectedAddress, getWalletTransactions, transactions, walletAddress, loading])

    useEffect(() => {
        if (transactions.length > 0 && walletAddress) {
            parseWalletTransactions().then(() => console.log("parsed tx")).catch(e => console.log(e))
        }
    }, [connectedAddress, parseWalletTransactions, transactions, walletAddress])

    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">
            <div className="pt-14 md:pt-24 mx-2 pb-20">
                <div className="min-h-full mt-2 md:mt-0 ">
                    <div className="text-white text-center text-3xl font-magic">
                        Wallet Exporter
                    </div>

                    <div className="flex flex-col justify-center mt-5 items-center">
                        <label className="text-center mb-1">Wallet Address</label>
                        <input
                            className="text-black m-auto p-1 rounded w-1/2"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                        />
                        <button
                            disabled={loading}
                            onClick={() => {
                                setSearchParams({
                                    wallet: walletAddress
                                })
                                getWalletTransactions()
                            }}
                            className="bg-gray-800 rounded-lg p-2 mt-5 text-white border border-slate-800 shadow-lg font-bold w-1/2"
                        >
                            Get wallet transactions
                        </button>

                    </div>


                    {loading && (
                        <div className="flex flex-col items-center justify-center pt-5">
                            <GridLoader color="#f9d73f" />
                            {progress.length > 0 && <div className="text-sm mt-2">
                                {progress}
                            </div>
                            }
                        </div>
                    )}

                    {transactions.length > 0 &&
                        <div className="flex flex-col justify-center mt-5 text-center">
                            Total transactions: {transactions.length}
                        </div>
                    }

                    {finalJson && finalJson.length > 0 && (
                        <div className="mt-2 overflow-x-auto text-sm text-white">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr className="grid grid-cols-7 text-left">
                                        <th className="px-4 py-2">Block Number</th>
                                        <th className="px-4 py-2">Block Time</th>
                                        <th className="px-4 py-2">TX Hash</th>
                                        <th className="px-4 py-2">TX Type</th>
                                        <th className="px-4 py-2">Signed</th>
                                        <th className="px-4 py-2">Funds Sent</th>
                                        <th className="px-4 py-2">Funds Received</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {finalJson.map((row, index) => (
                                        <tr key={index} className="border-b grid grid-cols-7">
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={row["Block Number"]}>
                                                {row["Block Number"]}
                                            </td>
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={moment(row["Block Time"]).format()}>
                                                {moment(row["Block Time"]).format()}
                                            </td>
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={row["TX Hash"]}>
                                                <a href={`https://explorer.injective.network/transaction/${row['TX Hash']}`}>
                                                    {row["TX Hash"]}
                                                </a>
                                            </td>
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={row["TX Type"]}>
                                                {row["TX Type"]}
                                            </td>
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={row["Signed"].toString()}>
                                                {row["Signed"].toString()}
                                            </td>
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={row["Funds Sent"]}>
                                                {row["Funds Sent"]}
                                            </td>
                                            <td className="col-span-1 px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis" title={row["Funds Received"]}>
                                                {row["Funds Received"]}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        </div>
                    )}

                </div>
            </div>
            <Footer />
        </div>
    );
}

export default WalletExport