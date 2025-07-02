import { WalletStrategy } from '@injectivelabs/wallet-strategy'
import { TxRaw } from '@injectivelabs/sdk-ts'
import { Web3Exception } from '@injectivelabs/exceptions'
import { EthereumChainId } from '@injectivelabs/ts-types'
import { getNetworkEndpoints } from '@injectivelabs/networks'
import { MsgBroadcaster } from '@injectivelabs/wallet-core'
import { NETWORKS } from './constants'
import useNetworkStore from '../store/useNetworkStore'

const ethRpc = "https://1rpc.io/eth"

export const getSelectedNetworkKey = () =>
    useNetworkStore.getState().networkKey

/** …or the full network object, if that’s what you usually need */
export const getSelectedNetwork = () =>
    NETWORKS[getSelectedNetworkKey()];

export const walletStrategy = new WalletStrategy({
    chainId: getSelectedNetwork().chainId,
    ethereumOptions: {
        ethereumChainId: EthereumChainId.Mainnet,
        rpcUrl: ethRpc
    },
    strategies: {}
})

// Get wallet's addresses
export const getAddresses = async (): Promise<string[]> => {
    const addresses = await walletStrategy.getAddresses()

    if (addresses.length === 0) {
        throw new Web3Exception(new Error('There are no addresses linked in this wallet.'))
    }

    return addresses
}

// Sign an Injective transaction
export const signTransaction = async (tx: TxRaw, address, accountNumber, chainId): Promise<string[]> => {
    const response = await walletStrategy.signCosmosTransaction(
        {
            accountNumber: accountNumber,
            address: address,
            chainId: chainId,
            txRaw: tx
        }
    )

    return response
}

// Send an Injective transaction
export const sendTransaction = async (tx: TxRaw, address, chainId, endpoints): Promise<string[]> => {
    const response = await walletStrategy.sendTransaction(
        tx,
        {
            address: address,
            chainId: chainId,
            endpoints: endpoints,
        }
    )

    return response
}

export const performTransaction = async (address, msgs) => {

    const broadcaster = new MsgBroadcaster({
        walletStrategy,
        simulateTx: true,
        network: getSelectedNetworkKey(),
        endpoints: getNetworkEndpoints(getSelectedNetworkKey()),
        gasBufferCoefficient: 1.1,
    });

    try {
        const result = await broadcaster.broadcastV2({
            injectiveAddress: address,
            msgs,
        });

        return result;
    } catch (err) {
        throw err;
    }
};