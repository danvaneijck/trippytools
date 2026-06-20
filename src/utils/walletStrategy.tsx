import { WalletStrategy } from '@injectivelabs/wallet-strategy'
import { Web3Exception } from '@injectivelabs/exceptions'
import { EvmChainId } from '@injectivelabs/ts-types'
import { getNetworkEndpoints } from '@injectivelabs/networks'
import { MsgBroadcaster } from '@injectivelabs/wallet-core'
import { NETWORKS } from './constants'
import useNetworkStore from '../store/useNetworkStore'
import useWalletStore from '../store/useWalletStore'
import { getInjectiveAddress } from '@injectivelabs/sdk-ts'

const ethRpc = "https://1rpc.io/eth"

export const getSelectedNetworkKey = () =>
    useNetworkStore.getState().networkKey

export const getSelectedNetwork = () =>
    NETWORKS[getSelectedNetworkKey()];

export const getSelectedWallet = () =>
    useWalletStore.getState().selectedWalletType

const buildWalletStrategy = () => {
    const network = getSelectedNetworkKey()
    let ethereumOptions = undefined
    if (network === 'mainnet') {
        ethereumOptions = {
            ethereumChainId: EvmChainId.Mainnet,
            rpcUrl: ethRpc
        }
    }

    const wallet = getSelectedWallet()
    const chainId = getSelectedNetwork().chainId

    return new WalletStrategy({
        chainId: chainId,
        wallet: wallet,
        ethereumOptions: ethereumOptions,
        strategies: {}
    } as any)
}

export const getAddresses = async (): Promise<string[]> => {
    const walletStrategy = buildWalletStrategy()
    let addresses = (await walletStrategy.getAddresses())
    if (walletStrategy.getWallet() === 'metamask' || walletStrategy.getWallet() === 'phantom') {
        addresses = addresses.map(getInjectiveAddress)
    }
    if (addresses.length === 0) {
        throw new Web3Exception(new Error('There are no addresses linked in this wallet.'))
    }
    return addresses
}

export interface PerformTransactionOptions {
    // Explicit gas limit. Required for txs that embed an inner EVM tx (e.g.
    // MsgCreateTokenPair auto-deploys an ERC-20 via MsgEthereumTx): the auto
    // gas simulation under-provisions the inner EVM contract creation, so we
    // disable simulation and pass a generous fixed limit instead.
    gas?: number;
}

export const performTransaction = async (
    address: string,
    msgs: any[],
    opts: PerformTransactionOptions = {},
) => {
    if (!address || !msgs || msgs.length === 0) return

    const useExplicitGas = typeof opts.gas === 'number'

    const walletStrategy = buildWalletStrategy()
    const broadcaster = new MsgBroadcaster({
        walletStrategy,
        // Simulation can't price the inner EVM deploy in a paired-token tx, so
        // when an explicit gas limit is supplied we turn it off.
        simulateTx: !useExplicitGas,
        network: getSelectedNetworkKey(),
        endpoints: getNetworkEndpoints(getSelectedNetworkKey()),
        gasBufferCoefficient: 1.1,
    });

    const result = await broadcaster.broadcastV2({
        injectiveAddress: address,
        msgs,
        ...(useExplicitGas ? { gas: { gas: opts.gas } } : {}),
    });

    return result;

};