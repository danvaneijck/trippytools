import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Token } from '../utils/types';

export interface TokenStore {
    tokens: Token[];
    setTokens: (tokens: Token[]) => void;
}

const useTokenStore = create<TokenStore>()(
    persist(
        (set) => ({
            tokens: [],
            setTokens: (tokens: Token[]) => set({ tokens }),
        }),
        {
            name: 'tokens-storage',
        }
    )
);

export default useTokenStore;
