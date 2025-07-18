import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        (set, get) => ({
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
        }
    )
);

export default useWalletStore;
