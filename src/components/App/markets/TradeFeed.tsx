import { useEffect, useState } from 'react';
import type { FeedTrade } from './types';
import { formatAmount, formatPrice, formatUsd, shortAddr, timeAgo } from './format';
import { UP, DOWN } from './CandleChart';

interface TradeFeedProps {
    trades: FeedTrade[];
    loading: boolean;
    showVenue: boolean; // show the venue/pair column (all-markets mode)
}

const TradeFeed = ({ trades, loading, showVenue }: TradeFeedProps) => {
    // Re-render once a second so the relative timestamps stay fresh.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div className="overflow-hidden rounded-xl border border-white/10">
            <div
                className={`grid ${
                    showVenue ? 'grid-cols-[3.5rem_1fr_1fr_1fr_3rem]' : 'grid-cols-[3.5rem_1fr_1fr_3rem]'
                } gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wide text-white/50`}
            >
                <div>Time</div>
                {showVenue && <div>Market</div>}
                <div className="text-right">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Trader</div>
            </div>

            <div className="max-h-[360px] overflow-y-auto">
                {loading && !trades.length ? (
                    <div className="px-3 py-8 text-center text-sm text-white/50">
                        Loading trades…
                    </div>
                ) : !trades.length ? (
                    <div className="px-3 py-8 text-center text-sm text-white/50">
                        No trades yet.
                    </div>
                ) : (
                    trades.map((t) => {
                        const color = t.side === 'buy' ? UP : DOWN;
                        return (
                            <div
                                key={t.id}
                                className={`grid ${
                                    showVenue
                                        ? 'grid-cols-[3.5rem_1fr_1fr_1fr_3rem]'
                                        : 'grid-cols-[3.5rem_1fr_1fr_3rem]'
                                } items-center gap-2 border-b border-white/5 px-3 py-1.5 text-xs hover:bg-white/5`}
                            >
                                <div className="text-white/50">{timeAgo(t.time, now)}</div>
                                {showVenue && (
                                    <div className="truncate">
                                        <span className="text-white/80">{t.pair}</span>
                                        <span className="ml-1 text-[10px] text-white/40">
                                            {t.venue}
                                        </span>
                                    </div>
                                )}
                                <div className="text-right" style={{ color }}>
                                    {t.priceUsd != null ? `$${formatPrice(t.priceUsd)}` : '—'}
                                </div>
                                <div className="text-right text-white/80">
                                    <span style={{ color }}>{t.side === 'buy' ? '+' : '-'}</span>
                                    {formatAmount(t.amountBase)} {t.baseSymbol}
                                    {t.valueUsd != null && (
                                        <span className="ml-1 text-white/40">
                                            ({formatUsd(t.valueUsd)})
                                        </span>
                                    )}
                                </div>
                                <div className="truncate text-right text-white/40">
                                    {t.tx ? (
                                        <a
                                            href={`https://explorer.injective.network/transaction/${t.tx}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-white"
                                            title={t.trader ?? undefined}
                                        >
                                            {shortAddr(t.trader)}
                                        </a>
                                    ) : (
                                        shortAddr(t.trader)
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TradeFeed;
