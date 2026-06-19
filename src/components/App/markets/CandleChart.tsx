import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { Candle, Denom } from './types';
import { formatPrice } from './format';

export const UP = '#16c784';
export const DOWN = '#ea3943';

// Custom candlestick. The Bar's dataKey is `highLow` ([low, high]) so recharts
// gives us the pixel span of the wick directly; we derive the body from it.
interface CandleShapeProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: Candle;
}

const Candlestick = (props: CandleShapeProps) => {
    const { x, y, width, height, payload } = props;
    if (
        x === undefined ||
        y === undefined ||
        width === undefined ||
        height === undefined ||
        !payload
    ) {
        return null;
    }

    const { open, high, low, close } = payload;
    const up = close >= open;
    const color = up ? UP : DOWN;

    const span = high - low;
    const ratio = span > 0 ? height / span : 0;

    const centerX = x + width / 2;
    const bodyW = Math.max(width * 0.7, 1);
    const bodyX = centerX - bodyW / 2;

    const topPrice = Math.max(open, close);
    const botPrice = Math.min(open, close);
    const bodyY = ratio ? y + (high - topPrice) * ratio : y + height / 2;
    const bodyH = Math.max(ratio ? (topPrice - botPrice) * ratio : 0, 1);

    return (
        <g stroke={color} fill={color}>
            <line x1={centerX} y1={y} x2={centerX} y2={y + height} strokeWidth={1} />
            <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} />
        </g>
    );
};

interface TooltipProps {
    active?: boolean;
    payload?: { payload: Candle }[];
    denom: Denom;
    quoteSymbol: string;
}

const CandleTooltip = ({ active, payload, denom, quoteSymbol }: TooltipProps) => {
    if (!active || !payload || !payload.length) return null;
    const c = payload[0].payload;
    const fmt = (v: number) =>
        denom === 'USD' ? `$${formatPrice(v)}` : `${formatPrice(v)} ${quoteSymbol}`;
    const up = c.close >= c.open;
    return (
        <div className="rounded-md border border-white/10 bg-black/90 px-3 py-2 text-xs font-sans text-white">
            <div className="mb-1 text-white/60">{c.label}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span className="text-white/60">O</span>
                <span className="text-right">{fmt(c.open)}</span>
                <span className="text-white/60">H</span>
                <span className="text-right">{fmt(c.high)}</span>
                <span className="text-white/60">L</span>
                <span className="text-right">{fmt(c.low)}</span>
                <span className="text-white/60">C</span>
                <span className="text-right" style={{ color: up ? UP : DOWN }}>
                    {fmt(c.close)}
                </span>
            </div>
        </div>
    );
};

interface CandleChartProps {
    candles: Candle[];
    denom: Denom;
    quoteSymbol: string;
}

const CandleChart = ({ candles, denom, quoteSymbol }: CandleChartProps) => (
    <ResponsiveContainer width="100%" height="100%">
        <BarChart data={candles} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
            <XAxis
                dataKey="label"
                tick={{ fill: '#ffffff80', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#ffffff20' }}
                minTickGap={40}
            />
            <YAxis
                orientation="right"
                domain={['dataMin', 'dataMax']}
                tick={{ fill: '#ffffff80', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(v: number) => formatPrice(v)}
            />
            <Tooltip
                content={<CandleTooltip denom={denom} quoteSymbol={quoteSymbol} />}
                cursor={{ fill: '#ffffff0a' }}
            />
            <Bar
                dataKey="highLow"
                shape={<Candlestick />}
                isAnimationActive={false}
                maxBarSize={18}
            />
        </BarChart>
    </ResponsiveContainer>
);

export default CandleChart;
