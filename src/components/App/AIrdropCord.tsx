import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { PiParachuteBold, PiUsersThreeBold, PiCoinsBold } from "react-icons/pi";
import { FiCopy, FiCheck, FiExternalLink } from "react-icons/fi";
import { toPng } from "html-to-image";
import shroomlogo from "../../assets/shroom.jpg";

import useTokenStore from "../../store/useTokenStore";
import { humanReadableAmount, shortAddress } from "../../utils/format";
import { fetchShroomTokenMetaCached } from "../../modules/shroomTokenMeta";

type Props = {
    log: {
        amount_dropped: string;
        criteria: string;
        description: string;
        time: string;
        fee: string;
        tx_hashes: string;
        token: { address?: string; symbol: string };
        total_participants: number;
        wallet: { address: string };
    };
};

// Snapshot criteria/descriptions embed raw ISO timestamps
// (e.g. "HOLDERS OF SACKS NFTS AT 2025-11-07T18:20:52.763Z"). Swap any ISO
// datetime for a human-friendly rendering so the copy reads cleanly.
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;
const prettifyTimestamps = (text: string) =>
    (text ?? "").replace(ISO_RE, (m) => dayjs(m).format("MMM D, YYYY · HH:mm"));

const AirdropCard = ({ log }: Props) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    const { tokens } = useTokenStore();
    const denom = log.token?.address;
    const tokenDetails = tokens.find((token) => token.address == denom);

    // SHROOM launchpad tokens carry the raw subdenom as their on-chain bank
    // symbol (e.g. "SHROOM_11_273EE1EA53ABBCAD"); the friendly name/symbol/logo
    // live in the launch's off-chain metadata. Resolve them best-effort so the
    // card reads "Airdropped BERB" instead of the opaque denom. Falls back to the
    // raw symbol for non-SHROOM tokens or when the read fails.
    const [shroomSymbol, setShroomSymbol] = useState<string>();
    const [shroomImage, setShroomImage] = useState<string>();
    useEffect(() => {
        if (!denom) return;
        let alive = true;
        void fetchShroomTokenMetaCached(denom).then((meta) => {
            if (!alive || !meta) return;
            if (meta.symbol) setShroomSymbol(meta.symbol);
            if (meta.image) setShroomImage(meta.image);
        });
        return () => {
            alive = false;
        };
    }, [denom]);

    const symbol = (shroomSymbol ?? log.token?.symbol)?.trim();
    const iconUrl = tokenDetails?.icon || shroomImage;
    const hashes = (log.tx_hashes ?? "").split(",").map((h) => h.trim()).filter(Boolean);

    const copyPng = async () => {
        if (!cardRef.current) return;
        const dataUrl = await toPng(cardRef.current, {
            pixelRatio: 2,
            filter: (node) =>
                !(node.classList && node.classList.contains("no-export")),
        });
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    return (
        <article
            ref={cardRef}
            className="
                group relative overflow-hidden rounded-2xl mb-5
                bg-linear-to-b from-[#04262f] to-[#00151d]
                ring-1 ring-white/10 shadow-lg
                transition duration-200 hover:ring-white/20 hover:shadow-2xl
            "
        >
            {/* faint, corner-masked token watermark — decorative, keeps text readable */}
            {iconUrl && (
                <img
                    src={iconUrl}
                    alt=""
                    aria-hidden
                    className="
                        pointer-events-none select-none absolute -right-8 -top-8
                        h-40 w-40 rounded-full object-cover opacity-[0.06] blur-[1px]
                        mask-[radial-gradient(circle_at_center,black,transparent_70%)]
                    "
                />
            )}

            {/* accent top hairline */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-trippyYellow/40 to-transparent" />

            <div className="relative p-5">
                {/* header */}
                <div className="flex items-start gap-3">
                    {iconUrl ? (
                        <img
                            src={iconUrl}
                            alt={symbol ? `${symbol} logo` : "token"}
                            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/15"
                        />
                    ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 ring-2 ring-white/10">
                            <PiParachuteBold className="text-xl text-trippyYellow/80" />
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-white">
                            Airdropped {symbol ? `${symbol} ` : ""}
                            <span className="text-slate-300">
                                to {log.total_participants} wallets
                            </span>
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                            {dayjs(log.time).fromNow()}
                            <span className="mx-1.5 text-slate-600">·</span>
                            {dayjs(log.time).format("MMM D, YYYY")}
                        </p>
                    </div>

                    <button
                        onClick={() => { void copyPng(); }}
                        title="Copy card as image"
                        className="no-export flex shrink-0 items-center gap-1.5 rounded-lg
                            bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-300
                            ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                    >
                        {copied ? (
                            <><FiCheck className="text-emerald-400" /> Copied</>
                        ) : (
                            <><FiCopy /> Copy img</>
                        )}
                    </button>
                </div>

                {/* description / criteria */}
                <div className="mt-4 space-y-1.5">
                    {log.description && (
                        <p className="text-sm font-medium leading-relaxed text-slate-100">
                            {prettifyTimestamps(log.description)}
                        </p>
                    )}
                    {log.criteria && (
                        <p className="text-xs leading-relaxed text-slate-400">
                            {prettifyTimestamps(log.criteria)}
                        </p>
                    )}
                </div>

                {/* stat strip */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                    <Stat
                        icon={<PiUsersThreeBold />}
                        label="Recipients"
                        value={log.total_participants.toLocaleString()}
                    />
                    <Stat
                        icon={<PiParachuteBold />}
                        label="Amount"
                        value={`${humanReadableAmount(log.amount_dropped)}${symbol ? ` ${symbol}` : ""}`}
                    />
                    <Stat
                        icon={<PiCoinsBold />}
                        label="Fee"
                        value={
                            <span className="inline-flex items-center gap-1">
                                {humanReadableAmount(log.fee)} SHROOM
                                <img src={shroomlogo} alt="" className="h-3.5 w-3.5 rounded-full" />
                            </span>
                        }
                    />
                </div>

                {/* footer: sender + tx links */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                    <a
                        href={`https://explorer.injective.network/account/${log.wallet.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1
                            font-mono text-[11px] text-slate-300 ring-1 ring-white/10
                            transition hover:text-white hover:ring-white/20"
                    >
                        {shortAddress(log.wallet.address)}
                        <FiExternalLink className="text-slate-500" />
                    </a>

                    <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-500">
                        {hashes.length} tx
                    </span>
                    {hashes.map((hash, i) => (
                        <a
                            key={i}
                            href={`https://explorer.injective.network/transaction/${hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-trippyYellow/10 px-2 py-1
                                font-mono text-[11px] text-trippyYellow/90 ring-1 ring-trippyYellow/20
                                transition hover:bg-trippyYellow/20"
                        >
                            {hash.slice(0, 6)}…{hash.slice(-4)}
                            <FiExternalLink className="opacity-70" />
                        </a>
                    ))}
                </div>
            </div>
        </article>
    );
};

const Stat = ({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) => (
    <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
            <span className="text-slate-400">{icon}</span>
            {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-white">{value}</div>
    </div>
);

export default AirdropCard;
