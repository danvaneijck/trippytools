// Public SHROOM × SAI tokenomics explainer.
//
// Renders ./content (the plain-data subset of the revision-2 plan in
// shroom_launchpad/docs/SAI_TOKENOMICS_PLAN.md). Nothing here is fetched: the
// numbers are supply and configuration, not market data. Live prices, market
// caps and liquidity live on the Shroom Hub, which this page links to.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaExternalLinkAlt, FaLock } from 'react-icons/fa';
import Footer from '../../components/App/Footer';
import { SectionHeader } from '../ShroomHub/ui';
import { PANEL } from '../ShroomHub/styles';
import {
    EARN,
    LOOP,
    PLAN_DATE,
    PLAN_REVISION,
    QUOTES,
    RAILS,
    ROLLOUT,
    SAI_MAX_SUPPLY,
    SINKS,
    SUPPLY,
    THESIS,
    TOKENS,
    type Status,
} from './content';

const num = (n: number) => n.toLocaleString('en-US');

// Live vs planned. Every component of the plan carries one, because most of
// this is not deployed yet and the page should never imply otherwise.
const StatusBadge = ({ status }: { status: Status }) =>
    status === 'live' ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
        </span>
    ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            <span className="h-1.5 w-1.5 rounded-full border border-white/40" />
            Planned
        </span>
    );

