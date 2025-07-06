/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import { MdImageNotSupported } from "react-icons/md";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenMetadataModal from "./TokenMetadataModal";
import CreateSpotMarketModal from "./CreateSpotMarketModal";
import MintModal from "./MintModal";
import CreateMitoVault from "./CreateMitoVault";
import IPFSImage from "../../components/App/IpfsImage";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";


const MyTokens = () => {

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork } = useNetworkStore()
    const networkConfig = useNetworkStore((state) => state.network);

    const [tokens, setTokens] = useState([]);

    const [showMetaDataModel, setShowMetadataModal] = useState(null);
    const [showSpotMarketModal, setShowSpotMarketModal] = useState(null);
    const [showMint, setShowMint] = useState(null);
    const [showMitoVault, setShowMitoVault] = useState(null);

    const [injPrice, setInjPrice] = useState(null)
    const [injBalance, setINJBalance] = useState(null)

    const [helixSpotMarkets, setHelixSpotMarkets] = useState([])
    const [mitoVaults, setMitoVaults] = useState([])
    const [balances, setBalances] = useState([])

    const [loading, setLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false)

    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(false)
    }, [currentNetwork])

    const getTokens = useCallback(async () => {
        console.log("get user tokens", networkConfig)
        const module = new TokenUtils(networkConfig);
        try {
            const userTokens = await module.getUserTokens(connectedAddress);
            console.log(userTokens)
            return userTokens;
        } catch (error) {
            console.error('Failed to fetch tokens:', error);
            throw error;
        }
    }, [networkConfig, connectedAddress]);

    const getSpotMarkets = useCallback(async () => {
        console.log("get spot markets")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchSpotMarkets();
            return markets;
        } catch (error) {
            console.error('Failed to fetch spot markets:', error);
            throw error;
        }
    }, [networkConfig]);

    const getMitoVaults = useCallback(async () => {
        console.log("get mito vaults")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchMitoVaults();
            return markets;
        } catch (error) {
            console.error('Failed to fetch mito vaults:', error);
            throw error;
        }
    }, [networkConfig]);

    const getINJPrice = useCallback(async () => {
        console.log("get INJ price")
        const module = new TokenUtils(networkConfig);
        try {
            const price = await module.getINJDerivativesPrice();
            const balance = await module.getBalanceOfToken('inj', connectedAddress)
            console.log(balance)
            setINJBalance(Number(balance.amount) / Math.pow(10, 18))
            setInjPrice(price)
            return price;
        } catch (error) {
            console.error('Failed to fetch INJ price:', error);
            throw error;
        }
    }, [connectedAddress, networkConfig]);

    const getBalances = useCallback(async () => {
        console.log("get balances")
        const module = new TokenUtils(networkConfig);
        try {
            const balances = await module.getBalances(connectedAddress);
            console.log(balances)
            return balances
        } catch (error) {
            console.error('Failed to fetch balances:', error);
            throw error;
        }
    }, [connectedAddress, networkConfig]);


    useEffect(() => {
        setLoaded(false)
    }, [connectedAddress])

    useEffect(() => {
        const fetchData = async () => {
            if (!connectedAddress) return;
            if (loaded) return;
            if (loading) return;

            setLoading(true);
            setShowMint(null)
            setShowMitoVault(null)
            setShowSpotMarketModal(null)

            try {
                const fetchedTokens = await getTokens();
                try {
                    const spotMarkets = await getSpotMarkets();
                    const mitoVaults = await getMitoVaults();
                    // const balances = await getBalances()

                    const extendedTokens = fetchedTokens.map(token => {
                        const market = spotMarkets.find(market => market.baseDenom.toString() === token.token.toString());
                        let vault = null
                        if (market) {
                            vault = mitoVaults.find(vault => vault.marketId.toString() === market.marketId.toString());
                        }

                        return {
                            ...token,
                            marketId: market ? market.marketId : null,
                            mitoVaultContractAddress: vault ? vault.contractAddress : null,
                            mitoVault: vault
                        };
                    });

                    // const extendedBalances = balances.map(balance => {
                    //     const market = spotMarkets.find(market => (balance.token && market.baseDenom.toString() === balance.token.denom.toString()));
                    //     let vault = null
                    //     if (market) {
                    //         vault = mitoVaults.find(vault => vault.marketId.toString() === market.marketId.toString());
                    //     }

                    //     return {
                    //         ...balance,
                    //         marketId: market ? market.marketId : null,
                    //         mitoVaultContractAddress: vault ? vault.contractAddress : null,
                    //         mitoVault: vault
                    //     };
                    // });

                    setHelixSpotMarkets(spotMarkets);
                    setMitoVaults(mitoVaults)
                    setTokens(extendedTokens);
                    // setBalances(extendedBalances)

                    await getINJPrice()


                    setLoaded(true);
                } catch (e) {
                    console.error("Failed to fetch spot markets:", e);
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error("Failed to fetch tokens:", e);
                }
            } finally {
                setLoading(false);
            }
        };

        console.log("call fetch data")
        void fetchData();
    }, [getTokens, loaded, loading, connectedAddress, getSpotMarkets, getMitoVaults, getBalances, getINJPrice]);



    const burnAdmin = useCallback(async (subdenom) => {
        const injectiveAddress = connectedAddress;

        const msgChangeAdmin = MsgChangeAdmin.fromJSON({
            denom: `factory/${injectiveAddress}/${subdenom}`,
            sender: injectiveAddress,
            newAdmin: 'inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49'
        });
        await performTransaction(injectiveAddress, [msgChangeAdmin])
        setLoaded(false)
    }, [connectedAddress])

    return (
        <>
            {showMetaDataModel !== null && <TokenMetadataModal setShowModal={setShowMetadataModal} token={showMetaDataModel} setLoaded={setLoaded} />}
            {showSpotMarketModal !== null && <CreateSpotMarketModal setShowModal={setShowSpotMarketModal} token={showSpotMarketModal} setLoaded={setLoaded} />}
            {showMint !== null && <MintModal setShowModal={setShowMint} token={showMint} setLoaded={setLoaded} />}
            {showMitoVault !== null && <CreateMitoVault setShowModal={setShowMitoVault} token={showMitoVault} setLoaded={setLoaded} />}
            <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                <div className="pt-16 md:pt-24 mx-2 pb-20">
                    {currentNetwork == "mainnet" && <div className="mb-2"><ShroomBalance /></div>}
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full px-2 ">
                            <div className="text-center text-white mb-5 font-magic">
                                <div className="text-3xl">
                                    Mange token factory tokens
                                </div>
                                <div className="text-lg">on Injective {currentNetwork}</div>
                            </div>
                            <div className="mt-2">
                                <Link
                                    to="/token-launch"

                                >
                                    <button className="my-2 bg-slate-700 shadow-lg p-2 rounded-lg text-sm  hover:font-bold">
                                        Create New Token
                                    </button>
                                </Link>
                                <Link
                                    to="/airdrop"
                                >
                                    <button className="my-2 bg-slate-700 shadow-lg p-2 rounded-lg text-sm ml-2 hover:font-bold">
                                        New Airdrop
                                    </button>
                                </Link>
                            </div>
                            {connectedAddress ?
                                <div>
                                    {injPrice &&
                                        <div>INJ  price: ${Number(injPrice).toFixed(2)}</div>
                                    }
                                    {injPrice && injBalance &&
                                        <div>INJ  balance: {injBalance.toFixed(2)} (${(injBalance * injPrice).toFixed(2)})</div>
                                    }
                                    {!loading &&
                                        <div className="mt-2">
                                            <div className="flex flex-row justify-between">
                                                <div>

                                                </div>
                                                <button
                                                    className="my-2 bg-slate-700 shadow-lg p-2 rounded-lg text-sm ml-2 hover:font-bold"
                                                    onClick={() => {
                                                        setLoaded(false)
                                                    }}
                                                >
                                                    Refresh
                                                </button>
                                            </div>
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
                                                                <th className="px-4 py-2">Holders</th>
                                                                <th className="px-4 py-2">Spot Market</th>
                                                                <th className="px-4 py-2">Mito Vault</th>
                                                                <th className="px-4 py-2">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {tokens.map((token) => (
                                                                <tr key={token.token} className="bg-slate-700 rounded-lg m-2 shadow-lg">
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
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <a
                                                                            target="_blank"
                                                                            href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}explorer.injective.network/asset/?denom=${token.token}&tokenType=tokenFactory`}>
                                                                            {token.token.slice(0, 5)}...{token.token.slice(-5)}
                                                                        </a>
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
                                                                    <td className="px-4 py-2 text-xs ">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`/token-holders?address=${token.token}`}
                                                                        >
                                                                            view holders
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}helixapp.com/spot/?marketId=${token.marketId}`}
                                                                        >
                                                                            {token.marketId ? token.marketId.slice(0, 5) + "..." : "none"}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}mito.fi/vault/${token.mitoVaultContractAddress}`}
                                                                        >
                                                                            {token.mitoVaultContractAddress ? token.mitoVaultContractAddress.slice(0, 5) + "..." : "none"}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">
                                                                        {token.metadata.admin == connectedAddress &&
                                                                            <> <button onClick={() => { setShowMint(token) }} className="my-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                Mint
                                                                            </button>
                                                                                <button onClick={() => { burnAdmin(token.metadata.symbol) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                    Burn admin
                                                                                </button>
                                                                                <button onClick={() => { setShowMetadataModal(token) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                    Update metadata
                                                                                </button>
                                                                                {token.marketId == null &&
                                                                                    <button onClick={() => { setShowSpotMarketModal(token) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                        Create helix market
                                                                                    </button>
                                                                                }
                                                                                {token.mitoVaultContractAddress == null && token.marketId !== null &&
                                                                                    <button onClick={() => { setShowMitoVault(token) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                        Create mito vault
                                                                                    </button>
                                                                                }
                                                                            </>
                                                                        }
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
                                            <div>
                                                <div className="text-2xl my-2">Your Token Balances</div>
                                                {balances && balances.length > 0 ? (
                                                    <table className="table-auto w-full">
                                                        <thead>
                                                            <tr className="bg-slate-800 text-white text-left">
                                                                <th className="px-4 py-2">Logo</th>
                                                                <th className="px-4 py-2">Name</th>
                                                                <th className="px-4 py-2">Symbol</th>
                                                                <th className="px-4 py-2">Description</th>
                                                                <th className="px-4 py-2">Denom</th>
                                                                <th className="px-4 py-2">Balance</th>
                                                                <th className="px-4 py-2">Holders</th>
                                                                <th className="px-4 py-2">Spot Market</th>
                                                                <th className="px-4 py-2">Mito Vault</th>
                                                                <th className="px-4 py-2">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {balances.map((balance) => (
                                                                <tr key={balance.token.denom} className="bg-slate-700 rounded-lg m-2 shadow-lg">
                                                                    <td className="px-4 py-2">
                                                                        {(balance.metadata.logo && balance.metadata.logo.length > 0) || (balance.metadata.logo.url) ? (
                                                                            <IPFSImage
                                                                                className="rounded-lg"
                                                                                ipfsPath={
                                                                                    balance.metadata.logo.url ? balance.metadata.logo.url : balance.metadata.logo
                                                                                }
                                                                                alt="Token Logo" width={50} />
                                                                        ) : (
                                                                            <MdImageNotSupported className="text-5xl text-slate-500" />
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">{balance.metadata.name || "-"}</td>
                                                                    <td className="px-4 py-2 text-xs">{balance.metadata.symbol || "-"}</td>
                                                                    <td className="px-4 py-2 text-xs">{balance.metadata.description || "-"}</td>
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <a
                                                                            target="_blank"
                                                                            href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}explorer.injective.network/asset/?denom=${balance.token.denom}&tokenType=tokenFactory`}>
                                                                            {balance.token.denom.slice(0, 5)}...{balance.token.denom.slice(-5)}
                                                                        </a>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">{(Number(balance.token.amount) / Math.pow(10, balance.metadata.decimals)) || "-"}</td>

                                                                    <td className="px-4 py-2 text-xs ">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`/token-holders?address=${balance.token.denom}`}
                                                                        >
                                                                            view holders
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}helixapp.com/spot/?marketId=${balance.marketId}`}
                                                                        >
                                                                            {balance.marketId ? balance.marketId.slice(0, 5) + "..." : "none"}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}mito.fi/vault/${balance.mitoVaultContractAddress}`}
                                                                        >
                                                                            {balance.mitoVaultContractAddress ? balance.mitoVaultContractAddress.slice(0, 5) + "..." : "none"}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">
                                                                        {balance.marketId == null &&
                                                                            <button onClick={() => { setShowSpotMarketModal({ ...balance, token: balance.token.denom }) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                Create helix market
                                                                            </button>
                                                                        }
                                                                        {balance.mitoVaultContractAddress == null && balance.marketId !== null &&
                                                                            <button onClick={() => { setShowMitoVault({ ...balance, token: balance.token.denom }) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                Create mito vault
                                                                            </button>
                                                                        }
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
                                    <GridLoader color="#f9d73f" />
                                </div>
                            }
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        </>

    );
};

export default MyTokens;
