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

const buildWalletStrategy = async () => {
    const network = getSelectedNetworkKey()
    // wallet-strategy >= 1.20 reads `evmOptions.evmChainId` (the old
    // `ethereumOptions.ethereumChainId` shape is no longer read at all, which
    // silently disabled metamask/phantom). Keep the original mainnet-only EVM
    // intent, just under the new field names.
    let evmOptions = undefined
    if (network === 'mainnet') {
        evmOptions = {
            evmChainId: EvmChainId.Mainnet,
            rpcUrl: ethRpc
        }
    }

    const wallet = getSelectedWallet()
    if (!wallet) {
        throw new Error('No wallet selected. Connect a wallet first.')
    }
    const chainId = getSelectedNetwork().chainId

    const walletStrategy = new WalletStrategy({
        chainId: chainId,
        wallet: wallet,
        evmOptions: evmOptions,
        strategies: {}
    } as any)

    // wallet-strategy >= 1.20 lazy-loads each wallet's strategy: the
    // WalletStrategy subclass overrides setWallet() to run loadStrategy() (+ any
    // initStrategy). Until that runs, every getAddresses/sign call delegates to
    // getStrategy(), which throws "Wallet <x> strategy not loaded". So load the
    // selected wallet's strategy before handing it to getAddresses/MsgBroadcaster.
    await walletStrategy.setWallet(wallet)

    return walletStrategy
}

export const getAddresses = async (): Promise<string[]> => {
    const walletStrategy = await buildWalletStrategy()
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
    // Multiplier applied to the simulated gas estimate (default 1.1). Bulk txs
    // like airdrop multisends occasionally land just over the simulated cost, so
    // callers can widen the headroom without switching to a fixed limit that
    // might exceed the block gas cap.
    gasBufferCoefficient?: number;
}

export const performTransaction = async (
    address: string,
    msgs: any[],
    opts: PerformTransactionOptions = {},
) => {
    if (!address || !msgs || msgs.length === 0) return

    const useExplicitGas = typeof opts.gas === 'number'

    const walletStrategy = await buildWalletStrategy()
    const broadcaster = new MsgBroadcaster({
        walletStrategy,
        // Simulation can't price the inner EVM deploy in a paired-token tx, so
        // when an explicit gas limit is supplied we turn it off.
        simulateTx: !useExplicitGas,
        network: getSelectedNetworkKey(),
        endpoints: getNetworkEndpoints(getSelectedNetworkKey()),
        gasBufferCoefficient: opts.gasBufferCoefficient ?? 1.1,
    });

    const result = await broadcaster.broadcastV2({
        injectiveAddress: address,
        msgs,
        ...(useExplicitGas ? { gas: { gas: opts.gas } } : {}),
    });

    return result;

};