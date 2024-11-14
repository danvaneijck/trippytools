import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    MsgSetDenomMetadata,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { MdImageNotSupported } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import IPFSImage from "../../components/App/IpfsImage";


const TokenMetadataModal = (props: {
    token: any
}) => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const navigate = useNavigate();

    const [tokenName, setTokenName] = useState("token-name");
    const [tokenSymbol, setTokenSymbol] = useState("token-symbol");
    const [tokenSupply, setTokenSupply] = useState(1000000);
    const [tokenDecimals, setTokenDecimals] = useState(6);
    const [tokenImage, setTokenImageUrl] = useState("https://");
    const [tokenDescription, setTokenDescription] = useState("new token description!");

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

    const updateMetadata = useCallback(async () => {
        console.log(props.token)
        setError(null)
        const { key, offlineSigner } = await getKeplr(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const msgSetDenomMetadata = MsgSetDenomMetadata.fromJSON({
            sender: injectiveAddress,
            metadata: {
                base: props.token.metadata.denom, /** the base denom */
                description: tokenDescription, /** description of your token */
                display: props.token.metadata.symbol, /** the displayed name of your token on UIs */
                name: props.token.metadata.name, /** the name of your token */
                symbol: props.token.metadata.symbol, /** the symbol of your token */
                uri: tokenImage,
                denomUnits: [
                    {
                        denom: props.token.metadata.denom,
                        exponent: 0,
                        aliases: [props.token.metadata.symbol]
                    },
                    {
                        denom: props.token.metadata.symbol,
                        exponent: props.token.metadata.decimals,
                        aliases: [props.token.metadata.symbol]
                    },
                ],
                uriHash: ""
            }
        });

        // set metadata
        console.log("metadata", msgSetDenomMetadata)
        setProgress("Upload denom metadata")
        await handleSendTx(pubKey, msgSetDenomMetadata, injectiveAddress, offlineSigner)

        setProgress("Done...")

        props.setLoaded(false)
        props.setShowModal(null)
    }, [props, getKeplr, networkConfig.chainId, tokenDescription, tokenImage, handleSendTx])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Update token metadata
                            </h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <div className="flex flex-col md:flex-row">
                                <div>
                                    <div>Connected address: {connectedAddress && connectedAddress}</div>

                                    <div>Token denom: {props.token && props.token.token}</div>
                                    <div className="mt-2 ">
                                        <label
                                            className="font-bold text-white "
                                        >
                                            Token description
                                        </label>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setTokenDescription(e.target.value)
                                            }
                                            value={tokenDescription}
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label
                                            className="block font-bold text-white"
                                        >
                                            Token image URL
                                        </label>
                                        <span className="text-xs">the logo of your token, should be hosted on IPFS and should be a small webp image</span>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1 text-sm"
                                            onChange={(e) =>
                                                setTokenImageUrl(e.target.value)
                                            }
                                            value={tokenImage}
                                        />
                                    </div>
                                </div>
                                <div className="ml-0 mt-5 md:ml-10 md:mt-0">
                                    token image
                                    {tokenImage ?
                                        <IPFSImage
                                            width={100}
                                            className={'rounded'}
                                            ipfsPath={tokenImage}

                                        />
                                        :
                                        <MdImageNotSupported className="text-5xl text-slate-500" />
                                    }
                                </div>
                            </div>
                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(null)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => updateMetadata().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default TokenMetadataModal