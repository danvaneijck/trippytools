// Shared style tokens for the SHROOM × SAI hub. Kept in a non-component module
// so the page reads as one cohesive dashboard and Fast Refresh stays happy.

// The one elevated surface used by every panel on the page. A faint top-lit
// gradient over the dark teal page background gives panels subtle depth without
// the heavy black blocks the old layout used.
export const PANEL =
    'rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-white/1';

// Shared pill toggle styling so every "switch the view" control on the page
// (breakdown mode, interval, denom, market scope) reads identically.
export const TOGGLE_WRAP =
    'inline-flex overflow-hidden rounded-lg border border-white/10 bg-black/20 p-0.5 text-sm';
export const toggleBtn = (active: boolean): string =>
    `rounded-md px-3 py-1 font-medium transition-colors ${
        active ? 'bg-trippyYellow text-black' : 'text-white/60 hover:text-white'
    }`;
