import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    FaArrowRight,
    FaChartLine,
    FaCoins,
    FaDiscord,
    FaExternalLinkAlt,
    FaFire,
    FaHandHoldingUsd,
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
import { DAPPS, type Dapp } from './dapps';

// The two SHROOM/SAI Choice pools the hero links out to.
const CHOICE_POOLS = [
    { label: 'SHROOM / INJ', url: choiceSwapUrl('inj', SHROOM_CW) },
    { label: 'SAI / SHROOM', url: choiceSwapUrl(SAI_DENOM, SHROOM_CW) },
] as const;

// The default token the Liquidity tool opens on (SHROOM/INJ on Choice), kept in
// the link so the page lands on real data instead of an empty form.
const LIQUIDITY_DEFAULT =
    '/token-liquidity?address=inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5';

// The token toolkit — the original reason this site exists. It sits below the
// dapps now, as one compact grid rather than three featured cards.
const TOOLS = [
    { to: '/token-holders', icon: <FiUsers />, label: 'Holder tool' },
    { to: LIQUIDITY_DEFAULT, icon: <FiDroplet />, label: 'Liquidity tool' },
    { to: '/token-launch', icon: <FaRocket />, label: 'Create token' },
    { to: '/manage-tokens', icon: <FaCoins />, label: 'Manage tokens' },
    { to: '/ecosystem', icon: <FaChartLine />, label: 'Ecosystem Explorer' },
    { to: '/airdrop', icon: <FaParachuteBox />, label: 'Airdrops' },
    { to: '/claim-drop', icon: <FaHandHoldingUsd />, label: 'Claim drops' },
    { to: '/nft-airdrop', icon: <FaImages />, label: 'NFT drop' },
    { to: '/burn', icon: <FaFire />, label: 'Burn tokens' },
] as const;

const LiveDot = () => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Live
    </span>
);

// One dapp. The accent colour is per-product, so it comes through inline style
// (Tailwind can't generate a class for an arbitrary runtime value here) while
// everything structural stays in classes.
const DappCard = ({ dapp }: { dapp: Dapp }) => (
    <a
        href={dapp.href}
        target="_blank"
        rel="noopener noreferrer"
        className="dapp-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b from-white/6 to-white/1 p-5 transition hover:from-white/10"
        style={{ '--accent': dapp.accent } as CSSProperties}
    >
        {/* faint accent wash that lifts on hover */}
        <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-15 blur-3xl transition-opacity group-hover:opacity-35"
            style={{ background: dapp.accent }}
        />

        <div className="flex items-start justify-between gap-3">
            <span
                className="rounded-2xl"
                style={{ boxShadow: `0 0 0 1px ${dapp.accent}40` }}
            >
                {dapp.mark}
            </span>
            <LiveDot />
        </div>

        <div className="mt-4 text-[11px] uppercase tracking-[0.22em] text-white/40">
            {dapp.kind}
        </div>
        <div className="text-xl font-semibold text-white">{dapp.name}</div>

        <p className="mt-2 grow font-sans text-sm leading-relaxed text-white/55">
            {dapp.desc}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
            {dapp.points.map((p) => (
                <span
                    key={p}
                    className="rounded-md bg-white/6 px-2 py-1 text-[11px] font-medium text-white/60"
                >
                    {p}
                </span>
            ))}
        </div>

        <div
            className="mt-4 flex items-center gap-2 text-sm font-semibold"
            style={{ color: dapp.accent }}
        >
            {dapp.cta}
            <FaArrowRight className="text-xs transition group-hover:translate-x-1" />
        </div>
    </a>
);

const Banner = ({
    to,
    external,
    eyebrow,
    title,
    sub,
    cta,
    mark,
}: {
    to: string;
    external?: boolean;
    eyebrow: string;
    title: ReactNode;
    sub: string;
    cta: string;
    mark: ReactNode;
}) => {
    const className =
        'group flex flex-col gap-4 rounded-2xl border border-white/10 bg-linear-to-r from-trippyYellow/12 via-white/4 to-transparent p-5 transition hover:border-trippyYellow/40 sm:flex-row sm:items-center sm:justify-between';
    const body = (
        <>
            <div className="flex items-center gap-4">
                {mark}
                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                        {eyebrow}
                    </div>
                    <div className="text-lg font-semibold text-white">{title}</div>
                    <div className="font-sans text-sm text-white/50">{sub}</div>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-trippyYellow">
                {cta}
                {external ? (
                    <FaExternalLinkAlt className="text-xs" />
                ) : (
                    <FaArrowRight className="transition group-hover:translate-x-1" />
                )}
            </div>
        </>
    );

    return external ? (
        <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
            {body}
        </a>
    ) : (
        <Link to={to} className={className}>
            {body}
        </Link>
    );
};

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
                            It powers a launchpad, a trading terminal and an
                            on-chain game — plus the token toolkit this site
                            started as.
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

            {/* ---- the three live dapps: the headline of the page ---- */}
            <section>
                <SectionHeader
                    eyebrow="Built on Injective"
                    title="Three live dapps"
                    sub="Launch it, trade it, gamble it — all on Injective mainnet."
                />
                <div className="grid gap-4 md:grid-cols-3">
                    {DAPPS.map((d) => (
                        <DappCard key={d.name} dapp={d} />
                    ))}
                </div>
            </section>

            {/* ---- tokenomics explainer ---- */}
            <Banner
                to="/tokenomics"
                eyebrow="Tokenomics"
                title={
                    <>
                        SHROOM <span className="text-white/40">×</span> SAI — one
                        engine, two sinks
                    </>
                }
                sub="SAI is retired by use. SHROOM is retired by revenue. Read how the loop turns."
                cta="Read the tokenomics"
                mark={
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-trippyYellow/15 text-2xl text-trippyYellow ring-1 ring-trippyYellow/30">
                        <FaFire />
                    </span>
                }
            />

            {/* ---- Shroom Hub banner ---- */}
            <Banner
                to="/shroom-hub"
                eyebrow="Ecosystem dashboard"
                title={
                    <>
                        Explore the SHROOM <span className="text-white/40">×</span>{' '}
                        SAI Hub
                    </>
                }
                sub="Live prices, liquidity breakdown, holders and your portfolio in one view."
                cta="Open hub"
                mark={
                    <img
                        src={shroom}
                        alt="SHROOM"
                        className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/15"
                    />
                }
            />

            {/* ---- token toolkit ---- */}
            <section>
                <SectionHeader
                    eyebrow="Toolkit"
                    title="Token tools"
                    sub="Inspect, launch, airdrop and burn tokens on Injective — no dev knowledge needed."
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {TOOLS.map((t) => (
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
