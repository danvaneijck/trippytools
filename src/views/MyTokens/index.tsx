/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";
import { MdImageNotSupported } from "react-icons/md";
import { BaseAccount, BroadcastModeKeplr, ChainRestAuthApi, ChainRestTendermintApi, CosmosTxV1Beta1Tx, createTransaction, getTxRawFromTxRawOrDirectSignResponse, MsgChangeAdmin, MsgSetDenomMetadata, TxRaw, TxRestClient } from "@injectivelabs/sdk-ts";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { TransactionException } from "@injectivelabs/exceptions";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenMetadataModal from "./TokenMetadataModal";
import CreateSpotMarketModal from "./CreateSpotMarketModal";
import MintModal from "./MintModal";
import CreateMitoVault from "./CreateMitoVault";


const MyTokens = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const [tokens, setTokens] = useState([]);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const [showMetaDataModel, setShowMetadataModal] = useState(null);
    const [showSpotMarketModal, setShowSpotMarketModal] = useState(null);
    const [showMint, setShowMint] = useState(null);
    const [showMitoVault, setShowMitoVault] = useState(null);

    const [injPrice, setInjPrice] = useState(null)
    const [injBalance, setINJBalance] = useState(null)

    const [helixSpotMarkets, setHelixSpotMarkets] = useState([])
    const [mitoVaults, setMitoVaults] = useState([])

    const [loading, setLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false)

    const [loaded, setLoaded] = useState(false);

    const getTokens = useCallback(async () => {
        console.log("get user tokens")
        const module = new TokenUtils(networkConfig);
        try {
            const userTokens = await module.getUserTokens(connectedAddress);
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
            console.error('Failed to fetch spot markets:', error);
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
            console.error('Failed to fetch spot markets:', error);
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

                    setHelixSpotMarkets(spotMarkets);
                    setMitoVaults(mitoVaults)
                    setTokens(extendedTokens);

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

        fetchData();
    }, [getTokens, loaded, loading, connectedAddress, getSpotMarkets, getMitoVaults]);

    const getKeplr = useCallback(async () => {
        await window.keplr.enable(networkConfig.chainId);
        const offlineSigner = window.keplr.getOfflineSigner(networkConfig.chainId);
        const accounts = await offlineSigner.getAccounts();
        const key = await window.keplr.getKey(networkConfig.chainId);
        return { offlineSigner, accounts, key };
    }, [networkConfig]);

    const broadcastTx = useCallback(async (chainId: string, txRaw: TxRaw) => {
        await getKeplr();
        const result = await window.keplr.sendTx(
            chainId,
            CosmosTxV1Beta1Tx.TxRaw.encode(txRaw).finish(),
            BroadcastModeKeplr.Sync
        );

        if (!result || result.length === 0) {
            throw new TransactionException(
                new Error("Transaction failed to be broadcasted"),
                { contextModule: "Keplr" }
            );
        }

        return Buffer.from(result).toString("hex");
    }, [getKeplr]);

    const handleSendTx = useCallback(async (pubKey: any, msg: any, injectiveAddress: string, offlineSigner: { signDirect: (arg0: any, arg1: CosmosTxV1Beta1Tx.SignDoc) => any; }, gas: any = null) => {
        setTxLoading(true)
        const chainRestAuthApi = new ChainRestAuthApi(networkConfig.rest);
        const chainRestTendermintApi = new ChainRestTendermintApi(networkConfig.rest);

        const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
        const latestHeight = latestBlock.header.height;
        const timeoutHeight = new BigNumberInBase(latestHeight).plus(
            DEFAULT_BLOCK_TIMEOUT_HEIGHT
        );

        const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
            injectiveAddress
        );
        const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);

        const { signDoc } = createTransaction({
            pubKey: pubKey,
            chainId: networkConfig.chainId,
            fee: gas ?? getStdFee({}),
            message: msg,
            sequence: baseAccount.sequence,
            timeoutHeight: timeoutHeight.toNumber(),
            accountNumber: baseAccount.accountNumber,
        });

        const directSignResponse = await offlineSigner.signDirect(
            injectiveAddress,
            signDoc
        );

        const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse);
        const txHash = await broadcastTx(networkConfig.chainId, txRaw);
        const response = await new TxRestClient(networkConfig.rest).fetchTxPoll(txHash);

        console.log(response);
        setTxLoading(false)
        return response
    }, [broadcastTx, networkConfig])

    const burnAdmin = useCallback(async (subdenom) => {
        const { key, offlineSigner } = await getKeplr();
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const msgChangeAdmin = MsgChangeAdmin.fromJSON({
            denom: `factory/${injectiveAddress}/${subdenom}`,
            sender: injectiveAddress,
            newAdmin: 'inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49'
        });
        await handleSendTx(pubKey, msgChangeAdmin, injectiveAddress, offlineSigner)
        setLoaded(false)
    }, [getKeplr, handleSendTx])

    return (
        <>
            {showMetaDataModel !== null && <TokenMetadataModal setShowModal={setShowMetadataModal} token={showMetaDataModel} setLoaded={setLoaded} />}
            {showSpotMarketModal !== null && <CreateSpotMarketModal setShowModal={setShowSpotMarketModal} token={showSpotMarketModal} setLoaded={setLoaded} />}
            {showMint !== null && <MintModal setShowModal={setShowMint} token={showMint} setLoaded={setLoaded} />}
            {showMitoVault !== null && <CreateMitoVault setShowModal={setShowMitoVault} token={showMitoVault} setLoaded={setLoaded} />}

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
                <div className="pt-14 mx-2 pb-20">
                    {currentNetwork == "mainnet" && <div className=""><ShroomBalance /></div>}
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full px-2 ">
                            {connectedAddress ?
                                <div>
                                    <div className="text-center text-white mb-5">
                                        <div className="text-xl">
                                            Mange token factory tokens
                                        </div>
                                        <div className="text-xs">on Injective {currentNetwork}</div>
                                    </div>
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
        </>

    );
};

export default MyTokens;
