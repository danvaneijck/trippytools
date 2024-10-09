import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    TxRaw,
    TxRestClient,
} from "@injectivelabs/sdk-ts";
import { TransactionException } from "@injectivelabs/exceptions";
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { Buffer } from "buffer";

export const getKeplrFromWindow = (preferNoSetFee = false) => {
    if (!window.keplr) {
        throw new Error('Keplr extension not installed')
    }
    if(preferNoSetFee){
        window.keplr.defaultOptions = {
            sign: {
                preferNoSetFee: true,
            }
        }
    }
    return window.keplr
}

export const getKeplrOfflineSigner = async (chainId, preferNoSetFee = false) => {
    const keplr = getKeplrFromWindow(preferNoSetFee)
    await keplr.enable(chainId);
    const offlineSigner = keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    const key = await keplr.getKey(chainId);
    return { offlineSigner, accounts, key };
}

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
}

export const handleSendTx = async (networkConfig, pubKey, msg, injectiveAddress, offlineSigner, gas = null) => {
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
    const txHash = await broadcastTxKeplr(networkConfig.chainId, txRaw);
    const response = await new TxRestClient(networkConfig.rest).fetchTxPoll(txHash);

    console.log(response);
    return response
}