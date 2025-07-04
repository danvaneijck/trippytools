import { BeatLoader } from "react-spinners";
import { useCallback, useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenUtils from "../../modules/tokenUtils";
import myceliumLogo from "../../assets/mycelium.jpeg"
import farmBackground from "../../assets/farmBackground.webp"
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";

const ASTRO_GENERATOR = "inj164pyppndppdmazfjrvecajnwcs3hmq06agn4ka"
const SPORE_SHROOM_LP = "inj16qksf53k0n07cvpgzqs4q6kvpzh5aw2c6f9589"
const SHROOM_INJ_LP = "inj1yr2vl9vkwhw0g3tuhhm5jujpx2kzfmpp6lurrm"

const MyceliumFarm = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

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
    }, [connectedAddress, selectedPool, getPendingRewards])


    const claimRewards = useCallback(async () => {
        try {

            const injectiveAddress = connectedAddress

            const msgClaim = MsgExecuteContractCompat.fromJSON({
                sender: injectiveAddress,
                contractAddress: ASTRO_GENERATOR,
                msg: {
                    claim_rewards: {
                        lp_tokens: selectedPool == "SPORE" ? [SPORE_SHROOM_LP] : [SHROOM_INJ_LP],
                    },
                },
            });
            await performTransaction(injectiveAddress, [msgClaim])
            await getPendingRewards()
        }
        catch {
            setTxLoading(false)
        }

    }, [getPendingRewards, selectedPool, connectedAddress])

    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">
            <div className="pt-24 mx-2 pb-20">
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