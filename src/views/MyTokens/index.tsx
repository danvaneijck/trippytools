import { useCallback, useEffect, useRef, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";
import { MdImageNotSupported } from "react-icons/md";
import { FaEye } from "react-icons/fa";


const MyTokens = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const [tokens, setTokens] = useState([]);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [loading, setLoading] = useState(false);

    const getTokens = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        const userTokens = await module.getUserTokens(connectedAddress);
        console.log(userTokens)
        return userTokens;
    }, [networkConfig, connectedAddress]);

    useEffect(() => {
        setLoading(true)
        getTokens().then(fetchedTokens => {
            console.log("set tokens", fetchedTokens)
            setTokens(fetchedTokens);
            setLoading(false)
        }).catch(e => {
            console.error("Failed to fetch tokens:", e);
            setLoading(false)
        });
    }, [getTokens, networkConfig]);

    const TokenBalance = ({ denom, address, decimals }) => {
        const [balance, setBalance] = useState(null)
        useEffect(() => {
            if (balance) return
            const module = new TokenUtils(networkConfig)
            module.getBalanceOfToken(denom, address).then(balance => {
                setBalance(Number(balance.amount) / Math.pow(10, decimals))
            }).catch(e => {
                console.error("Failed to fetch balance:", e);
            });
        }, [denom, address, decimals, balance])

        return (
            <div>
                {balance ? balance : "..."}
            </div>
        )
    }

    const TokenHolders = ({ denom }) => {
        const [holders, setHolders] = useState(null)
        const [progress, setProgress] = useState("")

        useEffect(() => {
            if (holders) return
            const module = new TokenUtils(networkConfig)
            module.getTokenFactoryTokenHolders(denom, setProgress).then(holders => {
                setHolders(holders.length)
            }).catch(e => {
                console.error("Failed to fetch balance:", e);
            });
        }, [denom, holders])

        return (
            <div className="">
                {holders ? <div className="flex flex-row items-center">{holders}{" "}<FaEye className="ml-4" /></div> : "..."}
            </div>
        )
    }


    return (
        <div className="flex flex-col min-h-screen pb-10">
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-sm">
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

            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-xl px-2 py-10">

                        {connectedAddress ?
                            <div>
                                <div className="text-center text-white mb-5">
                                    <div className="text-xl">
                                        Mange tokens
                                    </div>
                                    <div className="text-xs">on Injective {currentNetwork}</div>
                                </div>
                                {!loading &&
                                    <div>
                                        <Link
                                            to="/token-launch"

                                        >
                                            <button disabled className="my-2 bg-slate-700 shadow-lg p-2 rounded-lg text-sm">
                                                Create New Token (soon)
                                            </button>

                                        </Link>
                                        <div className="flex flex-col">
                                            {tokens && tokens.length > 0 ? (
                                                <table className="table-auto w-full">
                                                    <thead>
                                                        <tr className="bg-slate-800 text-white text-left">
                                                            <th className="px-4 py-2">Logo</th>
                                                            <th className="px-4 py-2">Name</th>
                                                            <th className="px-4 py-2">Symbol</th>
                                                            <th className="px-4 py-2">Description</th>
                                                            <th className="px-4 py-2">Denom</th>
                                                            <th className="px-4 py-2">Total Supply</th>
                                                            <th className="px-4 py-2">Decimals</th>
                                                            <th className="px-4 py-2">Admin</th>
                                                            <th className="px-4 py-2">Balance</th>
                                                            <th className="px-4 py-2">Holders</th>

                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tokens.map((token, index) => (
                                                            <tr key={index} className="bg-slate-700 rounded-lg m-2 shadow-lg">
                                                                <td className="px-4 py-2">
                                                                    {token.metadata.logo ? (
                                                                        <img className="rounded-lg" src={token.metadata.logo} alt="Token Logo" width={50} />
                                                                    ) : (
                                                                        <MdImageNotSupported className="text-5xl text-slate-500" />
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-xs">{token.metadata.name || "-"}</td>
                                                                <td className="px-4 py-2 text-xs">{token.metadata.symbol || "-"}</td>
                                                                <td className="px-4 py-2 text-xs">{token.metadata.description || "-"}</td>
                                                                <td className="px-4 py-2 text-xs">
                                                                    <a href={`https://${currentNetwork}.explorer.injective.network/asset/?denom=${token.token}&tokenType=tokenFactory`}>{token.token.slice(0, 10)}...</a>
                                                                </td>
                                                                <td className="px-4 py-2 text-xs">{(token.metadata.total_supply / Math.pow(10, token.metadata.decimals)).toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-xs">{token.metadata.decimals}</td>
                                                                <td className="px-4 py-2 text-xs">
                                                                    {token.metadata.admin == connectedAddress ?
                                                                        <div className="bg-blue-600 rounded-lg text-center px-2  w-auto inline-block">You</div> :
                                                                        <div>
                                                                            {token.metadata.admin == "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49" ?
                                                                                <div className="bg-red-600 rounded-lg text-center px-2  w-auto inline-block">burned</div> :
                                                                                <div>token.metadata.admin{ }</div>}
                                                                        </div>
                                                                    }
                                                                </td>
                                                                <td className="px-4 py-2 text-xs">
                                                                    <TokenBalance denom={token.token} address={connectedAddress} decimals={token.metadata.decimals} />
                                                                </td>
                                                                <td className="px-4 py-2 text-xs">
                                                                    <Link
                                                                        to={`/token-holders?address=${token.token}`}
                                                                    >
                                                                        <TokenHolders denom={token.token} />
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="text-center mt-5">
                                                    You have no tokens on {currentNetwork}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                }

                            </div> :
                            <div className="text-center">
                                Please connect wallet to view your tokens
                            </div>
                        }
                        {loading &&
                            <div className="flex flex-col items-center justify-center pt-5">
                                <GridLoader color="#36d7b7" />
                            </div>
                        }
                    </div>
                </div>
            </div>

            <footer className="bg-gray-800 text-white text-xs p-4 fixed bottom-0 left-0 right-0">
                buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
            </footer>
        </div>
    );
};

export default MyTokens;
