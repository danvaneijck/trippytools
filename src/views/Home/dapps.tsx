// The three live Trippy dapps the home page showcases. Each is a separate
// mainnet deployment on its own subdomain — this page is the front door.
//
// The `mark` is each product's own app icon so the cards read as the real
// thing: SHROOM Pad and the Terminal ship a favicon we mirror in ./assets,
// and Chicken Road's own favicon is the 🐔 emoji, so that's what we render.

import type { ReactNode } from 'react';
import padMark from '../../assets/dapp_shroom_pad.png';
import terminalMark from '../../assets/dapp_terminal.svg';

export interface Dapp {
    name: string;
    href: string;
    kind: string;
    desc: string;
    cta: string;
    /** Accent colour, used for the icon ring, hover border and CTA text. */
    accent: string;
    mark: ReactNode;
    /** Two or three things the product actually does. */
    points: readonly string[];
}

const markImg = (src: string, alt: string) => (
    <img
        src={src}
        alt={alt}
        className="h-14 w-14 rounded-2xl object-cover"
        loading="lazy"
    />
);

export const DAPPS: readonly Dapp[] = [
    {
        name: 'SHROOM Pad',
        href: 'https://pump.trippyinj.xyz',
        kind: 'Launchpad',
        desc: 'Launch a token on a fair bonding curve and graduate it straight into a real Choice CLMM pool. Quote in INJ, USDC or SAI.',
        cta: 'Launch a token',
        accent: '#fb923c',
        mark: markImg(padMark, 'SHROOM Pad'),
        points: ['Bonding curve', 'Auto-graduation', 'Creator fees'],
    },
    {
        name: 'Trippy Terminal',
        href: 'https://trade.trippyinj.xyz',
        kind: 'Trading terminal',
        desc: 'Every Injective market on one screen — live charts, orderbooks, perps and wallet portfolios, with swaps routed through Choice.',
        cta: 'Start trading',
        accent: '#f9d73f',
        mark: markImg(terminalMark, 'Trippy Terminal'),
        points: ['Spot & perps', 'Live tape', 'Portfolio tracking'],
    },
    {
        name: 'Chicken Road',
        href: 'https://cross.trippyinj.xyz',
        kind: 'Provably-fair game',
        desc: 'Cross the road, cash out before the crash. Every round is verifiable from a drand beacon, settled on Injective EVM.',
        cta: 'Play a round',
        accent: '#34d399',
        mark: (
            <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/60 text-3xl"
            >
                🐔
            </span>
        ),
        points: ['Provably fair', 'Session keys', 'Instant settle'],
    },
] as const;
