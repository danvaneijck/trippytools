import { useCallback, useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenUtils from "../../modules/tokenUtils";
import Footer from "../../components/App/Footer";
import Select from "react-select"
import { humanReadableAmount } from "../../utils/helpers";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"

const MitoMarketMake = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [vaultOptions, setVaultOptions] = useState([])

    const [selectedVault, setSelectedVault] = useState(null)

    const shroomCost = 2500
    const [shroomPrice, setShroomPrice] = useState(null)

    useEffect(() => {
        const getShroomCost = async () => {
            const module = new TokenUtils(networkConfig)
            try {
                const [baseAssetPrice, pairInfo] = await Promise.all([
                    module.getINJPrice(),
                    module.getPairInfo(SHROOM_PAIR_ADDRESS)
                ]);
                const quote = await module.getSellQuoteRouter(pairInfo, shroomCost + "0".repeat(18));
                console.log(quote)
                const returnAmount = Number(quote.amount) / Math.pow(10, 18);
                const totalUsdValue = (returnAmount * baseAssetPrice).toFixed(3);
                setShroomPrice(totalUsdValue);
                return totalUsdValue
            } catch (error) {
                console.error('Failed to update balance and USD value:', error);
            }
        }
        if (currentNetwork == "mainnet") {
            getShroomCost().then(r => {
                console.log(r)
            }).catch(e => {
                console.log(e)
            })
        }
    }, [currentNetwork, networkConfig, shroomCost])

    const getMitoVaults = useCallback(async () => {
        console.log("get mito vaults")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchMitoVaults();
            return markets
        } catch (error) {
            console.error('Failed to fetch mito vaults:', error);
            throw error;
        }
    }, [networkConfig]);

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

    const getMitoMarketList = useCallback(async () => {
        const spotMarkets = await getSpotMarkets();
        const mitoVaults = await getMitoVaults();

        const matchedMarkets = spotMarkets.map((market) => {
            const matchingVault = mitoVaults.slice().reverse().find(vault => vault.marketId === market.marketId);
            return {
                ...market,
                matchingVault: matchingVault || null, // Add the matching vault or null if no match is found
            };
        });

        const options = []
        matchedMarkets.map((market) => {
            if (market.matchingVault !== null) {
                options.push({
                    value: market,
                    label: `${market.baseToken ? market.baseToken.name : market.marketId} vault (${market.baseDenom ?? market.baseToken.address})`
                })
            }
        })
        setVaultOptions(options)
        setSelectedVault(options.find(x => x.value.matchingVault.contractAddress == "inj12hrath9g2c02e87vjadnlqnmurxtr8md7djyxm"))
    }, [getSpotMarkets, getMitoVaults])

    useEffect(() => {
        if (vaultOptions.length == 0) {
            getMitoMarketList()
        }
    }, [getMitoMarketList, vaultOptions])

    const sendMarketMake = useCallback(async () => {
        if (!selectedVault) {
            return
        }
        const address = selectedVault.value.matchingVault.contractAddress
        console.log(`send market make for vault ${address}`)

        const injectiveAddress = connectedAddress

        const feeMsg = MsgExecuteContract.fromJSON({
            contractAddress: SHROOM_TOKEN_ADDRESS,
            sender: injectiveAddress,
            msg: {
                transfer: {
                    recipient: FEE_COLLECTION_ADDRESS,
                    amount: (shroomCost).toFixed(0) + "0".repeat(18),
                },
            },
        });

        const msgMarketMake = MsgExecuteContractCompat.fromJSON({
            sender: injectiveAddress,
            contractAddress: address,
            msg: {
                market_make: {}
            },
        });
        console.log(feeMsg, msgMarketMake)

        const gas = {
            amount: [
                {
                    denom: "inj",
                    amount: '3500000'
                }
            ],
            gas: '3500000'
        };

        await performTransaction(
            injectiveAddress,
            [
                feeMsg,
                msgMarketMake
            ],


        )
    }, [connectedAddress, selectedVault])

    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">
            <div className="pt-14 md:pt-24 mx-2 pb-20">
                {currentNetwork == "mainnet" && <div className="mt-2 md:mt-0"><ShroomBalance /></div>}
                <div className="min-h-full mt-2 md:mt-0 ">
                    <div className="text-white text-center text-3xl font-magic">
                        Mito Market Make
                    </div>
                    <div className="w-full md:w-1/2 text-center text-sm m-auto mt-2">
                        This tool is used to send a "market_make: {"{}"}" call to the vault contract.
                        This forces the vault to update its orders around the mid price and results in tightening the spread. You can check the console for a preview of the messages.
                    </div>
                    {vaultOptions.length > 0 &&
                        <div className="mt-2 w-full md:w-1/2 m-auto">
                            <label>Select Vault</label>
                            <Select
                                className="text-black"
                                value={selectedVault}
                                options={vaultOptions}
                                onChange={setSelectedVault}
                            />
                        </div>
                    }
                    {shroomPrice &&

                        <div className="w-full md:w-1/2 m-auto mt-5">
                            Fee: {humanReadableAmount(shroomCost)} shroom (${shroomPrice ? shroomPrice : '0'}) <br />
                            <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                        </div>

                    }
                    {selectedVault !== null &&
                        <div
                            className="bg-slate-800 w-40 m-auto mt-5 p-2 text-center rounded shadow-lg hover:cursor-pointer"
                            onClick={sendMarketMake}
                        >
                            send market make
                        </div>
                    }
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default MitoMarketMake