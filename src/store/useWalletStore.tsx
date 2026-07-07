import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../utils/safeStorage';

export interface WalletStore {

    connectedWallet: string | null;
    setConnectedWallet: (wallet: string | null) => void;
    showWallets: boolean;
    setShowWallets: (show: boolean) => void;

    selectedWalletType: "keplr" | "leap" | "metamask" | "phantom" | null;
    setSelectedWalletType: (
        t: "keplr" | "leap" | "metamask" | "phantom" | null
    ) => void;
}

const useWalletStore = create<WalletStore>()(
    persist(
        (set) => ({
            connectedWallet: null,
            showWallets: false,

            setConnectedWallet: (wallet: string | null) =>
                set(() => ({ connectedWallet: wallet })),

            setShowWallets: (show: boolean) =>
                set(() => ({ showWallets: show })),

            selectedWalletType: null,
            setSelectedWalletType: t => set({ selectedWalletType: t }),
        }),
        {
            name: 'wallet-storage',
            // Small, but route through the crash-safe storage so a full/blocked
            // localStorage can never white-screen the app on write.
            storage: safeJSONStorage,
        }
    )
);

export default useWalletStore;
