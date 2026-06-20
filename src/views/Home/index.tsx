import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    FaArrowRight,
    FaBullhorn,
    FaCoins,
    FaDiscord,
    FaFire,
    FaImages,
    FaParachuteBox,
    FaRocket,
    FaTelegram,
    FaTwitter,
} from 'react-icons/fa';
import { FiDroplet, FiUsers } from 'react-icons/fi';
import shroom from '../../assets/shroom.jpg';
import choice from '../../assets/choice.svg';
import Footer from '../../components/App/Footer';
import ShroomMarkets from '../../components/App/markets';
import SwapWidget from '../../components/App/swap/SwapWidget';
import { SectionHeader } from '../ShroomHub/ui';
import { SAI_DENOM, SHROOM_CW } from '../ShroomHub/ecosystem';
import { choiceSwapUrl } from '../../utils/swap/constants';

// The two SHROOM/SAI Choice pools the hero links out to.
const CHOICE_POOLS = [
    { label: 'SHROOM / INJ', url: choiceSwapUrl('inj', SHROOM_CW) },
    { label: 'SAI / SHROOM', url: choiceSwapUrl(SAI_DENOM, SHROOM_CW) },
] as const;

// The default token the Liquidity tool opens on (SHROOM/INJ on Choice), kept in
// the link so the page lands on real data instead of an empty form.
const LIQUIDITY_DEFAULT =
    '/token-liquidity?address=inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5';

// The three headline tools the home page leads with.
const FEATURED = [
    {
        to: '/token-holders',
        icon: <FiUsers />,
        title: 'Holder tool',
        cta: 'View holders',
        desc: 'Snapshot any token’s holders across Injective. Sort, filter dust, and export a clean CSV ready for an airdrop.',
    },
    {
        to: LIQUIDITY_DEFAULT,
        icon: <FiDroplet />,
        title: 'Liquidity tool',
        cta: 'Inspect liquidity',
        desc: 'See liquidity providers on Choice, DojoSwap & Astroport — including whether the LP is burned or locked.',
    },
    {
        to: '/token-launch',
        icon: <FaRocket />,
        title: 'Create token',
        cta: 'Launch a token',
        desc: 'Mint a token-factory denom in seconds, auto-paired with an Injective EVM ERC-20. No dev knowledge needed.',
    },
] as const;

// Secondary tools — accessible, but a tier below the headline three.
const MORE_TOOLS = [
    { to: '/manage-tokens', icon: <FaCoins />, label: 'Manage tokens' },
    { to: '/airdrop', icon: <FaParachuteBox />, label: 'Airdrops' },
    { to: '/nft-airdrop', icon: <FaImages />, label: 'NFT drop' },
    { to: '/pre-sale-tool', icon: <FaBullhorn />, label: 'Presale' },
    { to: '/burn', icon: <FaFire />, label: 'Burn tokens' },
] as const;

const FeaturedCard = ({
    to,
    icon,
    title,
    cta,
    desc,
}: {
    to: string;
    icon: ReactNode;
    title: string;
    cta: string;
    desc: string;
}) => (
    <Link
        to={to}
        className="group flex flex-col rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-white/1 p-5 transition hover:border-trippyYellow/40 hover:from-white/8"
    >
        <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-trippyYellow/15 text-xl text-trippyYellow ring-1 ring-trippyYellow/25">
                {icon}
            </span>
            <div className="text-lg font-semibold text-white">{title}</div>
        </div>
        <p className="mt-3 grow font-sans text-sm leading-relaxed text-white/55">
            {desc}
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-trippyYellow">
            {cta}
            <FaArrowRight className="transition group-hover:translate-x-1" />
        </div>
    </Link>
);

