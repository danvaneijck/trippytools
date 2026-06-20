 
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
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import { MsgChangeAdmin } from "@injectivelabs/sdk-ts";
import { shortAddress } from "../../utils/format";
import { buildCreateTokenPairMsg, evmAddressUrl, PAIR_ERC20_GAS } from "../../utils/evm";

// tokenfactory "burn" admin — assigning admin here renounces mint authority.
const BURN_ADMIN_ADDRESS = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

interface TokenMetadata {
    name?: string;
    symbol?: string;
    description?: string;
    logo?: string;
    total_supply?: number;
    decimals: number;
    admin?: string;
}

interface FactoryToken {
    token: string;
    metadata: TokenMetadata;
    marketId?: string | null;
    mitoVaultContractAddress?: string | null;
    mitoVault?: any;
    // ERC-20 address this denom is paired with on Injective EVM, or null.
    erc20?: string | null;
}

const MyTokens = () => {

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork } = useNetworkStore()
    const networkConfig = useNetworkStore((state) => state.network);

    const netPrefix = currentNetwork === 'testnet' ? 'testnet.' : '';
    const explorerBase = `https://${netPrefix}explorer.injective.network`;

    const [tokens, setTokens] = useState<FactoryToken[]>([]);

    const [showMetaDataModel, setShowMetadataModal] = useState<FactoryToken | null>(null);
    const [showSpotMarketModal, setShowSpotMarketModal] = useState<FactoryToken | null>(null);
    const [showMint, setShowMint] = useState<FactoryToken | null>(null);
    const [showMitoVault, setShowMitoVault] = useState<FactoryToken | null>(null);

    const [injPrice, setInjPrice] = useState<string | number | null | undefined>(null)
    const [injBalance, setINJBalance] = useState<number | null>(null)

    const [loading, setLoading] = useState(false);

    const [loaded, setLoaded] = useState(false);

    // Denom currently being paired to an ERC-20 (disables its row button).
    const [pairingDenom, setPairingDenom] = useState<string | null>(null);

    useEffect(() => {
        setLoaded(false)
    }, [currentNetwork])

    const getTokens = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        try {
            const userTokens = await module.getUserTokens(connectedAddress as string);
            return userTokens;
        } catch (error) {
            console.error('Failed to fetch tokens:', error);
            throw error;
        }
    }, [networkConfig, connectedAddress]);

    const getSpotMarkets = useCallback(async () => {
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
        const module = new TokenUtils(networkConfig);
        try {
            const price = await module.getINJDerivativesPrice();
            const balance = await module.getBalanceOfToken('inj', connectedAddress as string)
            setINJBalance(Number(balance.amount) / Math.pow(10, 18))
            setInjPrice(price)
            return price;
        } catch (error) {
            console.error('Failed to fetch INJ price:', error);
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

                    // Resolve each denom's paired ERC-20 (if any) on the EVM.
                    const pairModule = new TokenUtils(networkConfig);
                    const withErc20 = await Promise.all(
                        extendedTokens.map(async (t) => ({
                            ...t,
                            erc20: await pairModule.getErc20Pair(t.token),
                        }))
                    );

                    setTokens(withErc20 as FactoryToken[]);

                    await getINJPrice()

                    setLoaded(true);
                } catch (e) {
                    console.error("Failed to fetch spot markets:", e);
                }
            } catch (e) {
                if ((e as any).name !== 'AbortError') {
                    console.error("Failed to fetch tokens:", e);
                }
            } finally {
                setLoading(false);
            }
        };

        void fetchData();
    }, [getTokens, loaded, loading, connectedAddress, getSpotMarkets, getMitoVaults, getINJPrice]);



    const burnAdmin = useCallback(async (token: FactoryToken) => {
        const injectiveAddress = connectedAddress;

        const msgChangeAdmin = MsgChangeAdmin.fromJSON({
            denom: token.token,
            sender: injectiveAddress as string,
            newAdmin: BURN_ADMIN_ADDRESS
        });
        await performTransaction(injectiveAddress as string, [msgChangeAdmin])
        setLoaded(false)
    }, [connectedAddress])

    // Pair an existing tokenfactory denom with an auto-deployed ERC-20 on the
    // Injective EVM. Needs the explicit gas limit (inner EVM contract deploy).
    const pairErc20 = useCallback(async (token: FactoryToken) => {
        if (!connectedAddress) return
        setPairingDenom(token.token)
        try {
            const msg = buildCreateTokenPairMsg(connectedAddress, token.token)
            await performTransaction(connectedAddress, [msg], { gas: PAIR_ERC20_GAS })
            setLoaded(false)
        } catch (e) {
            console.error("Failed to pair ERC-20:", e)
        } finally {
            setPairingDenom(null)
        }
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
                                    Manage token factory tokens
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
                                        <div>INJ  balance: {injBalance.toFixed(2)} (${(injBalance * Number(injPrice)).toFixed(2)})</div>
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
                                            <div className="flex flex-col overflow-x-auto">
                                                {tokens && tokens.length > 0 ? (
                                                    <table className="table-auto w-full">
                                                        <thead>
                                                            <tr className="bg-slate-800 text-white text-left">
                                                                <th className="px-4 py-2">Logo</th>
                                                                <th className="px-4 py-2">Name</th>
                                                                <th className="px-4 py-2">Symbol</th>
                                                                <th className="px-4 py-2">Description</th>
                                                                <th className="px-4 py-2">Denom</th>
                                                                <th className="px-4 py-2">ERC-20</th>
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
                                                                            href={`${explorerBase}/asset/?denom=${token.token}&tokenType=tokenFactory`}>
                                                                            {shortAddress(token.token)}
                                                                        </a>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">
                                                                        {token.erc20 ? (
                                                                            <a
                                                                                target="_blank"
                                                                                className="underline text-emerald-400"
                                                                                href={evmAddressUrl(currentNetwork, token.erc20)}
                                                                            >
                                                                                {shortAddress(token.erc20)}
                                                                            </a>
                                                                        ) : token.metadata.admin == connectedAddress ? (
                                                                            <button
                                                                                disabled={pairingDenom === token.token}
                                                                                onClick={() => { void pairErc20(token) }}
                                                                                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 shadow-lg px-2 py-1 rounded-lg text-xs"
                                                                            >
                                                                                {pairingDenom === token.token ? "pairing…" : "Pair ERC-20"}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-slate-500">none</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">{(token.metadata.total_supply! / Math.pow(10, token.metadata.decimals)).toLocaleString()}</td>
                                                                    <td className="px-4 py-2 text-xs">{token.metadata.decimals}</td>
                                                                    <td className="px-4 py-2 text-xs">
                                                                        {token.metadata.admin == connectedAddress ?
                                                                            <div className="bg-blue-600 rounded-lg text-center px-2  w-auto inline-block">You</div> :
                                                                            <div>
                                                                                {token.metadata.admin == BURN_ADMIN_ADDRESS ?
                                                                                    <div className="bg-red-600 rounded-lg text-center px-2  w-auto inline-block">burned</div> :
                                                                                    <div>{shortAddress(token.metadata.admin)}</div>}
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
                                                                            to={`https://${netPrefix}helixapp.com/spot/?marketId=${token.marketId}`}
                                                                        >
                                                                            {token.marketId ? token.marketId.slice(0, 5) + "..." : "none"}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs underline">
                                                                        <Link
                                                                            target="_blank"
                                                                            to={`https://${netPrefix}mito.fi/vault/${token.mitoVaultContractAddress}`}
                                                                        >
                                                                            {token.mitoVaultContractAddress ? token.mitoVaultContractAddress.slice(0, 5) + "..." : "none"}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-xs">
                                                                        {token.metadata.admin == connectedAddress &&
                                                                            <> <button onClick={() => { setShowMint(token) }} className="my-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
                                                                                Mint
                                                                            </button>
                                                                                <button onClick={() => { void burnAdmin(token) }} className="my-2 ml-2 bg-slate-800 shadow-lg p-2 rounded-lg text-xs">
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
