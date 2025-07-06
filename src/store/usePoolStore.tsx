import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LiquidityPool } from '../utils/types';

export interface PoolStore {
    pools: LiquidityPool[];
    setPools: (pools: LiquidityPool[]) => void;
}

const useLiquidityPoolStore = create<PoolStore>()(
    persist(
        (set, get) => ({
            pools: [],
            setPools: (pools: LiquidityPool[]) => set({ pools }),
        }),
        {
            name: 'pools-storage',
        }
    )
);

export default useLiquidityPoolStore;
