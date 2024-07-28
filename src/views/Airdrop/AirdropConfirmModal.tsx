import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    MsgExecuteContract,
    MsgExecuteContractCompat,
    MsgMultiSend,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumber, BigNumberInBase, BigNumberInWei, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import { WALLET_LABELS } from "../../constants/walletLabels";
import { sendTelegramMessage } from "../../modules/telegram";
import { gql, useMutation } from '@apollo/client';
import moment from "moment";

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const FEE_COLLECTION_ADDRESS = "inj1e852m8j47gr3qwa33zr7ygptwnz4tyf7ez4f3d"

const INSERT_AIRDROP_MUTATION = gql`
mutation insertAirdropLog (
    $time: timestamptz!, 
    $token_dropped_id: String!, 
    $wallet_id: String!, 
    $amount_dropped: float8, 
    $participants: [airdrop_tracker_airdroplog_participants_insert_input!]!, 
    $criteria: String, 
    $description: String, 
    $total_participants: Int!
    ) {
  insert_airdrop_tracker_airdroplog_one(object: {
    time: $time, 
    token_dropped_id: $token_dropped_id, 
    wallet_id: $wallet_id, 
    amount_dropped: $amount_dropped, 
    criteria: $criteria, 
    description: $description, 
    total_participants: $total_participants, 
    participants: {data: $participants}
    }) {
    id
  }
}

`

const INSERT_WALLETS_MUTATION = gql`
mutation insertWallet($objects: [wallet_tracker_wallet_insert_input!]!) {
  insert_wallet_tracker_wallet(objects: $objects, on_conflict: {constraint:wallet_tracker_wallet_pkey, update_columns: []}){
    returning{
      address
    }
  }
}
`

