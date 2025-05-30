import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    TxGrpcApi,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import {
    BigNumberInBase,
    DEFAULT_BLOCK_TIMEOUT_HEIGHT,
    getStdFee,
} from "@injectivelabs/utils";
import { Buffer } from "buffer";

export const getKeplrFromWindow = (preferNoSetFee = false) => {
    if (!window.keplr) {
        throw new Error("Keplr extension not installed");
    }
    if (preferNoSetFee) {
        window.keplr.defaultOptions = {
            sign: {
                preferNoSetFee: true,
            },
        };
    }
    return window.keplr;
};

export const getKeplrOfflineSigner = async (
    chainId,
    preferNoSetFee = false
) => {
    const keplr = getKeplrFromWindow(preferNoSetFee);
    await keplr.enable(chainId);
    const offlineSigner = keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    const key = await keplr.getKey(chainId);
    return { offlineSigner, accounts, key };
};

export const broadcastTxKeplr = async (chainId: string, txRaw: TxRaw) => {
    await window.keplr.enable(chainId);

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
};

export const handleSendTx = async (
    networkConfig,
    pubKey,
    msgs,
    injectiveAddress,
    offlineSigner,
    gas = null
) => {
    const chainRestAuthApi = new ChainRestAuthApi(networkConfig.rest);
    const chainRestTendermintApi = new ChainRestTendermintApi(
        networkConfig.rest
    );

    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(
        DEFAULT_BLOCK_TIMEOUT_HEIGHT
    );

    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
        injectiveAddress
    );
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);

    if (!gas) {
        gas = {
            amount: [
                {
                    denom: "inj",
                    amount: "2000000",
                },
            ],
            gas: "2000000",
        };
    }

    const { txRaw } = createTransaction({
        pubKey: pubKey,
        chainId: networkConfig.chainId,
        fee: gas,
        message: msgs,
        sequence: baseAccount.sequence,
        timeoutHeight: timeoutHeight.toNumber(),
        accountNumber: baseAccount.accountNumber,
    });

    const api = new TxGrpcApi(networkConfig.grpc);
    console.log("simulate");
    const simulate = await api.simulate(txRaw);

    const gasEstimate = Math.ceil(simulate.gasInfo.gasUsed * 1.2);
    const gasPrice = 1000000000;
    const fee = gasEstimate * gasPrice;

    const updatedGas = {
        amount: [
            {
                denom: "inj",
                amount: fee.toString(),
            },
        ],
        gas: gasEstimate.toString(),
    };

    console.log("gas estimate", updatedGas);

    const { signDoc } = createTransaction({
        pubKey: pubKey,
        chainId: networkConfig.chainId,
        fee: updatedGas,
        message: msgs,
        sequence: baseAccount.sequence,
        timeoutHeight: timeoutHeight.toNumber(),
        accountNumber: baseAccount.accountNumber,
        memo: "trippinj",
    });

    const directSignResponse = await offlineSigner.signDirect(
        injectiveAddress,
        signDoc
    );

    const txRawUpdated =
        getTxRawFromTxRawOrDirectSignResponse(directSignResponse);
    const txHash = await broadcastTxKeplr(networkConfig.chainId, txRawUpdated);
    const response = await new TxRestClient(networkConfig.rest).fetchTxPoll(
        txHash
    );

    console.log(response);
    return response;
};
