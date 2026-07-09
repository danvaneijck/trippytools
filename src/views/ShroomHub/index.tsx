import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { MsgExecuteContractCompat } from '@injectivelabs/sdk-ts';
import { INJ_DENOM } from '@injectivelabs/utils';
import { toast, ToastContainer } from 'react-toastify';
import { SiConvertio } from 'react-icons/si';
import { FiRefreshCw, FiUsers } from 'react-icons/fi';
import { ClipLoader } from 'react-spinners';

import TokenUtils from '../../modules/tokenUtils';
import Footer from '../../components/App/Footer';
import ShroomMarkets from '../../components/App/markets';
import {
    formatAmount,
    formatPrice,
    formatUsd,
    shortAddr,
    timeAgo,
} from '../../components/App/markets/format';
import { humanReadableAmount } from '../../utils/helpers';
import { performTransaction } from '../../utils/walletStrategy';
import choiceClient from '../../utils/choiceApolloClient';
import useWalletStore from '../../store/useWalletStore';
import useNetworkStore from '../../store/useNetworkStore';
import choice from '../../assets/choice.svg';
import ConvertModal from './ConvertModal';
import LiquidityBreakdown from './LiquidityBreakdown';
import { SectionHeader } from './ui';
import { PANEL } from './styles';
import {
    CHOICE_SHROOM_INJ,
    DOJO_SHROOM_INJ,
    ECOSYSTEM_HOLDERS_QUERY,
    fetchChoicePools,
    fetchMarketVolumes,
    type HolderInfo,
    MITO_VAULT,
    SHROOM_INJ_ORDERBOOK_REF,
    parseHolderInfo,
    parseTokenStats,
    type PoolLiq,
    SAI_DENOM,
    SAI_HOLDER_IDS,
    SHROOM_BANK_DENOM,
    SHROOM_CW,
    SHROOM_HOLDER_IDS,
    TOKEN_STATS_QUERY,
    type TokenStat,
    tokenTvl,
    tokenVol24h,
    totalTvl,
    UPDATE_TOKEN_HOLDERS_MUTATION,
} from './ecosystem';

// Fallback mushroom icon for the header before the Choice token row resolves.
const SHROOM_LOGO_FALLBACK =
    'https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64';
const SHROOM_TRADE = `https://choice.exchange/swap?input=inj&output=${SHROOM_CW}&volumeSplitting=true`;
const SAI_TRADE = `https://choice.exchange/swap?input=inj&output=${encodeURIComponent(SAI_DENOM)}&volumeSplitting=true`;

const SHROOM_ACCENT = '#f59e0b';
const SAI_ACCENT = '#10b981';
const UP = '#16c784';
const DOWN = '#ea3943';

// INJ-side reserve (whole INJ) of a CW pool's `assets` array.
const injReserve = (amounts: any): number => {
    const assets = amounts?.assets;
    if (!Array.isArray(assets)) return 0;
    const a = assets.find(
        (x: any) =>
            (x?.info?.native_token && x.info.native_token.denom === INJ_DENOM) ||
            (x?.info?.token && x.info.token.contract_addr === INJ_DENOM),
    );
    return a ? Number(a.amount) / 1e18 : 0;
};

// ---- small presentational helpers ---------------------------------------