const Home = () => (
    <div className="flex min-h-screen flex-col bg-customGray text-stone-100">
        <div className="mx-auto w-full max-w-5xl space-y-4 px-3 pt-20 pb-16 sm:px-5 md:space-y-5 md:pt-24">
            {/* ---- hero: brand + copy on the left, live swap on the right ---- */}
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/7 via-white/2 to-transparent p-5 md:p-7">
                <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                        <div className="flex flex-col items-center gap-4 md:flex-row md:items-center lg:items-start">
                            <img
                                src={shroom}
                                alt="SHROOM"
                                className="w-27.5 rounded-full md:w-37.5"
                            />
                            <div className="text-center md:text-left">
                                <div className="text-lg text-white/70 md:text-2xl">
                                    Get trippy with
                                </div>
                                <div className="font-magic text-5xl leading-none text-white md:text-6xl">
                                    $SHROOM
                                </div>
                                <div className="mt-3 flex flex-row justify-center gap-5 text-2xl md:justify-start">
                                    <a
                                        className="text-white/70 transition hover:text-trippyYellow"
                                        href="https://x.com/trippy_inj"
                                    >
                                        <FaTwitter />
                                    </a>
                                    <a
                                        className="text-white/70 transition hover:text-trippyYellow"
                                        href="https://discord.gg/Nnz34jzA5T"
                                    >
                                        <FaDiscord />
                                    </a>
                                    <a
                                        className="text-white/70 transition hover:text-trippyYellow"
                                        href="https://t.me/trippinj"
                                    >
                                        <FaTelegram />
                                    </a>
                                </div>
                            </div>
                        </div>

                        <p className="mt-5 font-sans text-sm leading-relaxed text-white/60">
                            SHROOM is a meme coin with real utility on Injective.
                            Use the toolkit below to inspect token holders and
                            liquidity, launch and manage your own tokens, and run
                            airdrops or presales with zero dev knowledge — all
                            from one place.
                        </p>

                        <div className="mt-5 flex flex-wrap justify-center gap-3 md:justify-start">
                            {CHOICE_POOLS.map((p) => (
                                <a
                                    key={p.label}
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white/80 transition hover:border-trippyYellow/40 hover:text-white"
                                >
                                    <img src={choice} alt="Choice" className="w-4" />
                                    {p.label} pool
                                    <FaArrowRight className="text-xs transition group-hover:translate-x-1" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Live SHROOM-ecosystem swap, routed + aggregated via Choice */}
                    <div className="flex w-full shrink-0 justify-center lg:w-auto">
                        <SwapWidget />
                    </div>
                </div>
            </section>

            {/* ---- headline tools ---- */}
            <section>
                <SectionHeader
                    eyebrow="Toolkit"
                    title="Explore tokens on Injective"
                    sub="Holders, liquidity and token creation — the essentials."
                />
                <div className="grid gap-4 md:grid-cols-3">
                    {FEATURED.map((t) => (
                        <FeaturedCard key={t.to} {...t} />
                    ))}
                </div>
            </section>

            {/* ---- pump.trippyinj.xyz launchpad ad (external, testnet) ---- */}
            <a
                href="https://pump.trippyinj.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-trippyYellow/25 bg-linear-to-r from-trippyYellow/18 via-trippyYellow/6 to-transparent p-5 transition hover:border-trippyYellow/50 sm:flex-row sm:items-center sm:justify-between"
            >
                <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-trippyYellow/15 text-2xl text-trippyYellow ring-1 ring-trippyYellow/30">
                        <FaRocket className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                                Launchpad
                            </span>
                            <span className="rounded-full border border-trippyYellow/40 bg-trippyYellow/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-trippyYellow">
                                Testnet
                            </span>
                        </div>
                        <div className="text-lg font-semibold text-white">
                            pump.trippyinj.xyz
                        </div>
                        <div className="font-sans text-sm text-white/55">
                            Launch and trade tokens on a fair bonding curve — the
                            upcoming SAI use case. Live now on testnet.
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-trippyYellow">
                    Try the launchpad
                    <FaArrowRight className="transition group-hover:translate-x-1" />
                </div>
            </a>

            {/* ---- Shroom Hub banner ---- */}
            <Link
                to="/shroom-hub"
                className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-linear-to-r from-trippyYellow/12 via-white/4 to-transparent p-5 transition hover:border-trippyYellow/40 sm:flex-row sm:items-center sm:justify-between"
            >
                <div className="flex items-center gap-4">
                    <img
                        src={shroom}
                        alt="SHROOM"
                        className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/15"
                    />
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                            Ecosystem dashboard
                        </div>
                        <div className="text-lg font-semibold text-white">
                            Explore the SHROOM <span className="text-white/40">×</span> SAI Hub
                        </div>
                        <div className="font-sans text-sm text-white/50">
                            Live prices, liquidity breakdown, holders and your
                            portfolio in one view.
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-trippyYellow">
                    Open hub
                    <FaArrowRight className="transition group-hover:translate-x-1" />
                </div>
            </Link>

            {/* ---- secondary tools ---- */}
            <section>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {MORE_TOOLS.map((t) => (
                        <Link
                            key={t.to}
                            to={t.to}
                            className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/3 px-3.5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/6 hover:text-white"
                        >
                            <span className="text-base text-trippyYellow/80 transition group-hover:text-trippyYellow">
                                {t.icon}
                            </span>
                            {t.label}
                        </Link>
                    ))}
                </div>
            </section>

            {/* ---- live markets (chart + trades), styled like the hub ---- */}
            <section>
                <SectionHeader
                    eyebrow="Markets"
                    title="Live price & trades"
                    sub="SHROOM & SAI across every Injective venue."
                />
                <ShroomMarkets />
            </section>
        </div>
        <Footer />
    </div>
);

export default Home;
