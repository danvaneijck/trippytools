import { Buffer } from "buffer";
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

export function humanReadableAmount(number: number) {
    if (!number) {
        return 0
    }
    const units = ["", "k", "m", "b", "t"];
    let unitIndex = 0;

    while (number >= 1000 && unitIndex < units.length - 1) {
        number /= 1000;
        unitIndex++;
    }

    return `${number.toFixed(2)}${units[unitIndex]}`;
}


export const getKeplr = async (chainId) => {
    await window.keplr.enable(chainId);
    const offlineSigner = window.keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    const key = await window.keplr.getKey(chainId);
    return { offlineSigner, accounts, key };
}

export const broadcastTx = async (chainId: string, txRaw: TxRaw) => {
    await getKeplr(chainId);

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

export const handleSendTx = async (networkConfig, pubKey, msg, injectiveAddress: string, offlineSigner, gas: any = null) => {
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
    return response
}