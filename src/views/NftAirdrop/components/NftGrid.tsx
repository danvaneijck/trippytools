import type { OwnedNft } from "../types";
import { btnGhost } from "../../Airdrop/components/ui";

const NftCard = ({
    nft,
    selected,
    fallbackImg,
    onToggle,
}: {
    nft: OwnedNft;
    selected: boolean;
    fallbackImg?: string;
    onToggle: (tokenId: string) => void;
}) => {
    const img = nft.image || fallbackImg;
    return (
        <button
            type="button"
            onClick={() => onToggle(nft.tokenId)}
            className={`relative overflow-hidden rounded-xl border text-left transition ${
                selected
                    ? "border-trippyYellow ring-2 ring-trippyYellow"
                    : "border-white/10 hover:border-white/30"
            }`}
        >
            <div className="flex aspect-square items-center justify-center bg-slate-950/60">
                {img ? (
                    <img
                        src={img}
                        alt={nft.name ?? nft.tokenId}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                ) : (
                    <span className="text-slate-500 text-xs px-1 text-center break-all">#{nft.tokenId}</span>
                )}
            </div>
            <div className="absolute top-1 right-1">
                <span
                    className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                        selected ? "bg-trippyYellow text-black" : "bg-black/60 text-white border border-white/40"
                    }`}
                >
                    {selected ? "✓" : ""}
                </span>
            </div>
            <div className="bg-black/40 p-1.5">
                <div className="truncate text-[11px] text-white" title={nft.name ?? `#${nft.tokenId}`}>
                    {nft.name ?? `#${nft.tokenId}`}
                </div>
                <div className="truncate text-[10px] text-slate-400">ID: {nft.tokenId}</div>
            </div>
        </button>
    );
};

const NftGrid = ({
    nfts,
    selected,
    fallbackImg,
    onToggle,
    onSelectAll,
    onClear,
}: {
    nfts: OwnedNft[];
    selected: Set<string>;
    fallbackImg?: string;
    onToggle: (tokenId: string) => void;
    onSelectAll: () => void;
    onClear: () => void;
}) => {
    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <div className="text-sm text-slate-300">
                    <span className="font-bold text-white">{selected.size}</span> of {nfts.length} selected
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onSelectAll} className={btnGhost}>
                        Select all
                    </button>
                    <button type="button" onClick={onClear} className={btnGhost}>
                        Clear
                    </button>
                </div>
            </div>
            <div className="grid max-h-112 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-6">
                {nfts.map((nft) => (
                    <NftCard
                        key={nft.tokenId}
                        nft={nft}
                        selected={selected.has(nft.tokenId)}
                        fallbackImg={fallbackImg}
                        onToggle={onToggle}
                    />
                ))}
            </div>
        </div>
    );
};

export default NftGrid;
