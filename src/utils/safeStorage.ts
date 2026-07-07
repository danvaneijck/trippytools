import { createJSONStorage } from 'zustand/middleware';

// A JSON storage for zustand `persist` that can never crash the app. iOS Safari
// caps localStorage at ~5MB per origin and throws QuotaExceededError on an
// over-quota write; left unhandled that error bubbles through React's render and
// white-screens the whole app on every iPhone browser. Here we swallow it — the
// value simply isn't persisted this time — so the app keeps running. Also
// tolerates private-mode SecurityError.
export const safeJSONStorage = createJSONStorage(() => ({
    getItem: (name: string): string | null => {
        try {
            return localStorage.getItem(name);
        } catch {
            return null;
        }
    },
    setItem: (name: string, value: string): void => {
        try {
            localStorage.setItem(name, value);
        } catch (e) {
            console.warn(`[safeStorage] could not persist "${name}"`, e);
        }
    },
    removeItem: (name: string): void => {
        try {
            localStorage.removeItem(name);
        } catch {
            /* ignore */
        }
    },
}));
