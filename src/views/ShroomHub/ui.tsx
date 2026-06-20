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
