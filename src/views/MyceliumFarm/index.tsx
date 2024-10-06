import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { BeatLoader, CircleLoader, GridLoader, MoonLoader } from "react-spinners";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useCallback, useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenUtils from "../../modules/tokenUtils";
import { BaseAccount, BroadcastModeKeplr, ChainRestAuthApi, ChainRestTendermintApi, CosmosTxV1Beta1Tx, createTransaction, getTxRawFromTxRawOrDirectSignResponse, MsgChangeAdmin, MsgExecuteContractCompat, TxRaw, TxRestClient } from "@injectivelabs/sdk-ts";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { TransactionException } from "@injectivelabs/exceptions";
import myceliumLogo from "../../assets/mycelium.jpeg"
import farmBackground from "../../assets/farmBackground.webp"
import Footer from "../../components/App/Footer";

const ASTRO_GENERATOR = "inj164pyppndppdmazfjrvecajnwcs3hmq06agn4ka"
const SPORE_SHROOM_LP = "inj16qksf53k0n07cvpgzqs4q6kvpzh5aw2c6f9589"
const SHROOM_INJ_LP = "inj1yr2vl9vkwhw0g3tuhhm5jujpx2kzfmpp6lurrm"

const MyceliumFarm = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [loading, setLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false);

    const [pendingRewards, setPendingRewards] = useState(null)
    const [rewardInfo, setRewardInfo] = useState(null)

    const [selectedPool, setSelectedPool] = useState("SPORE")

    const getPendingRewards = useCallback(async () => {
        try {
            setLoading(true)
            const module = new TokenUtils(networkConfig)
            const info = await module.getGeneratorPoolInfo(ASTRO_GENERATOR, selectedPool == "SPORE" ? SPORE_SHROOM_LP : SHROOM_INJ_LP)
            console.log(info)
            const config = await module.getAstroRewardsInfo(ASTRO_GENERATOR, selectedPool == "SPORE" ? SPORE_SHROOM_LP : SHROOM_INJ_LP)
            console.log(config)
            setRewardInfo((Number(config[0].rps) / Math.pow(10, 6)).toFixed(4))
            const pendingRewards = await module.getPendingAstroRewards(ASTRO_GENERATOR, selectedPool == "SPORE" ? SPORE_SHROOM_LP : SHROOM_INJ_LP, connectedAddress)
            console.log(pendingRewards)
            if (pendingRewards) {
                setPendingRewards(Number(pendingRewards[0].amount) / Math.pow(10, 6))
            }
            else {
                setPendingRewards(0)
            }
            setLoading(false)
            return Number(pendingRewards[0].amount) / Math.pow(10, 6)
        }
        catch {
            setLoading(false)
            setPendingRewards(0)
        }
    }, [networkConfig, connectedAddress, selectedPool])

    useEffect(() => {
        if (connectedAddress) {
            getPendingRewards().then(r => {
                console.log(r)
            }).catch(e => {
                console.log(e)
            })
        }
    }, [connectedAddress, selectedPool])

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

    const claimRewards = useCallback(async () => {
        try {
            const { key, offlineSigner } = await getKeplr();
            const pubKey = Buffer.from(key.pubKey).toString("base64");
            const injectiveAddress = key.bech32Address;

            const msgClaim = MsgExecuteContractCompat.fromJSON({
                sender: injectiveAddress,
                contractAddress: ASTRO_GENERATOR,
                msg: {
                    claim_rewards: {
                        lp_tokens: selectedPool == "SPORE" ? [SPORE_SHROOM_LP] : [SHROOM_INJ_LP],
                    },
                },
            });
            await handleSendTx(pubKey, msgClaim, injectiveAddress, offlineSigner)
            await getPendingRewards()
        }
        catch {
            setTxLoading(false)
        }

    }, [getKeplr, getPendingRewards, handleSendTx, selectedPool])

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
                <div className="flex justify-center items-center min-h-full mt-2 md:mt-0">
                    <div className="px-2 text-black">
                        {connectedAddress ?
                            <div
                                style={{
                                    backgroundImage: `url(${farmBackground})`,
                                    backgroundSize: 'cover',  // Cover the entire div
                                    backgroundPosition: 'center',  // Center the background image
                                    backgroundRepeat: 'no-repeat'  // Do not repeat the image
                                }}
                                className="px-2 md:px-56 py-10 pb-40 rounded-xl"  // Example Tailwind classes for full screen
                            >
                                <div className="flex flex-row justify-between">
                                    <div
                                        onClick={() => setSelectedPool("SPORE")}
                                        className={`p-2 ${selectedPool == "SPORE" ? 'bg-slate-900' : 'bg-slate-600'} text-white rounded hover:cursor-pointer shadow-lg`}
                                    >
                                        SPORE / SHROOM
                                    </div>
                                    <div
                                        onClick={() => setSelectedPool("SHROOM")}
                                        className={`p-2 ${selectedPool == "SHROOM" ? 'bg-slate-900' : 'bg-slate-600'}  text-white rounded hover:cursor-pointer shadow-lg`}
                                    >
                                        SHROOM / INJ
                                    </div>
                                </div>
                                <div className="text-center text-slate-900 font-bold mb-5 mt-10">
                                    <div className="text-3xl">
                                        Farm mycelium
                                    </div>
                                    <div className="text-base">on Injective {currentNetwork}</div>
                                </div>

                                <div className="font-bold text-lg">
                                    stake LP on astroport to earn $mycelium
                                    <br />
                                    <a href={`https://app.astroport.fi/pools/${selectedPool == "SPORE" ? 'inj1rusfnzgtcvkn8z92h9hyvzuna60tc0x0yy74tf' : 'inj1ylcr85kkksgkqnpzmmrmg5tmfnqmq7trjpe4vs'}`} className="underline">astroport link</a>
                                </div>

                                <button
                                    className="mt-5 bg-gray-800 rounded-lg p-2 text-white border border-slate-800 shadow-lg font-bold"
                                    onClick={getPendingRewards}
                                >
                                    {loading ? <BeatLoader color="white" size={9} className="m-1" /> : <div>refresh rewards</div>}
                                </button>

                                <div className="font-bold text-lg ">
                                    {rewardInfo && <div className="mt-2 flex flex-row items-center">
                                        pool RPS: {rewardInfo}
                                        <img src={myceliumLogo} style={{ borderRadius: '50%', width: 30 }} className="animate-3dspin ml-2 mr-2" alt="Spinning Image" />
                                        / s
                                    </div>}
                                    {pendingRewards && <div
                                        className="mt-2 flex flex-row items-center "
                                    >
                                        <span className="text-2xl mr-1">{pendingRewards.toFixed(2)}</span>
                                        <img src={myceliumLogo} style={{ borderRadius: '50%', width: 30 }} className="animate-3dspin ml-2" alt="Spinning Image" />
                                    </div>}
                                </div>
                                <button
                                    className="mt-5 bg-gray-800 rounded-lg p-2  text-white border border-slate-800 shadow-lg font-bold"
                                    onClick={claimRewards}
                                >
                                    {txLoading ? <> <BeatLoader color="white" size={9} className="m-1" /></> : <>claim rewards 🍄</>}
                                </button>
                                {/* <div className="font-bold text-base mt-5">
                                    consider adding to mycelium / spore
                                    <br />
                                    <a href="https://app.astroport.fi/pools/inj1e35460gusk3f0lagmul6vzt9vjh6fp3zknl665" className="underline">astroport link</a>
                                </div> */}
                            </div> :
                            <div className="text-center text-white font-bold">
                                Please connect wallet to view your farm info
                            </div>
                        }

                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}

export default MyceliumFarm