const AirdropConfirmModal = (props: {
    airdropDetails: unknown;
    tokenAddress: string;
    tokenDecimals: number;
    shroomCost: number
    setShowModal: (arg0: boolean) => void;
    criteria: string;
    description: string;
}) => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const navigate = useNavigate();

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState(null)

    const [feePayed, setFeePayed] = useState(false)

    const [insertAirdropLog] = useMutation(INSERT_AIRDROP_MUTATION)
    const [insertWallets] = useMutation(INSERT_WALLETS_MUTATION)

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

        const records = airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).map((record: { address: any; amountToAirdrop: any; }) => {
            return {
                address: record.address,
                amount: Number(record.amountToAirdrop).toFixed(props.tokenDecimals)
            }
        });

        const chunkSize = denom.includes("factory") ? 2000 : 500;
        const gasPerRecord = denom.includes("factory") ? 20000 : 80000;
        const chunks = [];
        for (let i = 0; i < records.length; i += chunkSize) {
            chunks.push(records.slice(i, i + chunkSize));
        }

        const successfullyProcessed = new Set();

        for (const chunk of chunks) {
            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    const filteredChunk = chunk.filter(record => !successfullyProcessed.has(record.address));

                    if (filteredChunk.length === 0) {
                        break;
                    }

                    let msg;
                    if (!denom.includes("factory")) {
                        msg = filteredChunk.map((record) => {
                            return MsgExecuteContractCompat.fromJSON({
                                contractAddress: denom,
                                sender: injectiveAddress,
                                msg: {
                                    transfer: {
                                        recipient: record.address,
                                        amount: new BigNumberInBase(record.amount)
                                            .toWei(decimals)
                                            .toFixed()
                                    },
                                },
                            });
                        });
                    } else {
                        const totalChunkToSend = filteredChunk.reduce((acc, record) => {
                            return acc.plus(new BigNumberInBase(record.amount).toWei(decimals));
                        }, new BigNumberInWei(0));

                        msg = MsgMultiSend.fromJSON({
                            inputs: [
                                {
                                    address: injectiveAddress,
                                    coins: [
                                        {
                                            denom,
                                            amount: totalChunkToSend.toFixed(),
                                        },
                                    ],
                                },
                            ],
                            outputs: filteredChunk.map((record: { address: any; amount: BigNumber.Value; }) => {
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
                    }

                    let calculatedGas = filteredChunk.length * gasPerRecord;
                    if (calculatedGas < 5000000) {
                        calculatedGas = 5000000;
                    }

                    const gas = {
                        amount: [
                            {
                                denom: "inj",
                                amount: calculatedGas.toString()
                            }
                        ],
                        gas: calculatedGas.toString()
                    };

                    await handleSendTx(pubKey, msg, injectiveAddress, offlineSigner, gas);
                    filteredChunk.forEach(record => successfullyProcessed.add(record.address));
                    success = true;
                } catch (error) {
                    console.error("Transaction failed, retrying...", error);
                    retries -= 1;
                }
            }

            if (!success) {
                console.error("Failed to send airdrop after multiple retries");
                throw new Error("Failed to send airdrop after multiple retries");
            }
        }
    }, [getKeplr, handleSendTx, props.tokenDecimals]);


    const payFee = useCallback(async () => {
        const { key, offlineSigner } = await getKeplr();
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: SHROOM_TOKEN_ADDRESS,
            sender: injectiveAddress,
            msg: {
                transfer: {
                    recipient: FEE_COLLECTION_ADDRESS,
                    amount: (props.shroomCost).toFixed(0) + "0".repeat(18),
                },
            },
        });
        console.log("send shroom fee", msg)
        return await handleSendTx(pubKey, msg, injectiveAddress, offlineSigner)
    }, [getKeplr, handleSendTx, props.shroomCost])

    const startAirdrop = useCallback(async () => {
        setError(null)
        if (props.airdropDetails !== null && props.airdropDetails.length > 0) {
            if (currentNetwork == "mainnet" && props.shroomCost !== 0 && !feePayed) {
                console.log("pay shroom fee")
                setProgress("Pay shroom fee for airdrop")
                const result = await payFee()
                if (result) setFeePayed(true)
            }
            console.log("airdrop")
            setProgress("Send airdrops")
            await sendAirdrops(props.tokenAddress, props.tokenDecimals, props.airdropDetails)
            setProgress("Done...")

            if (currentNetwork == "mainnet") await sendTelegramMessage(
                `wallet ${connectedAddress} performed an airdrop on trippyinj!\ntoken dropped: ${props.tokenAddress}\n` +
                `num participants: ${props.airdropDetails ? props.airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).length : "n/a"}`)

            try {
                await insertWallets({
                    variables: {
                        objects: props.airdropDetails.map(wallet => ({
                            address: wallet.address,
                            burn_address: false
                        }))
                    }
                })

                insertAirdropLog({
                    variables: {
                        "time": moment(),
                        "token_dropped_id": props.tokenAddress,
                        "wallet_id": connectedAddress,
                        "amount_dropped": props.airdropDetails.reduce((sum, airdrop) => sum + Number(airdrop.amountToAirdrop), 0),
                        "total_participants": props.airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).length,
                        "participants": props.airdropDetails.filter(record => (Number(Number(record.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0)).map((wallet) => {
                            return {
                                "wallet_id": wallet.address
                            }
                        }),
                        "criteria": props.criteria,
                        "description": props.description
                    }
                }).then(r => {
                    console.log(r)
                }).catch(e => {
                    console.log("failed to insert airdrop log", e)
                })
            }
            catch (e) {
                console.log(e)
            }

            navigate('/token-holders?address=' + props.tokenAddress);
        }
    }, [props.airdropDetails, props.shroomCost, props.tokenAddress, props.tokenDecimals, feePayed, currentNetwork, sendAirdrops, connectedAddress, navigate, payFee, insertAirdropLog, props.criteria, props.description, insertWallets])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Airdrop on {currentNetwork}
                            </h3>

                        </div>

                        <div className="relative p-6 flex-auto">
                            <div>
                                <p>
                                    Airdropping token <br />{props.tokenAddress}
                                </p>
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
                                                        {props.airdropDetails.filter(x => Number(Number(x.amountToAirdrop).toFixed(props.tokenDecimals)) !== 0).map((holder, index) => (
                                                            <tr key={index} className="text-white border-b text-xs">
                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                    <a
                                                                        className="hover:text-indigo-900"
                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                    >
                                                                        {holder.address}
                                                                        {
                                                                            WALLET_LABELS[holder.address] ? (
                                                                                <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                    {WALLET_LABELS[holder.address].label}
                                                                                </span>
                                                                            ) : null
                                                                        }
                                                                    </a>
                                                                </td>
                                                                <td className="px-6 py-1">
                                                                    {Number(holder.amountToAirdrop).toFixed(props.tokenDecimals)}{" "}
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
                        <div className="pl-6">If the airdrop TX fails, up the gas ! DO NOT REFRESH THE PAGE</div>
                        {currentNetwork == "mainnet" && (props.airdropDetails.length > 0) && <div className="m-5">
                            Fee for airdrop: {props.shroomCost} shroom <br />
                            <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                            <br />
                            <div className="mt-2">Fee payed: {feePayed ? "True" : "False"}</div>
                        </div>
                        }
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
                                onClick={() => startAirdrop().then(() => console.log("done")).catch(e => {
                                    console.log(e)
                                    setError(e.message)
                                    setProgress("")
                                    setTxLoading(false)
                                })}
                            >
                                Do Airdrop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>

    )
}

export default AirdropConfirmModal