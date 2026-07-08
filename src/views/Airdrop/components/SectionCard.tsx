import type { ReactNode } from "react";
import { cardBase } from "./ui";

// Numbered step container shared by the token- and NFT-airdrop flows: a brand
// badge + title + optional subtitle, then the step body.
const SectionCard = ({
    step,
    title,
    subtitle,
    children,
    className = "",
}: {
    step?: ReactNode;
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
    className?: string;
}) => (
    <section className={`${cardBase} ${className}`}>
        <header className="mb-4 flex items-start gap-3">
            {step !== undefined && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-trippyYellow text-sm font-bold text-black">
                    {step}
                </span>
            )}
            <div>
                <h2 className="text-base font-bold leading-tight text-white">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
            </div>
        </header>
        {children}
    </section>
);

export default SectionCard;
