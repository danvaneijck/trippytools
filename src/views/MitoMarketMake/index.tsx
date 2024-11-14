import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useCallback, useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import TokenUtils from "../../modules/tokenUtils";
import { BaseAccount, BroadcastModeKeplr, ChainRestAuthApi, ChainRestTendermintApi, CosmosTxV1Beta1Tx, createTransaction, getTxRawFromTxRawOrDirectSignResponse, MsgChangeAdmin, MsgExecuteContract, MsgExecuteContractCompat, TxRaw, TxRestClient } from "@injectivelabs/sdk-ts";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { TransactionException } from "@injectivelabs/exceptions";
import Footer from "../../components/App/Footer";
import Select from "react-select"
import { humanReadableAmount } from "../../utils/helpers";

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"

const MitoMarketMake = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [vaultOptions, setVaultOptions] = useState([])

    const [selectedVault, setSelectedVault] = useState(null)

    const shroomCost = 5000
    const [shroomPrice, setShroomPrice] = useState(null)


    const [loading, setLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false);

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

    const sendMarketMake = useCallback(async () => {
        if (!selectedVault) {
            return
        }
        const address = selectedVault.value.matchingVault.contractAddress
        console.log(`send market make for vault ${address}`)

        const { key, offlineSigner } = await getKeplr();
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

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

        await handleSendTx(
            pubKey,
            [
                feeMsg,
                msgMarketMake
            ],
            injectiveAddress,
            offlineSigner,
            gas
        )
    }, [getKeplr, handleSendTx, selectedVault])

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