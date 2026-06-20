import { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatUsd } from '../../components/App/markets/format';
import { SectionHeader } from './ui';
import { PANEL, TOGGLE_WRAP, toggleBtn } from './styles';
import {
    byPair,
    byToken,
    byVenue,
    type PoolLiq,
    TOKEN_COLORS,
    totalTvl,
    venueColor,
    venuesOf,
} from './ecosystem';

type Mode = 'pair' | 'venue' | 'token';

const MODES: { key: Mode; label: string }[] = [
    { key: 'pair', label: 'By pair' },
    { key: 'venue', label: 'By venue' },
    { key: 'token', label: 'By token' },
];

const pct = (v: number, total: number) =>
    total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—';

// Shared dark tooltip for every chart.
interface TipRow {
    name: string;
    value: number;
    color?: string;
}
const ChartTip = ({
    active,
    payload,
    label,
    total,
}: {
    active?: boolean;
    payload?: { name?: string; value?: number; color?: string; fill?: string }[];
    label?: string;
    total: number;
}) => {
    if (!active || !payload?.length) return null;
    const rows: TipRow[] = payload
        .filter((p) => Number(p.value) > 0)
        .map((p) => ({
            name: String(p.name),
            value: Number(p.value),
            color: p.color ?? p.fill,
        }));
    if (!rows.length) return null;
    return (
        <div className="rounded-lg border border-white/15 bg-[#04181f] px-3 py-2 text-xs shadow-xl">
            {label && <div className="mb-1 font-semibold text-white">{label}</div>}
            {rows.map((r) => (
                <div key={r.name} className="flex items-center gap-2 text-white/80">
                    {r.color && (
                        <span
                            className="inline-block h-2 w-2 rounded-sm"
                            style={{ background: r.color }}
                        />
                    )}
                    <span className="mr-2">{r.name}</span>
                    <span className="ml-auto text-white">{formatUsd(r.value)}</span>
                    <span className="w-12 text-right text-white/40">
                        {pct(r.value, total)}
                    </span>
                </div>
            ))}
        </div>
    );
};

const LiquidityBreakdown = ({
    pools,
    loading,
}: {
    pools: PoolLiq[];
    loading: boolean;
}) => {
    const [mode, setMode] = useState<Mode>('pair');

    const total = useMemo(() => totalTvl(pools), [pools]);
    const venues = useMemo(() => venuesOf(pools), [pools]);
    const pairRows = useMemo(() => byPair(pools), [pools]);
    const venueRows = useMemo(() => byVenue(pools), [pools]);
    const tokenRows = useMemo(() => byToken(pools), [pools]);
    const tableRows = useMemo(
        () => [...pools].sort((a, b) => b.tvlUsd - a.tvlUsd),
        [pools],
    );

    const chartH = 'h-72 md:h-80';

    return (
        <section className={`${PANEL} p-4 md:p-6`}>
            <SectionHeader
                eyebrow="Liquidity"
                title="Liquidity sources"
                sub={`${formatUsd(total)} across ${pools.length} pools`}
            >
                <div className={TOGGLE_WRAP}>
                    {MODES.map((m) => (
                        <button
                            key={m.key}
                            onClick={() => setMode(m.key)}
                            className={toggleBtn(mode === m.key)}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </SectionHeader>

            <div className={`w-full ${chartH}`}>
                {loading && !pools.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-white/50">
                        Loading liquidity…
                    </div>
                ) : !pools.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-white/50">
                        No liquidity found.
                    </div>
                ) : mode === 'pair' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={pairRows}
                            margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                        >
                            <XAxis
                                type="number"
                                tickFormatter={(v) => formatUsd(Number(v))}
                                tick={{ fill: '#ffffff80', fontSize: 11 }}
                                axisLine={{ stroke: '#ffffff20' }}
                                tickLine={false}
                            />
                            <YAxis
                                type="category"
                                dataKey="pair"
                                width={90}
                                tick={{ fill: '#ffffffcc', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#ffffff08' }}
                                content={<ChartTip total={total} />}
                            />
                            {venues.map((v) => (
                                <Bar
                                    key={v}
                                    dataKey={v}
                                    stackId="tvl"
                                    fill={venueColor(v)}
                                    radius={[2, 2, 2, 2]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : mode === 'venue' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={venueRows}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="55%"
                                outerRadius="80%"
                                paddingAngle={2}
                                stroke="#04181f"
                            >
                                {venueRows.map((r) => (
                                    <Cell key={r.name} fill={venueColor(r.name)} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTip total={total} />} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={tokenRows}
                            margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                        >
                            <XAxis
                                type="number"
                                tickFormatter={(v) => formatUsd(Number(v))}
                                tick={{ fill: '#ffffff80', fontSize: 11 }}
                                axisLine={{ stroke: '#ffffff20' }}
                                tickLine={false}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={90}
                                tick={{ fill: '#ffffffcc', fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#ffffff08' }}
                                content={<ChartTip total={total} />}
                            />
                            <Bar dataKey="value" radius={[2, 2, 2, 2]}>
                                {tokenRows.map((r) => (
                                    <Cell
                                        key={r.name}
                                        fill={TOKEN_COLORS[r.name] ?? '#94a3b8'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* venue legend (shared reference for the stacked-bar / pie views) */}
            {mode !== 'token' && venues.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {venues.map((v) => (
                        <span
                            key={v}
                            className="flex items-center gap-1.5 text-xs text-white/70"
                        >
                            <span
                                className="inline-block h-2.5 w-2.5 rounded-sm"
                                style={{ background: venueColor(v) }}
                            />
                            {v}
                        </span>
                    ))}
                </div>
            )}

            {/* backing table — every source pool */}
            {pools.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                                <th className="py-2 pr-3 font-medium">Pair</th>
                                <th className="py-2 pr-3 font-medium">Venue</th>
                                <th className="py-2 pr-3 text-right font-medium">TVL</th>
                                <th className="py-2 pr-3 text-right font-medium">Share</th>
                                <th className="py-2 text-right font-medium">24h vol</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((p) => (
                                <tr
                                    key={`${p.venue}-${p.id}`}
                                    className="border-b border-white/5 text-white/80"
                                >
                                    <td className="py-2 pr-3 text-white">{p.pair}</td>
                                    <td className="py-2 pr-3">
                                        <span className="flex items-center gap-1.5">
                                            <span
                                                className="inline-block h-2 w-2 rounded-sm"
                                                style={{ background: venueColor(p.venue) }}
                                            />
                                            {p.venue}
                                        </span>
                                    </td>
                                    <td className="py-2 pr-3 text-right text-white">
                                        {formatUsd(p.tvlUsd)}
                                    </td>
                                    <td className="py-2 pr-3 text-right text-white/50">
                                        {pct(p.tvlUsd, total)}
                                    </td>
                                    <td className="py-2 text-right text-white/50">
                                        {p.vol24hUsd != null ? formatUsd(p.vol24hUsd) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-semibold text-white">
                                <td className="py-2 pr-3" colSpan={2}>
                                    Total
                                </td>
                                <td className="py-2 pr-3 text-right">{formatUsd(total)}</td>
                                <td className="py-2 pr-3 text-right text-white/50">100%</td>
                                <td className="py-2" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
};

export default LiquidityBreakdown;
