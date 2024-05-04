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
    MsgCreateDenom,
    MsgMint,
    MsgMultiSend,
    MsgSetDenomMetadata,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumber, BigNumberInBase, BigNumberInWei, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { MdImageNotSupported } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";


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

    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const navigate = useNavigate();

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

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

    const sendAirdrops = useCallback(async (denom: any, decimals: number | undefined, airdropDetails: any[]) => {

        const { key, offlineSigner } = await getKeplr();
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const records = airdropDetails.filter(record => (Number(record.amountToAirdrop) !== 0)).map((record: { address: any; amountToAirdrop: any; }) => {
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
        await handleSendTx(pubKey, msg, injectiveAddress, offlineSigner, gas)

    }, [getKeplr, handleSendTx])


    const createAndMint = useCallback(async () => {
        setError(null)
        const { key, offlineSigner } = await getKeplr(networkConfig.chainId);
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
                ],
                uriHash: ""
            }
        });

        console.log(msgSetDenomMetadata)

        // create denom
        console.log("create denom")
        setProgress("Create new denom")
        await handleSendTx(pubKey, msgCreateDenom, injectiveAddress, offlineSigner)
        // mint supply
        console.log("mint")
        setProgress("Mint supply")
        await handleSendTx(pubKey, msgMint, injectiveAddress, offlineSigner)
        // set metadata
        console.log("metadata")
        setProgress("Upload denom metadata")
        await handleSendTx(pubKey, msgSetDenomMetadata, injectiveAddress, offlineSigner)

        if (props.airdropDetails !== null && props.airdropDetails.length > 0) {
            console.log("airdrop")
            setProgress("Send airdrops")
            await sendAirdrops(denom, props.tokenDecimals, props.airdropDetails)
        }

        setProgress("Done...")
        navigate('/manage-tokens');

    }, [getKeplr, handleSendTx, navigate, networkConfig.chainId, props.airdropDetails, props.tokenDecimals, props.tokenDescription, props.tokenImage, props.tokenName, props.tokenSupply, props.tokenSymbol, sendAirdrops])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Launch on {currentNetwork}
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
                                    <div>Admin address: {connectedAddress}</div>
                                    <div>Token denom: {`factory/${connectedAddress}/${props.tokenSymbol}`}</div>
                                    <div>Tokens to your wallet: {(props.tokenSupply - (props.tokenSupply * (props.airdropPercent / 100))).toFixed(props.tokenDecimals)}</div>
                                </div>
                                <div className="ml-10">
                                    token image
                                    {props.tokenImage ?
                                        <img className="rounded" src={props.tokenImage} width={100} />
                                        :
                                        <MdImageNotSupported className="text-5xl text-slate-500" />
                                    }
                                </div>
                            </div>
                            <div>
                                {props.airdropDetails !== null && props.airdropDetails.length > 0 &&
                                    <div className="mt-5">
                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                            <div>Total participants: {props.airdropDetails.filter(x => x.includeInDrop).length}</div>
                                            <div className="text-xs">You should exclude addresses such as burn addresses, the pair contract etc..</div>
                                            <div className="mt-2">
                                                <table className="table-auto w-full">
                                                    <thead className="text-white">
                                                        <tr>

                                                            <th className="px-4 py-2">
                                                                Address
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Airdrop
                                                            </th>
                                                            <th className="px-4 py-2">
                                                                Percentage
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {props.airdropDetails.map((holder, index) => (
                                                            <tr key={index} className="text-white border-b text-xs">

                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                    <a
                                                                        className="hover:text-indigo-900"
                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                    >
                                                                        {holder.address}
                                                                    </a>
                                                                </td>
                                                                <td className="px-6 py-1">
                                                                    {Number(holder.amountToAirdrop).toFixed(4)}{" "}
                                                                </td>
                                                                <td className="px-6 py-1">
                                                                    {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                }
                            </div>
                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
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
                                onClick={() => createAndMint().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
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