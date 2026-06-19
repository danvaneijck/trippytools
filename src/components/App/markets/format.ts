import type { MarketDescriptor } from './types';

// Subscript-zero notation for the tiny prices these markets trade at, e.g.
// 0.000007538 -> "0.0₅7538" (the convention used on most DEX UIs).
const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const toSub = (n: number) =>
    String(n)
        .split('')
        .map((d) => SUBS[+d])
        .join('');

export const formatPrice = (n: number): string => {
    if (!isFinite(n) || n <= 0) return '0';
    if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (n >= 0.001) return n.toPrecision(4).replace(/0+$/, '').replace(/\.$/, '');
    const exp = Math.floor(Math.log10(n));
    const leadingZeros = -exp - 1;
    const sig = Math.round(n * Math.pow(10, -exp + 3));
    const sigStr = String(sig).replace(/0+$/, '') || '0';
    return `0.0${toSub(leadingZeros)}${sigStr}`;
};

export const formatUsd = (n: number): string =>
    n >= 1000
        ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Compact amounts: 637087 -> "637.1K", 1.2e6 -> "1.2M".
export const formatAmount = (n: number): string => {
    if (!isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

export const shortAddr = (a: string | null): string =>
    a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';

export const timeAgo = (ms: number, now: number): string => {
    const s = Math.max(0, Math.floor((now - ms) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
};

// Human label for a venue, e.g. "Orderbook", "Choice", "Choice CLMM".
export const venueLabel = (m: MarketDescriptor): string => {
    if (m.kind === 'orderbook') return 'Orderbook';
    if (m.kind === 'clmm') return `${m.venue} CLMM`;
    return m.venue;
};