const Panel = ({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) => <div className={`${PANEL} p-5 ${className}`}>{children}</div>;

const Tokenomics = () => (
    <div className="flex min-h-screen flex-col bg-customGray text-stone-100">
        <div className="mx-auto w-full max-w-5xl space-y-8 px-3 pt-20 pb-20 sm:px-5 md:pt-24">
            {/* ---- masthead ---- */}
            <header>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-trippyYellow">
                        The SHROOM economy
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        {PLAN_REVISION}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                        {PLAN_DATE}
                    </span>
                </div>

                <h1 className="mt-3 font-magic text-4xl leading-tight text-white md:text-5xl">
                    SHROOM <span className="text-white/30">×</span> SAI
                    <br />
                    one engine, two sinks
                </h1>

                <p className="mt-4 max-w-2xl font-sans text-base leading-relaxed text-white/60">
                    SAI is the fuel — the quote currency every launch is priced
                    in. SHROOM is the claim on the activity that fuel creates.
                    Each token has exactly one job, and each has a sink that
                    never stops.
                </p>

                <p className="mt-5 border-l-2 border-trippyYellow/60 pl-4 font-magic text-xl text-white md:text-2xl">
                    {THESIS}
                </p>
            </header>

            {/* ---- the honesty banner: most of this is not deployed ---- */}
            <div className="flex flex-col gap-3 rounded-2xl border border-trippyYellow/25 bg-trippyYellow/8 p-4 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-trippyYellow/15 text-trippyYellow ring-1 ring-trippyYellow/30">
                    <FaLock className="text-sm" />
                </span>
                <p className="font-sans text-sm leading-relaxed text-white/70">
                    <span className="font-semibold text-white">
                        This is the published plan, not a status page.
                    </span>{' '}
                    The pad, its quote assets and the SAI sink are live today —
                    the treasury components below are not deployed yet. Every
                    section is marked{' '}
                    <span className="font-semibold text-emerald-400">Live</span>{' '}
                    or{' '}
                    <span className="font-semibold text-white/60">Planned</span>{' '}
                    so you can tell which is which.
                </p>
            </div>

            {/* ---- the two tokens ---- */}
            <section>
                <SectionHeader
                    eyebrow="The two tokens"
                    title="What each one is for"
                    sub="Both were trying to be the same thing. The pad use case splits them cleanly."
                />
                <div className="grid gap-4 md:grid-cols-2">
                    {TOKENS.map((t) => (
                        <div
                            key={t.symbol}
                            className={`${PANEL} overflow-hidden p-5`}
                        >
                            <div
                                className="-mx-5 -mt-5 mb-4 h-1"
                                style={{ background: t.color }}
                            />
                            <div className="flex items-baseline gap-2">
                                <span
                                    className="font-magic text-2xl font-semibold"
                                    style={{ color: t.color }}
                                >
                                    {t.symbol}
                                </span>
                                <span className="text-sm text-white/40">
                                    {t.name}
                                </span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                                {t.role}
                            </div>

                            {t.body.map((p) => (
                                <p
                                    key={p.slice(0, 24)}
                                    className="mt-3 font-sans text-sm leading-relaxed text-white/55"
                                >
                                    {p}
                                </p>
                            ))}

                            <dl className="mt-4 divide-y divide-white/8 border-t border-white/8">
                                {t.facts.map((f) => (
                                    <div
                                        key={f.label}
                                        className="flex items-center justify-between gap-3 py-2"
                                    >
                                        <dt className="text-xs uppercase tracking-wide text-white/40">
                                            {f.label}
                                        </dt>
                                        <dd className="text-sm font-semibold tabular-nums text-white">
                                            {f.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ))}
                </div>
            </section>

            {/* ---- the loop ---- */}
            <section>
                <SectionHeader
                    eyebrow="The engine"
                    title="How the loop turns"
                    sub="Every launch drives both sinks at once. Neither needs new emissions to run."
                />

                <div className="grid gap-3 md:grid-cols-4">
                    {LOOP.map((s, i) => (
                        <div
                            key={s.step}
                            className={`${PANEL} relative flex flex-col p-4`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-trippyYellow">
                                    {i + 1}. {s.step}
                                </span>
                                <StatusBadge status={s.status} />
                            </div>
                            <div className="mt-2 text-sm font-semibold leading-snug text-white">
                                {s.title}
                            </div>
                            <p className="mt-2 font-sans text-xs leading-relaxed text-white/50">
                                {s.detail}
                            </p>
                        </div>
                    ))}
                </div>

                <p className="mt-3 text-center font-sans text-xs text-white/40">
                    ↻ …and a deeper, more active ecosystem attracts the next
                    launch. Emissions bootstrap the loop; they are not the loop.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {SINKS.map((s) => (
                        <Panel key={s.label}>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                                    {s.label}
                                </span>
                                <StatusBadge status={s.status} />
                            </div>
                            <div className="mt-1 font-magic text-2xl text-trippyYellow">
                                {s.headline}
                            </div>
                            <p className="mt-2 font-sans text-sm leading-relaxed text-white/55">
                                {s.body}
                            </p>
                        </Panel>
                    ))}
                </div>
            </section>

            {/* ---- SAI supply ---- */}
            <section>
                <SectionHeader
                    eyebrow="SAI supply"
                    title={`Where all ${num(SAI_MAX_SUPPLY)} SAI sits`}
                    sub="Nothing is hidden and nothing unlocks on a cliff."
                />

                <Panel>
                    <div className="flex h-4 w-full overflow-hidden rounded-full">
                        {SUPPLY.map((s) => (
                            <span
                                key={s.name}
                                title={`${s.name} — ${num(s.sai)} SAI (${s.pct}%)`}
                                style={{
                                    width: `${s.pct}%`,
                                    background: s.color,
                                }}
                            />
                        ))}
                    </div>

                    <ul className="mt-4 divide-y divide-white/8">
                        {SUPPLY.map((s) => (
                            <li
                                key={s.name}
                                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4"
                            >
                                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                    <span
                                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ background: s.color }}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-white">
                                                {s.name}
                                            </span>
                                            <StatusBadge status={s.status} />
                                        </div>
                                        <p className="mt-0.5 font-sans text-xs leading-relaxed text-white/45">
                                            {s.desc}
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0 text-sm font-semibold tabular-nums text-white sm:text-right">
                                    {num(s.sai)}{' '}
                                    <span className="text-white/40">
                                        {s.pct}%
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-3 max-w-2xl font-sans text-xs leading-relaxed text-white/40">
                        Ordered by availability — brightest is liquid and in the
                        market today, darkest is locked longest. The ask ladder
                        is the only path from treasury to circulating, and it
                        opens one band at a time as the price rises.
                    </p>
                </Panel>

                <Panel className="mt-4">
                    <h3 className="text-base font-semibold text-white">
                        Why nothing is burned
                    </h3>
                    <p className="mt-2 font-sans text-sm leading-relaxed text-white/60">
                        Burning treasury SAI would cut FDV on paper and change
                        nothing real — circulating supply, market cap and
                        liquidity all stay exactly where they are, because
                        treasury SAI was never in the market to begin with.
                        <span className="text-white">
                            {' '}
                            SAI supply comes down when the pad is used, not when
                            we publish a transaction hash:
                        </span>{' '}
                        every SAI-quoted graduation locks 10,000 SAI into a
                        permanent pool, which is 3.2% of circulating float per
                        launch.
                    </p>
                    <p className="mt-3 font-sans text-sm leading-relaxed text-white/60">
                        The same 150,000 SAI burned from treasury removes{' '}
                        <span className="font-semibold text-white">0%</span> of
                        float and creates zero markets. Spent underwriting 15
                        graduations it removes{' '}
                        <span className="font-semibold text-white">
                            48% of circulating float
                        </span>{' '}
                        and creates 15 markets. They are not the same action
                        wearing different labels.
                    </p>
                </Panel>
            </section>

            {/* ---- quote assets + rails ---- */}
            <section>
                <SectionHeader
                    eyebrow="The rails"
                    title="Getting SAI, and what each quote asset is for"
                    sub="Three quote assets, not competing options — the fee split says which does what."
                />

                <Panel className="overflow-x-auto">
                    <table className="w-full min-w-lg text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/40">
                                <th className="pb-2 pr-3 font-medium">Quote</th>
                                <th className="pb-2 pr-3 font-medium">
                                    Purpose
                                </th>
                                <th className="pb-2 pr-3 text-right font-medium">
                                    Creator
                                </th>
                                <th className="pb-2 pr-3 text-right font-medium">
                                    Platform
                                </th>
                                <th className="pb-2 text-right font-medium">
                                    Graduates at
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                            {QUOTES.map((q) => (
                                <tr key={q.symbol}>
                                    <td className="py-3 pr-3">
                                        <span
                                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                                q.highlight
                                                    ? 'bg-emerald-400/15 text-emerald-400'
                                                    : 'bg-white/8 text-white/70'
                                            }`}
                                        >
                                            {q.symbol}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-3 font-sans text-white/55">
                                        {q.purpose}
                                    </td>
                                    <td className="py-3 pr-3 text-right font-semibold tabular-nums text-white">
                                        {q.creator}
                                    </td>
                                    <td className="py-3 pr-3 text-right font-semibold tabular-nums text-white">
                                        {q.platform}
                                    </td>
                                    <td className="py-3 text-right font-semibold tabular-nums text-white">
                                        {q.graduates}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {RAILS.map((r) => (
                        <Panel key={r.pair}>
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-base font-semibold text-white">
                                    {r.pair}
                                </h3>
                                <StatusBadge status={r.status} />
                            </div>
                            <p className="mt-2 font-sans text-sm leading-relaxed text-white/55">
                                {r.body}
                            </p>
                        </Panel>
                    ))}
                </div>
            </section>

            {/* ---- earning ---- */}
            <section>
                <SectionHeader
                    eyebrow="Earning"
                    title="Ways to be paid in SAI"
                    sub="105,000 SAI in rewards — farms and quests on a decaying six-month schedule, plus two airdrops."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    {EARN.map((e) => (
                        <Panel key={`${e.label}-${e.figure}`}>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                                    {e.label}
                                </span>
                                <StatusBadge status={e.status} />
                            </div>
                            <div className="mt-1 font-magic text-3xl text-trippyYellow">
                                {e.figure}
                            </div>
                            <div className="text-xs text-white/40">{e.unit}</div>
                            <p className="mt-2 font-sans text-sm leading-relaxed text-white/55">
                                {e.body}
                            </p>
                        </Panel>
                    ))}
                </div>
            </section>

            {/* ---- rollout ---- */}
            <section>
                <SectionHeader
                    eyebrow="Sequencing"
                    title="The order things ship in"
                    sub="Ordered by how each component relates to the ladder — not by size."
                />
                <Panel>
                    <ol className="divide-y divide-white/8">
                        {ROLLOUT.map((r) => (
                            <li
                                key={r.what}
                                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-5"
                            >
                                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-trippyYellow">
                                    {r.when}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-white">
                                            {r.what}
                                        </span>
                                        <StatusBadge status={r.status} />
                                    </div>
                                    <p className="mt-0.5 font-sans text-xs leading-relaxed text-white/45">
                                        {r.why}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Panel>
            </section>

            {/* ---- where to go next ---- */}
            <section className="grid gap-4 sm:grid-cols-2">
                <Link
                    to="/shroom-hub"
                    className={`${PANEL} group flex items-center justify-between gap-3 p-5 transition hover:border-trippyYellow/40`}
                >
                    <div>
                        <div className="text-sm font-semibold text-white">
                            Live numbers
                        </div>
                        <p className="mt-1 font-sans text-xs text-white/50">
                            Prices, liquidity, holders and burns as they stand
                            right now.
                        </p>
                    </div>
                    <FaArrowRight className="shrink-0 text-trippyYellow transition group-hover:translate-x-1" />
                </Link>
                <a
                    href="https://pump.trippyinj.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${PANEL} group flex items-center justify-between gap-3 p-5 transition hover:border-trippyYellow/40`}
                >
                    <div>
                        <div className="text-sm font-semibold text-white">
                            Launch on SHROOM Pad
                        </div>
                        <p className="mt-1 font-sans text-xs text-white/50">
                            The SAI sink only turns when someone launches
                            something.
                        </p>
                    </div>
                    <FaExternalLinkAlt className="shrink-0 text-xs text-trippyYellow" />
                </a>
            </section>

            <p className="max-w-3xl font-sans text-xs leading-relaxed text-white/35">
                Opening APRs are calculated against liquidity at the time of
                writing and fall as capital arrives — they are a starting point,
                not a promise. Fee splits and graduation targets reflect live
                on-chain configuration; supply figures are a snapshot taken{' '}
                {PLAN_DATE}. This page describes a target design that ships in
                sequence and is not all live yet. Nothing here is financial
                advice.
            </p>
        </div>
        <Footer />
    </div>
);

export default Tokenomics;
