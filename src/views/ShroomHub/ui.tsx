// Shared presentational components for the SHROOM × SAI hub. Style tokens live
// in ./styles so this file only exports components (keeps Fast Refresh happy).

import type { ReactNode } from 'react';

export const SectionHeader = ({
    eyebrow,
    title,
    sub,
    children,
}: {
    eyebrow: string;
    title: string;
    sub?: string;
    children?: ReactNode;
}) => (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
                {eyebrow}
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {sub && <div className="text-sm text-white/50">{sub}</div>}
        </div>
        {children}
    </div>
);

// A small labelled stat used inside panels (supply, liquidity, burned, …). Value
// can be plain text or richer content (e.g. a coloured badge).
export const StatTile = ({
    label,
    value,
    accent,
}: {
    label: string;
    value: ReactNode;
    accent?: boolean;
}) => (
    <div className="rounded-xl bg-white/3 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
        <div
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
                accent ? 'text-trippyYellow' : 'text-white'
            }`}
        >
            {value}
        </div>
    </div>
);
