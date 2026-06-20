import type { OwnedNft } from "../types";

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
            className={`relative rounded-lg overflow-hidden border text-left transition ${
                selected
                    ? "border-trippyYellow ring-2 ring-trippyYellow"
                    : "border-slate-700 hover:border-slate-500"
            }`}
        >
            <div className="aspect-square bg-slate-900 flex items-center justify-center">
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
            <div className="p-1 bg-slate-800/90">
                <div className="text-[11px] text-white truncate" title={nft.name ?? `#${nft.tokenId}`}>
                    {nft.name ?? `#${nft.tokenId}`}
                </div>
                <div className="text-[10px] text-slate-400 truncate">ID: {nft.tokenId}</div>
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
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-white">
                    {selected.size} of {nfts.length} selected
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-sm text-xs"
                    >
                        Select all
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-sm text-xs"
                    >
                        Clear
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-112 overflow-y-auto pr-1">
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
