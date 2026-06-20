import { create } from 'zustand';
import type { SwapPool } from '../utils/swap/types';

// Choice AMM pools (address + aggregation fee) used by the route finder to apply
// the per-pool aggregation fee when quoting AMM hops. Kept separate from the
// main pool store so the broader-filtered swap query can't disturb other views.
interface SwapPoolStore {
  swapPools: SwapPool[];
  setSwapPools: (pools: SwapPool[]) => void;
}

const useSwapPoolStore = create<SwapPoolStore>((set) => ({
  swapPools: [],
  setSwapPools: (swapPools) => set({ swapPools }),
}));

export default useSwapPoolStore;
