import { useMemo, useState } from 'react';
import { FaArrowDown, FaCog, FaSyncAlt, FaExternalLinkAlt } from 'react-icons/fa';
import IPFSImage from '../IpfsImage';
import { formatNumber } from '../../../utils/helpers';
import SwapDataInit from './SwapDataInit';
import TokenSelectModal from './TokenSelectModal';
import RouteDetailsModal from './RouteDetailsModal';
import { useShroomSwap } from './useShroomSwap';
import useSwapPoolStore from '../../../store/useSwapPoolStore';
import { SLIPPAGE_PRESETS, choiceSwapUrl } from '../../../utils/swap/constants';
import { routeHopCount, routeVenueLabels } from '../../../utils/swap/messages';
import type { Token } from '../../../utils/swap/types';

const fmtAmount = (n: number): string => {
  if (!n || Number.isNaN(n)) return '0.0';
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 6 });
};

const TokenPill = ({ token, onClick }: { token?: Token; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1.5 pl-1.5 pr-3 transition-colors hover:bg-white/[0.12]"
  >
    {token?.icon ? (
      <IPFSImage className="h-6 w-6 rounded-full" width={24} ipfsPath={token.icon} />
    ) : (
      <div className="h-6 w-6 rounded-full bg-white/10" />
    )}
    <span className="text-sm font-semibold">{token?.symbol ?? 'Select'}</span>
    <span className="text-[10px] text-stone-400">▼</span>
  </button>
);

const SwapWidget = () => {
  const s = useShroomSwap();
  const swapPools = useSwapPoolStore((st) => st.swapPools);
  const [picker, setPicker] = useState<null | 'input' | 'output'>(null);
  const [showSlippage, setShowSlippage] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  const poolVenueByAddr = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of swapPools) if (p.venue) m.set(p.contract_addr, p.venue);
    return m;
  }, [swapPools]);

  const price = s.outputAmount > 0 && Number(s.inputAmount) > 0 ? Number(s.inputAmount) / s.outputAmount : 0;
  const venues = s.calculatedRoute ? routeVenueLabels(s.calculatedRoute, poolVenueByAddr) : [];
  const hops = s.calculatedRoute ? routeHopCount(s.calculatedRoute) : 0;

  const actionDisabled = !s.canSwap || s.swapping;
  const actionLabel = s.swapping ? 'Swapping…' : s.actionState;

  return (
    <div className="w-full max-w-md font-sans">
      <SwapDataInit />

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-white shadow-2xl backdrop-blur">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-magic text-2xl">Swap</h2>
          <div className="flex items-center gap-2 text-stone-400">
            <button
              onClick={s.refresh}
              title="Refresh"
              className="rounded-md p-2 hover:bg-white/10 hover:text-white"
            >
              <FaSyncAlt className={s.isQuoting ? 'animate-spin' : ''} size={13} />
            </button>
            <button
              onClick={() => setShowSlippage((v) => !v)}
              title="Slippage"
              className="rounded-md p-2 hover:bg-white/10 hover:text-white"
            >
              <FaCog size={14} />
            </button>
          </div>
        </div>

        {/* Slippage popover */}
        {showSlippage && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-stone-400">Slippage tolerance</div>
            <div className="flex flex-wrap items-center gap-2">
              {SLIPPAGE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => s.setSlippage(p)}
                  className={`rounded-md px-3 py-1 text-sm ${
                    s.slippage === p ? 'bg-trippyYellow text-black' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {p}%
                </button>
              ))}
              <div className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1">
                <input
                  type="number"
                  value={s.slippage}
                  min={0}
                  step={0.1}
                  onChange={(e) => s.setSlippage(Math.max(0, Number(e.target.value)))}
                  className="w-14 bg-transparent text-right text-sm outline-none"
                />
                <span className="text-sm text-stone-400">%</span>
              </div>
            </div>
          </div>
        )}

        {/* You pay */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-stone-400">
            <span>You pay</span>
            {s.connectedWallet && s.inputToken && (
              <span className="flex items-center gap-2 normal-case">
                <span>Bal: {formatNumber(s.inputBalance)}</span>
                <button onClick={s.onHalf} className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20">
                  50%
                </button>
                <button onClick={s.onMax} className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20">
                  Max
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={s.inputAmount}
              onChange={s.onAmountChange}
              inputMode="decimal"
              placeholder="0.0"
              className="w-full bg-transparent text-3xl font-light tracking-tight outline-none placeholder:text-stone-600"
            />
            <TokenPill token={s.inputToken} onClick={() => setPicker('input')} />
          </div>
          <div className="mt-1 text-xs text-stone-400">≈ ${formatNumber(s.inputUsd)}</div>
        </div>

        {/* Flip */}
        <div className="relative z-10 my-[-10px] flex justify-center">
          <button
            onClick={s.flip}
            className="rounded-lg border border-white/10 bg-customGray p-2 text-stone-300 transition-colors hover:text-trippyYellow"
            title="Flip"
          >
            <FaArrowDown size={14} />
          </button>
        </div>

        {/* You receive */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-stone-400">
            <span>You receive</span>
            {s.connectedWallet && s.outputToken && <span className="normal-case">Bal: {formatNumber(s.outputBalance)}</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div
              className={`w-full truncate text-3xl font-light tracking-tight ${
                s.outputAmount > 0 ? 'text-white' : 'text-stone-600'
              }`}
            >
              {s.isQuoting ? '…' : fmtAmount(s.outputAmount)}
            </div>
            <TokenPill token={s.outputToken} onClick={() => setPicker('output')} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
            <span>≈ ${formatNumber(s.outputUsd)}</span>
            {s.outputDifference !== null && (
              <span className={s.outputDifference >= 0 ? 'text-green-400' : 'text-red-400'}>
                ({s.outputDifference >= 0 ? '+' : ''}
                {formatNumber(s.outputDifference)}%)
              </span>
            )}
          </div>
        </div>

        {/* Route / quote details */}
        {s.calculatedRoute && s.outputAmount > 0 && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-400">Rate</span>
              <span>
                1 {s.outputToken?.symbol} ≈ {fmtAmount(price)} {s.inputToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Minimum received</span>
              <span>
                {fmtAmount(s.minimumReceive ?? 0)} {s.outputToken?.symbol}
              </span>
            </div>
            <button
              onClick={() => setShowRoute(true)}
              className="flex w-full items-center justify-between hover:text-trippyYellow"
            >
              <span className="text-stone-400">Route</span>
              <span className="flex items-center gap-1.5">
                {venues.join(' + ') || '—'}
                {hops > 1 ? ` · ${hops} hops` : ''}
                <span className="text-trippyYellow underline">view</span>
              </span>
            </button>
            <div className="flex justify-between">
              <span className="text-stone-400">Slippage</span>
              <span>{s.slippage}%</span>
            </div>
          </div>
        )}

        {/* Action */}
        <button
          onClick={() => void s.performSwap()}
          disabled={actionDisabled}
          className={`mt-3 w-full rounded-xl py-3 text-base font-semibold transition-colors ${
            actionDisabled
              ? 'cursor-not-allowed bg-white/10 text-stone-400'
              : 'bg-trippyYellow text-black hover:brightness-110'
          }`}
        >
          {actionLabel}
        </button>

        {/* Secondary link */}
        <a
          href={
            s.inputToken && s.outputToken
              ? choiceSwapUrl(s.inputToken.address, s.outputToken.address)
              : 'https://choice.exchange/swap'
          }
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 text-xs text-stone-400 hover:text-trippyYellow"
        >
          Advanced — open on Choice Exchange <FaExternalLinkAlt size={10} />
        </a>
        <div className="mt-2 text-center text-[10px] text-stone-500">
          Routing &amp; aggregation powered by Choice Exchange
        </div>
      </div>

      <TokenSelectModal
        open={picker !== null}
        onClose={() => setPicker(null)}
        tokens={s.tokens}
        excludeAddress={picker === 'input' ? s.outputToken?.address : s.inputToken?.address}
        onSelect={(t) => (picker === 'input' ? s.setInputToken(t) : s.setOutputToken(t))}
      />

      <RouteDetailsModal
        open={showRoute}
        onClose={() => setShowRoute(false)}
        route={s.calculatedRoute}
        inputToken={s.inputToken}
        outputToken={s.outputToken}
      />
    </div>
  );
};

export default SwapWidget;