// Aggregate stat in the hero strip; the headline (total liquidity) gets the
// brand colour + larger type, the rest stay quiet.
const HeroStat = ({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) => (
    <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span>
        <span
            className={`mt-0.5 font-bold tabular-nums ${
                highlight ? 'text-xl text-trippyYellow md:text-2xl' : 'text-lg text-white'
            }`}
        >
            {value}
        </span>
    </div>
);

const ChangeBadge = ({ value }: { value: number }) => {
    const up = value >= 0;
    const c = up ? UP : DOWN;
    return (
        <span
            className="mt-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums"
            style={{ color: c, backgroundColor: `${c}1f` }}
        >
            {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
        </span>
    );
};

const StatCell = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl bg-white/3 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
        <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{value}</div>
    </div>
);

// Clickable holder count — tapping fires a holders refresh against the backend
// (same mechanism as the standalone Token Holders page) and shows live progress.
const HoldersBar = ({
    info,
    onRefresh,
}: {
    info: HolderInfo;
    onRefresh: () => void;
}) => {
    // Keep "updated Xm ago" fresh without calling Date.now() during render.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 30000);
        return () => window.clearInterval(id);
    }, []);
    const updated =
        info.lastUpdated != null
            ? `updated ${timeAgo(new Date(info.lastUpdated).getTime(), now)} ago`
            : 'tap to refresh';
    return (
        <button
            type="button"
            onClick={() => {
                if (!info.inProgress) onRefresh();
            }}
            disabled={info.inProgress}
            title="Refresh holder data"
            className="group relative mt-2 flex w-full items-center justify-between gap-2 overflow-hidden rounded-lg bg-white/3 px-3 py-2 text-left transition hover:bg-white/7 disabled:cursor-default"
        >
            <span className="flex items-center gap-2 text-sm">
                <FiUsers className="text-white/45" />
                <span className="font-semibold tabular-nums text-white">
                    {info.count != null ? info.count.toLocaleString() : '—'}
                </span>
                <span className="text-white/40">holders</span>
            </span>
            {info.inProgress ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-trippyYellow">
                    <ClipLoader size={12} color="#f9d73f" />
                    refreshing
                    {info.progressPct != null ? ` ${info.progressPct.toFixed(0)}%` : '…'}
                </span>
            ) : (
                <span className="flex items-center gap-1.5 text-xs text-white/40 transition group-hover:text-white/70">
                    {updated}
                    <FiRefreshCw className="transition group-hover:rotate-90" />
                </span>
            )}
            {info.inProgress && info.progressPct != null && (
                <span
                    className="absolute bottom-0 left-0 h-0.5 bg-trippyYellow"
                    style={{ width: `${info.progressPct}%` }}
                />
            )}
        </button>
    );
};

interface TokenCardProps {
    symbol: string;
    name?: string | null;
    accent: string;
    logo?: string | null;
    price: string;
    change24h: number | null;
    marketCap: string;
    fdv: string;
    liquidity: string;
    vol24h: string;
    holders?: HolderInfo;
    onRefreshHolders?: () => void;
    extra?: string;
    tradeUrl: string;
}

