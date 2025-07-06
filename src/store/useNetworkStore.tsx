import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NETWORKS } from '../utils/constants';


type NetworkKey = keyof typeof NETWORKS;        // "mainnet" | "testnet"

interface NetworkState {
    /** Which network is selected */
    networkKey: NetworkKey;
    /** Full config for the selected network */
    network: (typeof NETWORKS)[NetworkKey];
    /** Switch networks */
    setNetwork: (key: NetworkKey) => void;
}

const useNetworkStore = create<NetworkState>()(
    persist(
        (set) => ({
            networkKey: 'mainnet',
            network: NETWORKS.mainnet,
            setNetwork: (key) =>
                set(() => ({
                    networkKey: key,
                    network: NETWORKS[key],
                })),
        }),
        {
            name: 'selected-network',          // localStorage key
        },
    ),
);

export default useNetworkStore;
