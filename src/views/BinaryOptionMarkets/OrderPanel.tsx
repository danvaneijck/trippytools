// src/OrderPanel.js
import { useCallback, useEffect, useState } from 'react';
import {
    BaseAccount,
    BroadcastModeKeplr,
    ChainRestAuthApi,
    ChainRestTendermintApi,
    CosmosTxV1Beta1Tx,
    createTransaction,
    getTxRawFromTxRawOrDirectSignResponse,
    MsgInstantBinaryOptionsMarketLaunch,
    MsgCreateBinaryOptionsLimitOrder,
    MsgCreateBinaryOptionsMarketOrder,
    TxRaw,
    IndexerGrpcAccountApi
} from "@injectivelabs/sdk-ts";
import { BigNumber, BigNumberInBase, BigNumberInWei, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from "@injectivelabs/utils";
import { TransactionException } from "@injectivelabs/exceptions";
import { InjectiveExchangeV1Beta1Tx, InjectiveExchangeV1Beta1Exchange } from '@injectivelabs/core-proto-ts';
import { Buffer } from "buffer";
import TokenUtils from '../../modules/tokenUtils';
import useWalletStore from '../../store/useWalletStore';
import useNetworkStore from '../../store/useNetworkStore';

const OrderPanel = (props: {
    marketId: string,
    market: any,
    setLoaded?: any
}) => {
    const [quantity, setQuantity] = useState(1);
    const [price, setPrice] = useState(0.5);
    const [orderType, setOrderType] = useState('market');

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)
    const [error, setError] = useState(null)

    const [quoteBalance, setQuoteBalance] = useState(null)

    const getQuoteBalance = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        const balance = await module.getBalanceOfToken(props.market.quoteDenom, connectedAddress)
        console.log("balance", balance)
        setQuoteBalance(Number(balance.amount) / Math.pow(10, props.market.quoteToken.decimals))
    }, [networkConfig, props.market, connectedAddress])

    const getSubAccount = useCallback(async (injectiveAddress: string) => {
        const indexerGrpcAccountApi = new IndexerGrpcAccountApi(networkConfig.indexer)
        const subaccountsList = await indexerGrpcAccountApi.fetchSubaccountsList(
            injectiveAddress,
        )

        console.log(subaccountsList)
        return subaccountsList
    }, [networkConfig])

    useEffect(() => {
        if (!quoteBalance) {
            void getQuoteBalance().then().catch()
        }
    }, [getQuoteBalance, quoteBalance])

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

    const handleOrderTypeChange = (e) => {
        setOrderType(e.target.value);
    };

    const handleBuy = useCallback(async () => {
        console.log('Buy', { quantity, price, orderType });
        setError(null)
        const { key, offlineSigner } = await getKeplr(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (connectedAddress !== injectiveAddress) {
            setError("Wrong wallet connected")
            return
        }
        else {
            setError(null)
        }

        let subAccountId = await getSubAccount(injectiveAddress)
        console.log(subAccountId[0])
        subAccountId = subAccountId[0]

        let msgBuy = null

        if (orderType == "limit") {
            msgBuy = MsgCreateBinaryOptionsLimitOrder.fromJSON({
                marketId: props.marketId,
                subaccountId: subAccountId,
                injectiveAddress: injectiveAddress,
                orderType: InjectiveExchangeV1Beta1Exchange.OrderType.BUY,
                triggerPrice: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                feeRecipient: injectiveAddress,
                price: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                margin: ((Number(quantity) * Number(price)) * Math.pow(10, props.market.quoteToken.decimals)).toString(),
                quantity: quantity,
            });
        }
        else if (orderType == "market") {
            msgBuy = MsgCreateBinaryOptionsMarketOrder.fromJSON({
                marketId: props.marketId,
                subaccountId: subAccountId,
                injectiveAddress: injectiveAddress,
                orderType: InjectiveExchangeV1Beta1Exchange.OrderType.BUY,
                triggerPrice: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                feeRecipient: injectiveAddress,
                price: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                margin: ((Number(quantity) * Number(price)) * Math.pow(10, props.market.quoteToken.decimals)).toString(),
                quantity: quantity,
            });
        }
        else {
            return
        }


        console.log("buy order", msgBuy)
        setProgress(`Place buy order`)

        const result = await handleSendTx(pubKey, msgBuy, injectiveAddress, offlineSigner)
        if (result) {
            props.setLoaded(false)
            setQuoteBalance(null)
        }
    }, [connectedAddress, getKeplr, getSubAccount, handleSendTx, networkConfig.chainId, orderType, price, props, quantity]);

    const handleSell = useCallback(async () => {
        console.log('Sell', { quantity, price, orderType });
        setError(null)
        const { key, offlineSigner } = await getKeplr(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;

        if (connectedAddress !== injectiveAddress) {
            setError("Wrong wallet connected")
            return
        }
        else {
            setError(null)
        }

        let subAccountId = await getSubAccount(injectiveAddress)
        console.log(subAccountId[0])
        subAccountId = subAccountId[0]

        let msgBuy = null

        if (orderType == "limit") {
            msgBuy = MsgCreateBinaryOptionsLimitOrder.fromJSON({
                marketId: props.marketId,
                subaccountId: subAccountId,
                injectiveAddress: injectiveAddress,
                orderType: InjectiveExchangeV1Beta1Exchange.OrderType.SELL,
                triggerPrice: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                feeRecipient: injectiveAddress,
                price: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                margin: ((Number(quantity) * (1 - Number(price))) * Math.pow(10, props.market.quoteToken.decimals)).toString(),
                quantity: quantity,
            });
        }
        else if (orderType == "market") {
            msgBuy = MsgCreateBinaryOptionsMarketOrder.fromJSON({
                marketId: props.marketId,
                subaccountId: subAccountId,
                injectiveAddress: injectiveAddress,
                orderType: InjectiveExchangeV1Beta1Exchange.OrderType.SELL,
                price: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                feeRecipient: injectiveAddress,
                triggerPrice: (Number(price) * Math.pow(10, Number(props.market.quoteToken.decimals))).toString(),
                margin: ((Number(quantity) * (1 - Number(price))) * Math.pow(10, props.market.quoteToken.decimals)).toString(),
                quantity: quantity,
            });
        }
        else {
            return
        }

        console.log("sell order", msgBuy)
        setProgress(`Place sell order`)

        const result = await handleSendTx(pubKey, msgBuy, injectiveAddress, offlineSigner)
        if (result) {
            props.setLoaded(false)
            setQuoteBalance(null)
        }
    }, [connectedAddress, getKeplr, getSubAccount, handleSendTx, networkConfig.chainId, orderType, price, props, quantity]);

    return (
        <div className="p-4 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4 text-black">
            {quoteBalance && <div className='text-gray-700'>
                {props.market.quoteToken.symbol} Balance: {quoteBalance}
            </div>
            }
            <div>
                <label className="block text-gray-700">Quantity</label>
                <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
                />
            </div>
            <div>
                <label className="block text-gray-700">Price</label>
                <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black"
                />
            </div>
            <div>
                <div className="flex items-center mb-4">
                    <input
                        type="radio"
                        id="market-order"
                        name="orderType"
                        value="market"
                        checked={orderType === 'market'}
                        onChange={handleOrderTypeChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="market-order" className="ml-2 block text-gray-700">
                        Market Order
                    </label>
                </div>
                <div className="flex items-center">
                    <input
                        type="radio"
                        id="limit-order"
                        name="orderType"
                        value="limit"
                        checked={orderType === 'limit'}
                        onChange={handleOrderTypeChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="limit-order" className="ml-2 block text-gray-700">
                        Limit Order
                    </label>
                </div>
            </div>
            {price && quantity && props.market &&
                <div className='text-gray-700'>
                    Buy margin: {((Number(quantity) * Number(price))).toFixed(4)} {props.market.quoteToken.symbol}
                    <br />
                    Sell margin: {((Number(quantity) * (1 - Number(price)))).toFixed(4)} {props.market.quoteToken.symbol}
                </div>
            }


            <div className="flex space-x-4">
                <button
                    onClick={handleBuy}
                    className="w-full py-2 px-4 bg-green-500 text-white rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    Buy
                </button>
                <button
                    onClick={handleSell}
                    className="w-full py-2 px-4 bg-red-500 text-white rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    Sell
                </button>
            </div>
        </div>
    );
};

export default OrderPanel;
