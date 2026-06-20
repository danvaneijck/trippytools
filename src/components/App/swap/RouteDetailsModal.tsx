import { useEffect, useMemo } from 'react';
import { FaArrowRight } from 'react-icons/fa';
import IPFSImage from '../IpfsImage';
import useTokenStore from '../../../store/useTokenStore';
import useSwapPoolStore from '../../../store/useSwapPoolStore';
import { getAssetId, hopVenueLabel } from '../../../utils/swap/messages';
import { CW20_ADAPTER_ADDRESS } from '../../../utils/swap/constants';
import type { HopV2, SimulatedRouteV2, Token, TokenInfo } from '../../../utils/swap/types';

interface Props {
  open: boolean;
  onClose: () => void;
  route: SimulatedRouteV2 | null;
  inputToken?: Token;
  outputToken?: Token;
}

// One drawn edge: from-token → venue → to-token.
interface Segment {
  from: TokenInfo;
  to: TokenInfo;
  label: string;
}

// Per-venue badge styling, resolved from the (dynamic) venue label.
const venueStyle = (label: string): string => {
  if (label.includes('CLMM')) return 'text-cyan-300 border-cyan-400/40 bg-cyan-400/5';
  if (label.includes('Choice')) return 'text-trippyYellow border-trippyYellow/40 bg-trippyYellow/5';
  if (label.includes('Dojo')) return 'text-rose-300 border-rose-400/40 bg-rose-400/5';
  if (label.includes('Astro')) return 'text-sky-300 border-sky-400/40 bg-sky-400/5';
  if (label.includes('Orderbook') || label.includes('Helix')) return 'text-violet-300 border-violet-400/40 bg-violet-400/5';
  return 'text-stone-300 border-white/20 bg-white/5';
};

const fmt = (n: number): string => {
  if (!n || Number.isNaN(n)) return '0';
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 5 });
};

const RouteDetailsModal = ({ open, onClose, route, inputToken, outputToken }: Props) => {
  const allTokens = useTokenStore((s) => s.tokens);
  const swapPools = useSwapPoolStore((s) => s.swapPools);

  // pool address → DEX name, so AMM hops show their real venue (DojoSwap, …).
  const poolVenueByAddr = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of swapPools) if (p.venue) m.set(p.contract_addr, p.venue);
    return m;
  }, [swapPools]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  if (!open || !route || route.simulatedStages.length === 0) return null;

  // Token chip from an asset_info. Defensive: a malformed asset_info never
  // throws out of render — it degrades to a short placeholder.
  const tokenFor = (info: TokenInfo): { symbol: string; icon?: string } => {
    let id: string;
    try {
      id = getAssetId(info).replace(`factory/${CW20_ADAPTER_ADDRESS}/`, '');
    } catch {
      return { symbol: '?' };
    }
    const t = allTokens.find((x) => x.address === id);
    if (t) return { symbol: t.symbol, icon: t.icon };
    const tail = id.split('/').pop() ?? id;
    return { symbol: tail.length > 12 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail };
  };

  // Flatten a split's hops into drawn segments. A multi-market orderbook hop
  // (ob_market_ops.length > 1) is expanded into one segment per Helix market so
  // every intermediate denom shows — mirroring what the aggregator executes.
  const buildSegments = (path: HopV2[]): Segment[] => {
    const segs: Segment[] = [];
    for (const hop of path) {
      const ob = hop.orderbook_swap;
      if (ob?.ob_market_ops && ob.ob_market_ops.length > 1) {
        let from: TokenInfo = ob.offer_asset_info;
        for (const op of ob.ob_market_ops) {
          const to: TokenInfo = { native_token: { denom: op.target_denom } };
          segs.push({ from, to, label: 'Helix Orderbook' });
          from = to;
        }
        continue;
      }
      const payload = hop.amm_swap || hop.clmm_swap || hop.orderbook_swap;
      if (!payload) continue; // malformed hop (unreachable in practice) — skip
      segs.push({
        from: payload.offer_asset_info,
        to: payload.ask_asset_info,
        label: hopVenueLabel(hop, poolVenueByAddr),
      });
    }
    return segs;
  };

  const TokenChip = ({ info }: { info: TokenInfo }) => {
    const { symbol, icon } = tokenFor(info);
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
        {icon ? (
          <IPFSImage className="h-5 w-5 rounded-full" width={20} ipfsPath={icon} />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px]">
            {symbol[0] ?? '?'}
          </div>
        )}
        <span className="text-sm font-medium">{symbol}</span>
      </div>
    );
  };

  const VenueBadge = ({ label }: { label: string }) => (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${venueStyle(label)}`}>
      {label}
    </span>
  );

  const inAmount = route.amountIn.toNumber();
  const outAmount = route.finalQuote.toNumber();
  const multiStage = route.simulatedStages.length > 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-customGray p-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-magic text-xl">Swap route</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Totals */}
        <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <span className="font-semibold">
            {fmt(inAmount)} {inputToken?.symbol}
          </span>
          <FaArrowRight className="text-stone-500" size={12} />
          <span className="font-semibold text-trippyYellow">
            {fmt(outAmount)} {outputToken?.symbol}
          </span>
        </div>

        {/* Stages */}
        <div className="space-y-4">
          {route.simulatedStages.map((stage, si) => (
            <div key={si}>
              {multiStage && (
                <div className="mb-2 text-[11px] uppercase tracking-wide text-stone-400">Step {si + 1}</div>
              )}
              <div className="space-y-2">
                {stage.splits.map((split, spi) => {
                  const segments = buildSegments(split.path);
                  if (!segments.length) return null;
                  const chips: TokenInfo[] = [segments[0].from, ...segments.map((s) => s.to)];
                  return (
                    <div key={spi} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      {(stage.splits.length > 1 || split.percent < 100) && (
                        <div className="mb-2 text-xs text-stone-400">
                          <span className="rounded-md bg-white/10 px-2 py-0.5 font-semibold text-white">
                            {split.percent}%
                          </span>{' '}
                          of this step
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {chips.map((info, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <TokenChip info={info} />
                            {i < segments.length && (
                              <>
                                <VenueBadge label={segments[i].label} />
                                <FaArrowRight className="text-stone-600" size={10} />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-[10px] text-stone-500">
          Best route selected by Choice Exchange aggregation across {route.simulatedStages.length}{' '}
          {route.simulatedStages.length === 1 ? 'step' : 'steps'}
        </div>
      </div>
    </div>
  );
};

export default RouteDetailsModal;