const TokenCard = ({
    symbol,
    name,
    accent,
    logo,
    price,
    change24h,
    marketCap,
    fdv,
    liquidity,
    vol24h,
    holders,
    onRefreshHolders,
    extra,
    tradeUrl,
}: TokenCardProps) => (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b from-white/5 to-white/1 p-5">
        {/* soft accent glow in the corner */}
        <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
            style={{ background: accent }}
        />
        <div className="relative">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {logo ? (
                        <img
                            src={logo}
                            alt={symbol}
                            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                        />
                    ) : (
                        <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black"
                            style={{ background: accent }}
                        >
                            {symbol.slice(0, 2)}
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-lg font-bold leading-tight text-white">
                            {symbol}
                        </div>
                        {name && (
                            <div className="truncate text-xs text-white/40">{name}</div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div
                        className="text-2xl font-bold leading-none tabular-nums"
                        style={{ color: accent }}
                    >
                        {price}
                    </div>
                    {change24h != null && <ChangeBadge value={change24h} />}
                </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-2">
                <StatCell label="Market cap" value={marketCap} />
                <StatCell label="FDV" value={fdv} />
                <StatCell label="Liquidity" value={liquidity} />
                <StatCell label="24h volume" value={vol24h} />
            </dl>

            {holders && onRefreshHolders && (
                <HoldersBar info={holders} onRefresh={onRefreshHolders} />
            )}

            {extra && (
                <div className="mt-3 rounded-lg bg-white/3 px-3 py-2 text-center text-xs text-white/50">
                    {extra}
                </div>
            )}

            <a
                href={tradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition hover:brightness-125"
                style={{
                    color: accent,
                    backgroundColor: `${accent}1a`,
                    borderColor: `${accent}40`,
                }}
            >
                Trade {symbol} on Choice
                <img src={choice} className="w-4" />
            </a>
        </div>
    </article>
);

const BalanceTile = ({
    label,
    amount,
    usd,
}: {
    label: string;
    amount: number;
    usd: number;
}) => (
    <div className="rounded-xl bg-white/3 p-3 text-center">
        <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
        <div className="mt-1 text-sm font-semibold tabular-nums text-white">
            {humanReadableAmount(amount)} SHROOM
        </div>
        <div className="text-xs tabular-nums text-white/40">${usd.toFixed(2)}</div>
    </div>
);

// ---- view ---------------------------------------------------------------

const ShroomHub = () => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore();

    // liquidity sources
    const [pools, setPools] = useState<PoolLiq[]>([]);
    const [poolsLoading, setPoolsLoading] = useState(true);

    // wallet
    const [cw20Balance, setCw20Balance] = useState(0);
    const [bankBalance, setBankBalance] = useState(0);
    const [convertModal, setConvertModal] = useState(false);

    // token stats — straight from the Choice token model (price / mc / fdv /
    // supply / burn / 24h change / logo), keyed by address to dodge the
    // duplicate "SHROOM" symbol row.
    const { data: statsData } = useQuery(TOKEN_STATS_QUERY, {
        client: choiceClient,
        fetchPolicy: 'cache-and-network',
        pollInterval: 60000,
        variables: { addresses: [SHROOM_CW, SAI_DENOM] },
    });

    const tokenStats = useMemo<Record<string, TokenStat>>(
        () => parseTokenStats(statsData?.tokens_token ?? []),
        [statsData],
    );
    const shroom = tokenStats.SHROOM;
    const sai = tokenStats.SAI;
    const shroomPrice = shroom?.priceUsd ?? 0;
    const saiPrice = sai?.priceUsd ?? 0;

    // holder counts + refresh state — from the trippinj backend (default Apollo
    // client), exactly like the standalone Token Holders page.
    const { data: holdersData, refetch: refetchHolders } = useQuery(
        ECOSYSTEM_HOLDERS_QUERY,
        {
            fetchPolicy: 'cache-and-network',
            pollInterval: 15000,
            variables: { shroom: SHROOM_HOLDER_IDS, sai: SAI_HOLDER_IDS },
        },
    );
    const [updateTokenHolders] = useMutation(UPDATE_TOKEN_HOLDERS_MUTATION);

    const shroomHolders = useMemo<HolderInfo>(
        () => parseHolderInfo(holdersData?.shroom_holders, holdersData?.shroom_token),
        [holdersData],
    );
    const saiHolders = useMemo<HolderInfo>(
        () => parseHolderInfo(holdersData?.sai_holders, holdersData?.sai_token),
        [holdersData],
    );

    const refreshHolders = useCallback(
        (address: string, symbol: string) => {
            updateTokenHolders({ variables: { address } })
                .then(() => {
                    toast.success(
                        `Refreshing ${symbol} holders — request sent. This can take a few minutes…`,
                        { autoClose: 5000, theme: 'dark' },
                    );
                    // nudge the count/progress to update soon after the request lands
                    window.setTimeout(() => void refetchHolders(), 3000);
                })
                .catch((e) => console.error('updateTokenHolders failed', e));
        },
        [updateTokenHolders, refetchHolders],
    );

    const loadLiquidity = useCallback(async () => {
        setPoolsLoading(true);
        const module = new TokenUtils(networkConfig);
        try {
            const [injPrice, mitoVault, dojoAmounts, marketVol] = await Promise.all([
                module.getINJPrice(),
                module.fetchMitoVault(MITO_VAULT).catch(() => null),
                module.getPoolAmounts(DOJO_SHROOM_INJ).catch(() => null),
                // Authoritative per-market 24h USD volume from the Choice indexer
                // (keyed by ref_id), used for every venue below. Never rejects —
                // yields an empty map on failure.
                fetchMarketVolumes(),
            ]);
            const inj = Number(injPrice) || 0;

            // Non-Choice venues, read on-chain; volume keyed off the indexer feed
            // (the Mito row shows the Helix SHROOM/INJ orderbook volume).
            const onchain: PoolLiq[] = [];
            const mitoTvl = Number(mitoVault?.currentTvl) || 0;
            if (mitoTvl > 0) {
                onchain.push({
                    id: MITO_VAULT,
                    venue: 'Mito',
                    pair: 'SHROOM/INJ',
                    base: 'SHROOM',
                    quote: 'INJ',
                    tvlUsd: mitoTvl,
                    vol24hUsd: marketVol[SHROOM_INJ_ORDERBOOK_REF] ?? null,
                });
            }
            const dojoTvl = injReserve(dojoAmounts) * inj * 2;
            if (dojoTvl > 0) {
                onchain.push({
                    id: DOJO_SHROOM_INJ,
                    venue: 'DojoSwap',
                    pair: 'SHROOM/INJ',
                    base: 'SHROOM',
                    quote: 'INJ',
                    tvlUsd: dojoTvl,
                    vol24hUsd: marketVol[DOJO_SHROOM_INJ] ?? null,
                });
            }

            // Choice pools from the tickers feed; fall back to the one on-chain
            // Choice pool if the feed is unreachable.
            let choicePools: PoolLiq[] = [];
            try {
                choicePools = await fetchChoicePools(
                    {
                        INJ: inj,
                        SHROOM: shroomPrice,
                        SAI: saiPrice,
                        USDC: 1,
                    },
                    marketVol,
                );
            } catch (e) {
                console.error('choice tickers failed', e);
            }

            if (choicePools.length) {
                setPools([...choicePools, ...onchain]);
            } else {
                const choiceAmounts = await module
                    .getPoolAmounts(CHOICE_SHROOM_INJ)
                    .catch(() => null);
                const cTvl = injReserve(choiceAmounts) * inj * 2;
                const fallback: PoolLiq[] =
                    cTvl > 0
                        ? [
                              {
                                  id: CHOICE_SHROOM_INJ,
                                  venue: 'Choice',
                                  pair: 'SHROOM/INJ',
                                  base: 'SHROOM',
                                  quote: 'INJ',
                                  tvlUsd: cTvl,
                                  vol24hUsd: null,
                              },
                          ]
                        : [];
                setPools([...fallback, ...onchain]);
            }
        } catch (e) {
            console.error('loadLiquidity failed', e);
        } finally {
            setPoolsLoading(false);
        }
    }, [networkConfig, shroomPrice, saiPrice]);

    const loadBalance = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        try {
            const [cw20, bank] = await Promise.all([
                module.queryTokenForBalance(SHROOM_CW, connectedAddress as string),
                module.getBalanceOfToken(SHROOM_BANK_DENOM, connectedAddress as string),
            ]);
            setCw20Balance(Number(cw20.balance) / 1e18);
            setBankBalance(Number(bank.amount) / 1e18);
        } catch (error) {
            console.error('Failed to update balance:', error);
        }
    }, [connectedAddress, networkConfig]);

    useEffect(() => {
        if (currentNetwork === 'mainnet' && connectedAddress) {
            loadBalance().catch((e) => console.error(e));
        }
        loadLiquidity().catch((e) => console.error(e));
    }, [currentNetwork, connectedAddress, loadBalance, loadLiquidity]);

    const txToast = (msg: string, hash?: string) =>
        toast.success(
            <div>
                {msg}
                {hash && (
                    <>
                        <br />
                        <a
                            href={`https://injscan.com/transaction/${hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 underline"
                        >
                            View transaction on explorer
                        </a>
                    </>
                )}
            </div>,
            { autoClose: 5000, theme: 'dark' },
        );

    const convertToBank = useCallback(
        async (amount: any) => {
            const addr = connectedAddress as string;
            const module = new TokenUtils(networkConfig);
            const msg = module.constructCW20ToBankMsg(SHROOM_CW, amount, 18, addr);
            const result = await performTransaction(addr, [msg]);
            txToast(
                `Converted ${humanReadableAmount(amount)} CW20 SHROOM to bank`,
                result?.['txHash'],
            );
            setConvertModal(false);
            await loadBalance();
        },
        [networkConfig, loadBalance, connectedAddress],
    );

    const convertToCw20 = useCallback(
        async (amount: any) => {
            const addr = connectedAddress as string;
            const module = new TokenUtils(networkConfig);
            const msg = module.constructBankToCW20Msg(SHROOM_CW, amount, 18, addr);
            const result = await performTransaction(addr, [msg]);
            txToast(
                `Converted ${humanReadableAmount(amount)} bank SHROOM to CW20`,
                result?.['txHash'],
            );
            setConvertModal(false);
            await loadBalance();
        },
        [connectedAddress, loadBalance, networkConfig],
    );

    const sendMarketMake = useCallback(async () => {
        const addr = connectedAddress as string;
        const msg = MsgExecuteContractCompat.fromJSON({
            sender: addr,
            contractAddress: MITO_VAULT,
            msg: { market_make: {} },
        });
        const result = await performTransaction(addr, [msg]);
        txToast('Successfully sent market make', result?.['txHash']);
        await loadBalance();
        await loadLiquidity();
    }, [loadLiquidity, loadBalance, connectedAddress]);

    // ---- derived ----
    const totalLiquidity = useMemo(() => totalTvl(pools), [pools]);
    const totalVol = useMemo(
        () => pools.reduce((s, p) => s + (p.vol24hUsd ?? 0), 0),
        [pools],
    );
    const shroomLiquidity = useMemo(() => tokenTvl(pools, 'SHROOM'), [pools]);
    const saiLiquidity = useMemo(() => tokenTvl(pools, 'SAI'), [pools]);
    const shroomVol = useMemo(() => tokenVol24h(pools, 'SHROOM'), [pools]);
    const saiVol = useMemo(() => tokenVol24h(pools, 'SAI'), [pools]);
    const venueCount = useMemo(() => new Set(pools.map((p) => p.venue)).size, [pools]);

    const dash = (s: string, ok: boolean) => (ok ? s : '—');
    const headerLogo = shroom?.logo ?? SHROOM_LOGO_FALLBACK;
    const totalBalance = cw20Balance + bankBalance;

    return (
        <>
            <ToastContainer />
            {convertModal && (
                <ConvertModal
                    bankBalance={bankBalance}
                    cw20Balance={cw20Balance}
                    onClose={() => setConvertModal(false)}
                    convertToBank={convertToBank}
                    convertToCW20={convertToCw20}
                />
            )}

            <div className="flex min-h-screen flex-col bg-customGray">
                <div className="mx-auto w-full max-w-5xl space-y-4 px-3 pt-20 pb-16 sm:px-5 md:space-y-5 md:pt-24">
                    {/* ---- hero: brand + ecosystem aggregates ---- */}
                    <section className="overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/7 via-white/2 to-transparent p-5 md:p-7">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                    <img
                                        src={headerLogo}
                                        alt="SHROOM"
                                        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/15"
                                    />
                                    {sai?.logo && (
                                        <img
                                            src={sai.logo}
                                            alt="SAI"
                                            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full object-cover ring-2 ring-customGray"
                                        />
                                    )}
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                                        Ecosystem dashboard
                                    </div>
                                    <h1 className="font-magic text-3xl leading-tight text-white md:text-4xl">
                                        SHROOM <span className="text-white/40">×</span> SAI
                                    </h1>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 md:gap-x-9">
                                <HeroStat
                                    label="Total liquidity"
                                    value={formatUsd(totalLiquidity)}
                                    highlight
                                />
                                <HeroStat label="24h volume" value={formatUsd(totalVol)} />
                                <HeroStat label="Pools" value={String(pools.length)} />
                                <HeroStat label="Venues" value={String(venueCount)} />
                            </div>
                        </div>
                    </section>

                    {/* ---- token summary cards ---- */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <TokenCard
                            symbol="SHROOM"
                            name={shroom?.name}
                            accent={SHROOM_ACCENT}
                            logo={shroom?.logo}
                            price={dash(`$${formatPrice(shroomPrice)}`, shroomPrice > 0)}
                            change24h={shroom?.change24h ?? null}
                            marketCap={dash(formatUsd(shroom?.marketCap ?? 0), !!shroom?.marketCap)}
                            fdv={dash(formatUsd(shroom?.fdv ?? 0), !!shroom?.fdv)}
                            liquidity={formatUsd(shroomLiquidity)}
                            vol24h={dash(formatUsd(shroomVol), shroomVol > 0)}
                            holders={shroomHolders}
                            onRefreshHolders={() => refreshHolders(SHROOM_CW, 'SHROOM')}
                            extra={
                                shroom?.burned
                                    ? `${formatAmount(shroom.burned)} SHROOM burned ($${formatAmount(
                                          shroom.burned * shroomPrice,
                                      )})`
                                    : undefined
                            }
                            tradeUrl={SHROOM_TRADE}
                        />
                        <TokenCard
                            symbol="SAI"
                            name={sai?.name}
                            accent={SAI_ACCENT}
                            logo={sai?.logo}
                            price={dash(`$${formatPrice(sai?.priceUsd ?? 0)}`, !!sai?.priceUsd)}
                            change24h={sai?.change24h ?? null}
                            marketCap={dash(formatUsd(sai?.marketCap ?? 0), !!sai?.marketCap)}
                            fdv={dash(formatUsd(sai?.fdv ?? 0), !!sai?.fdv)}
                            liquidity={formatUsd(saiLiquidity)}
                            vol24h={dash(formatUsd(saiVol), saiVol > 0)}
                            holders={saiHolders}
                            onRefreshHolders={() => refreshHolders(SAI_DENOM, 'SAI')}
                            extra={
                                sai?.circulatingSupply
                                    ? `${formatAmount(sai.circulatingSupply)} / ${formatAmount(
                                          sai.totalSupply,
                                      )} SAI circulating`
                                    : 'Only paired with SHROOM'
                            }
                            tradeUrl={SAI_TRADE}
                        />
                    </div>

                    {/* ---- live markets (chart + trades) ---- */}
                    <section>
                        <SectionHeader eyebrow="Markets" title="Live price & trades" />
                        <ShroomMarkets />
                    </section>

                    {/* ---- liquidity sources breakdown ---- */}
                    <LiquidityBreakdown pools={pools} loading={poolsLoading} />

                    {/* ---- wallet / utilities ---- */}
                    <section className={`${PANEL} p-5 md:p-6`}>
                        <SectionHeader
                            eyebrow="Portfolio"
                            title="Your SHROOM"
                            sub={connectedAddress ? shortAddr(connectedAddress) : undefined}
                        />

                        {connectedAddress ? (
                            <>
                                <div className="rounded-xl bg-white/3 p-4 text-center">
                                    <div className="text-[11px] uppercase tracking-wide text-white/40">
                                        Total balance
                                    </div>
                                    <div className="mt-1 text-2xl font-bold tabular-nums text-trippyYellow">
                                        {humanReadableAmount(totalBalance)} SHROOM
                                    </div>
                                    <div className="text-sm tabular-nums text-white/50">
                                        ${humanReadableAmount(totalBalance * shroomPrice)} USD
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <BalanceTile
                                        label="CW20"
                                        amount={cw20Balance}
                                        usd={cw20Balance * shroomPrice}
                                    />
                                    <BalanceTile
                                        label="Bank"
                                        amount={bankBalance}
                                        usd={bankBalance * shroomPrice}
                                    />
                                </div>

                                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                    <button
                                        onClick={() => setConvertModal(true)}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/8"
                                    >
                                        <SiConvertio size={18} />
                                        Convert CW20 ⇄ Bank
                                    </button>
                                    <button
                                        onClick={() => void sendMarketMake()}
                                        className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
                                    >
                                        Tighten Mito orders
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl bg-white/3 px-4 py-8 text-center text-sm text-white/50">
                                Connect your wallet to view your SHROOM balance and manage
                                CW20 / bank conversions.
                            </div>
                        )}
                    </section>
                </div>
                <Footer />
            </div>
        </>
    );
};

export default ShroomHub;
