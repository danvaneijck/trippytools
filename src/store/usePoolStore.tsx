import { create } from 'zustand';
import { LiquidityPool } from '../utils/types';

// Deliberately NOT persisted — same reasoning as useTokenStore. The pool list is
// network-hydrated by PoolInitializer (`network-only`) and grows unbounded as
// pools are indexed, so persisting it is the same iOS localStorage-quota hazard
// that white-screens the app. Clear any stale key from older builds.
try {
    localStorage.removeItem('pools-storage');
} catch {
    /* storage blocked (private mode) — nothing to clean up */
}

export interface PoolStore {
    pools: LiquidityPool[];
    setPools: (pools: LiquidityPool[]) => void;
}

const useLiquidityPoolStore = create<PoolStore>()((set) => ({
    pools: [],
    setPools: (pools: LiquidityPool[]) => set({ pools }),
}));

export default useLiquidityPoolStore;
