import { create } from 'zustand';
import type { OrderbookSwapRoute } from '../utils/swap/types';

// Helix-market-derived orderbook edges. The route finder uses these for
// tick-size rounding when quoting orderbook hops; with the new aggregation shape
// the executing market id comes from the backend route directly.
interface OrderbookRouteStore {
  routes: OrderbookSwapRoute[];
  setRoutes: (routes: OrderbookSwapRoute[]) => void;
}

const useOrderbookRouteStore = create<OrderbookRouteStore>((set) => ({
  routes: [],
  setRoutes: (routes) => set({ routes }),
}));

export default useOrderbookRouteStore;
