/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    MsgChangeAdmin,
    MsgCreateDenom,
    MsgMint,
    MsgMultiSend,
    MsgSetDenomMetadata,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { ChainId } from '@injectivelabs/ts-types'
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumber, BigNumberInBase, BigNumberInWei, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback } from "react";

const REST_API = "https://testnet.sentry.lcd.injective.network"
// const REST_API = "https://sentry.lcd.injective.network";

const ConfirmModal = (props: {
    airdropDetails: unknown;
    tokenDescription: string;
    tokenImage: string;
    airdropPercent: number;
    tokenDecimals: number;
    tokenSupply: number;
    tokenSymbol: string;
    tokenName: string;
    setShowModal: (arg0: boolean) => void;
}) => {

    const getKeplr = async (chainId: string) => {
        await window.keplr.enable(chainId);

        const offlineSigner = window.keplr.getOfflineSigner(chainId);
        const accounts = await offlineSigner.getAccounts();
        const key = await window.keplr.getKey(chainId);

        return { offlineSigner, accounts, key };
    };

    const broadcastTx = useCallback(async (chainId: string, txRaw: TxRaw) => {
        await getKeplr(ChainId.Testnet);
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
    }, []);

    const handleSendTx = useCallback(async (chainId: any, pubKey: any, msg: any, injectiveAddress: string, offlineSigner: { signDirect: (arg0: any, arg1: CosmosTxV1Beta1Tx.SignDoc) => any; }, gas: any = null) => {
        const chainRestAuthApi = new ChainRestAuthApi(REST_API);
        const chainRestTendermintApi = new ChainRestTendermintApi(REST_API);

        const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
        const latestHeight = latestBlock.header.height;
        const timeoutHeight = new BigNumberInBase(latestHeight).plus(
            DEFAULT_BLOCK_TIMEOUT_HEIGHT
        );

        const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
            injectiveAddress
        );
        const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);

        console.log(getStdFee({}))
        console.log(gas ?? getStdFee({}))

        const { signDoc } = createTransaction({
            pubKey: pubKey,
            chainId,
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
        const txHash = await broadcastTx(ChainId.Testnet, txRaw);
        const response = await new TxRestClient(REST_API).fetchTxPoll(txHash);

        console.log(response);
        return response
    }, [broadcastTx])

    const sendAirdrops = useCallback(async (denom: any, decimals: number | undefined, airdropDetails: any[]) => {
        const chainId = "injective-888"; /* ChainId.Mainnet  injective-1*/

        const { key, offlineSigner } = await getKeplr(chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const records = airdropDetails.map((record: { address: any; amountToAirdrop: any; }) => {
            return {
                address: record.address,
                amount: record.amountToAirdrop
            }
        })

        const totalToSend = records.reduce((acc, record) => {
            return acc.plus(new BigNumberInBase(record.amount).toWei(decimals));
        }, new BigNumberInWei(0));

        console.log(totalToSend)

        const msg = MsgMultiSend.fromJSON({
            inputs: [
                {
                    address: injectiveAddress,
                    coins: [
                        {
                            denom,
                            amount: totalToSend.toFixed(),
                        },
                    ],
                },
            ],
            outputs: records.map((record: { address: any; amount: BigNumber.Value; }) => {
                return {
                    address: record.address,
                    coins: [
                        {
                            amount: new BigNumberInBase(record.amount)
                                .toWei(decimals)
                                .toFixed(),
                            denom,
                        },
                    ],
                };
            }),
        });
        console.log("send airdrops", msg)
        const gas = {
            "amount": [
                {
                    "denom": "inj",
                    "amount": "64000000000000"
                }
            ],
            "gas": "4000000"
        }
        // return
        await handleSendTx(chainId, pubKey, msg, injectiveAddress, offlineSigner, gas)

    }, [handleSendTx])



    const createAndMint = useCallback(async () => {
        const chainId = "injective-888"; /* ChainId.Mainnet  injective-1*/

        const { key, offlineSigner } = await getKeplr(chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const subdenom = props.tokenSymbol
        const denom = `factory/${injectiveAddress}/${subdenom}`;
        const amount = props.tokenSupply

        const msgCreateDenom = MsgCreateDenom.fromJSON({
            subdenom,
            sender: injectiveAddress,
        });

        const msgMint = MsgMint.fromJSON({
            sender: injectiveAddress,
            amount: {
                denom: `factory/${injectiveAddress}/${subdenom}`,
                amount: new BigNumberInBase(amount)
                    .toWei(props.tokenDecimals)
                    .toFixed()
            }
        });

        console.log(msgMint)

        const msgChangeAdmin = MsgChangeAdmin.fromJSON({
            denom: `factory/${injectiveAddress}/${subdenom}`,
            sender: injectiveAddress,
            newAdmin: 'inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49' /** SET TO ZERO ADDRESS */
        });

        const msgSetDenomMetadata = MsgSetDenomMetadata.fromJSON({
            sender: injectiveAddress,
            metadata: {
                base: denom, /** the base denom */
                description: props.tokenDescription, /** description of your token */
                display: props.tokenSymbol, /** the displayed name of your token on UIs */
                name: props.tokenName, /** the name of your token */
                symbol: props.tokenSymbol, /** the symbol of your token */
                uri: props.tokenImage /** the logo of your token, should be hosted on IPFS and should be a small webp image */,
                denomUnits: [
                    {
                        denom: denom,
                        exponent: 0,
                        aliases: [subdenom]
                    },
                    {
                        denom: subdenom,
                        exponent: props.tokenDecimals,
                        aliases: [subdenom]
                    },
                    // {
                    //     denom: `factory/${injectiveAddress}/u${subdenom}`, /** notice the u */
                    //     exponent: props.tokenDecimals,
                    //     aliases: [`micro${subdenom}`]
                    // },
                ],
                uriHash: ""
            }
        });

        console.log(msgSetDenomMetadata)

        // // create denom
        // console.log("create denom")
        // await handleSendTx(chainId, pubKey, msgCreateDenom, injectiveAddress, offlineSigner)
        // // mint supply
        // console.log("mint")
        // await handleSendTx(chainId, pubKey, msgMint, injectiveAddress, offlineSigner)
        // // set metadata
        // console.log("metadata")
        // await handleSendTx(chainId, pubKey, msgSetDenomMetadata, injectiveAddress, offlineSigner)
        console.log(props.airdropDetails)
        await sendAirdrops(denom, props.tokenDecimals, props.airdropDetails)

        // burn admin rights
        // await handleSendTx(chainId, pubKey, msgChangeAdmin, injectiveAddress, offlineSigner)
    }, [handleSendTx, props.airdropDetails, props.tokenDecimals, props.tokenDescription, props.tokenImage, props.tokenName, props.tokenSupply, props.tokenSymbol, sendAirdrops])


    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-black"
            >
                <div className="relative w-auto my-4 mx-auto max-w-3xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-200 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Launch and airdrop token
                            </h3>

                        </div>
                        <div className="relative p-6 flex-auto">
                            <div className="flex flex-row">
                                <div>
                                    <div>Name: {props.tokenName}</div>
                                    <div>Symbol: {props.tokenSymbol}</div>
                                    <div>Supply: {props.tokenSupply}</div>
                                    <div>Decimals: {props.tokenDecimals}</div>
                                    <div>Tokens to airdrop: {props.tokenSupply * (props.airdropPercent / 100)}</div>
                                    <div>Tokens to your wallet: {props.tokenSupply - (props.tokenSupply * (props.airdropPercent / 100))}</div>
                                </div>
                                <div className="ml-10">
                                    token image:
                                    <img className="rounded" src={props.tokenImage} width={100} />
                                </div>
                            </div>

                        </div>
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
                                onClick={() => createAndMint().then(() => console.log("done")).catch(e => console.log(e))}
                            >
                                Launch
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>

    )
}

export default ConfirmModal