import { create } from 'zustand';
import { Token } from '../utils/types';

// Deliberately NOT persisted. The full token list (2700+ tokens, each carrying
// nested pool/price graphs) serializes to ~5–8MB, which overflows iOS Safari's
// ~5MB localStorage quota: the persist write throws QuotaExceededError and, being
// uncaught, crashes the whole app before React mounts — a blank page on every
// iPhone browser. TokenInitializer refetches the list `network-only` on load
// (and every 100s), so persistence bought a marginally faster first paint at the
// cost of an app-wide outage. Drop any stale key older builds left behind so
// affected users reclaim their quota.
try {
    localStorage.removeItem('tokens-storage');
} catch {
    /* storage blocked (private mode) — nothing to clean up */
}

export interface TokenStore {
    tokens: Token[];
    setTokens: (tokens: Token[]) => void;
}

const useTokenStore = create<TokenStore>()((set) => ({
    tokens: [],
    setTokens: (tokens: Token[]) => set({ tokens }),
}));

export default useTokenStore;
