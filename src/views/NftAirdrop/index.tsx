import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GridLoader } from "react-spinners";
import TokenUtils from "../../modules/tokenUtils";
import ConnectWallet from "../../components/App/ConnectKeplr";
import ShroomBalance from "../../components/App/ShroomBalance";
import Footer from "../../components/App/Footer";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { NFT_COLLECTIONS } from "../../constants/contractAddresses";
import parachute from "../../assets/parachute.webp";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { isValidInjAddress } from "../Airdrop/csv";
import { humanReadableAmount } from "../Airdrop/format";
import { parseWalletCsv, downloadCsv } from "./csv";
import NftGrid from "./components/NftGrid";
import NftAirdropConfirmModal from "./NftAirdropConfirmModal";
import type { NftPair, OwnedNft } from "./types";
import { PiParachuteBold } from "react-icons/pi";
import { FiShuffle, FiDownload } from "react-icons/fi";
import SectionCard from "../Airdrop/components/SectionCard";
import {
    btnPrimary,
    btnSecondary,
    btnGhost,
    inputBase,
    cardBase,
    darkSelectStyles,
} from "../Airdrop/components/ui";

const SHROOM_COST = 25000;
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl";

const NftAirdrop = () => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore();

    const [collectionOption, setCollectionOption] = useState<any>(NFT_COLLECTIONS[0]);
    const [customAddress, setCustomAddress] = useState("");
    const collectionAddress = (customAddress.trim() || collectionOption?.value || "").trim();

    const [collectionInfo, setCollectionInfo] = useState<{ name?: string; symbol?: string } | null>(null);
    const [ownedNfts, setOwnedNfts] = useState<OwnedNft[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [recipients, setRecipients] = useState<string[]>([]);
    const [csvInvalid, setCsvInvalid] = useState<{ row: number; address: string; reason: string }[]>([]);
    const [csvDuplicates, setCsvDuplicates] = useState(0);
    const [csvColumn, setCsvColumn] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [shroomPrice, setShroomPrice] = useState<string | null>(null);

    useEffect(() => {
        if (!loading) setProgress("");
    }, [loading]);

    // Switching collection clears any loaded NFTs / selection so one collection
    // never shows another's tokens.
    useEffect(() => {
        setOwnedNfts([]);
        setSelected(new Set());
        setCollectionInfo(null);
        setError(null);
    }, [collectionAddress]);

    useEffect(() => {
        const getShroomCost = async () => {
            const module = new TokenUtils(networkConfig);
            try {
                const [baseAssetPrice, pairInfo] = await Promise.all([
                    module.getINJPrice(),
                    module.getPairInfo(SHROOM_PAIR_ADDRESS),
                ]);
                const quote = await module.getSellQuoteRouter(pairInfo, SHROOM_COST + "0".repeat(18));
                const returnAmount = Number(quote.amount) / Math.pow(10, 18);
                setShroomPrice((returnAmount * baseAssetPrice!).toFixed(3));
            } catch (e) {
                console.error("Failed to update shroom cost:", e);
            }
        };
        if (currentNetwork === "mainnet") void getShroomCost();
    }, [currentNetwork, networkConfig]);

    const loadOwnedNfts = useCallback(async () => {
        if (!collectionAddress || !connectedAddress) return;
        if (!isValidInjAddress(collectionAddress)) {
            setError("Enter a valid collection contract address");
            return;
        }
        setLoading(true);
        setError(null);
        setOwnedNfts([]);
        setSelected(new Set());
        try {
            const module = new TokenUtils(networkConfig);
            const info = await module.getNFTCollectionInfo(collectionAddress).catch(() => null);
            if (info) setCollectionInfo({ name: info.name, symbol: info.symbol });
            const nfts = await module.getOwnedNFTs(collectionAddress, connectedAddress, setProgress);
            setOwnedNfts(nfts);
            // Default to dropping all held tokens; the user can trim the set.
            setSelected(new Set(nfts.map((n) => n.tokenId)));
            if (nfts.length === 0) setError("You don't hold any NFTs in this collection");
            setLoading(false);
        } catch (e) {
            console.log(e);
            setError((e as any)?.message ?? "Failed to load your NFTs");
            setLoading(false);
        }
    }, [collectionAddress, connectedAddress, networkConfig]);

    const toggleNft = useCallback((tokenId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(tokenId)) next.delete(tokenId);
            else next.add(tokenId);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => setSelected(new Set(ownedNfts.map((n) => n.tokenId))), [ownedNfts]);
    const clearSelection = useCallback(() => setSelected(new Set()), []);

    const handleCsvUpload = useCallback(async (event: any) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null);
        try {
            const { wallets, invalidRows, duplicates, detectedColumn } = await parseWalletCsv(file);
            setRecipients(wallets);
            setCsvInvalid(invalidRows);
            setCsvDuplicates(duplicates);
            setCsvColumn(detectedColumn);
            if (wallets.length === 0) {
                setError("No Injective addresses found in that CSV");
            }
        } catch (e) {
            console.log(e);
            setError((e as any)?.message ?? "Failed to parse CSV");
        }
    }, []);

    const shuffleRecipients = useCallback(() => {
        setRecipients((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [next[i], next[j]] = [next[j], next[i]];
            }
            return next;
        });
    }, []);

    // Pair selected NFTs (in display order) 1:1 with recipient wallets.
    const selectedNfts = useMemo(
        () => ownedNfts.filter((n) => selected.has(n.tokenId)),
        [ownedNfts, selected],
    );
    const pairs: NftPair[] = useMemo(() => {
        const count = Math.min(selectedNfts.length, recipients.length);
        const out: NftPair[] = [];
        for (let i = 0; i < count; i++) {
            out.push({
                tokenId: selectedNfts[i].tokenId,
                name: selectedNfts[i].name,
                image: selectedNfts[i].image,
                recipient: recipients[i],
            });
        }
        return out;
    }, [selectedNfts, recipients]);

    const leftoverNfts = selectedNfts.length - pairs.length;
    const leftoverWallets = recipients.length - pairs.length;

    const downloadTemplate = useCallback(() => {
        downloadCsv("nft-airdrop-wallets-template.csv", "address\ninj1...\ninj1...");
    }, []);

    return (
        <>
            {showConfirm && collectionAddress && pairs.length > 0 && (
                <NftAirdropConfirmModal
                    setShowModal={setShowConfirm}
                    pairs={pairs}
                    collectionAddress={collectionAddress}
                    collectionName={collectionInfo?.name}
                    collectionSymbol={collectionInfo?.symbol}
                    shroomCost={SHROOM_COST}
                />
            )}
            <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                <div className="pt-24 grow mx-2 pb-20">
                    {currentNetwork === "mainnet" && (
                        <div>
                            <ShroomBalance />
                        </div>
                    )}

                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-(--breakpoint-lg) px-2">
                            {connectedAddress ? (
                                <div className="space-y-5">
                                    <div className="text-center text-white">
                                        <PiParachuteBold className="mx-auto mb-2 text-trippyYellow" size={34} />
                                        <div className="font-magic text-3xl">NFT Airdrop</div>
                                        <div className="text-sm text-slate-400">
                                            on Injective{" "}
                                            <span className="capitalize text-trippyYellow">{currentNetwork}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Link to="/airdrop" className="flex-1">
                                            <div className={`${btnSecondary} w-full`}>Airdrop a token instead →</div>
                                        </Link>
                                        <Link to="/airdrop-history" className="flex-1">
                                            <div className={`${btnSecondary} w-full`}>View airdrop history</div>
                                        </Link>
                                    </div>

                                    {/* Step 1 — collection */}
                                    <SectionCard step={1} title="NFT collection to airdrop">
                                        <TokenSelect
                                            dark
                                            styles={darkSelectStyles}
                                            options={[{ label: "NFT collections", options: NFT_COLLECTIONS }]}
                                            selectedOption={collectionOption}
                                            setSelectedOption={(opt: any) => {
                                                setCustomAddress("");
                                                setCollectionOption(opt);
                                            }}
                                        />
                                        <div className="mt-3">
                                            <label className="mb-1 block text-sm text-slate-400">
                                                or paste a CW721 collection contract address
                                            </label>
                                            <input
                                                className={inputBase}
                                                placeholder="inj1..."
                                                value={customAddress}
                                                onChange={(e) => setCustomAddress(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            disabled={loading || !collectionAddress}
                                            onClick={() => {
                                                void loadOwnedNfts();
                                            }}
                                            className={`${btnPrimary} mt-4 w-full`}
                                        >
                                            Load my NFTs
                                        </button>
                                        {collectionInfo && (
                                            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white">
                                                <span className="text-slate-400">Collection:</span> {collectionInfo.name}{" "}
                                                {collectionInfo.symbol ? `(${collectionInfo.symbol})` : ""}
                                                <span className="text-slate-400">
                                                    {" "}
                                                    · you hold {ownedNfts.length} NFT
                                                    {ownedNfts.length === 1 ? "" : "s"} here
                                                </span>
                                            </div>
                                        )}
                                    </SectionCard>

                                    {/* Step 2 — select NFTs */}
                                    {ownedNfts.length > 0 && (
                                        <SectionCard step={2} title="Select the NFTs to drop">
                                            <NftGrid
                                                nfts={ownedNfts}
                                                selected={selected}
                                                fallbackImg={collectionOption?.img}
                                                onToggle={toggleNft}
                                                onSelectAll={selectAll}
                                                onClear={clearSelection}
                                            />
                                        </SectionCard>
                                    )}

                                    {/* Step 3 — recipient wallets */}
                                    {ownedNfts.length > 0 && (
                                        <SectionCard
                                            step={3}
                                            title="Upload recipient wallets (CSV)"
                                            subtitle="The wallet column is detected automatically — a plain one-address-per-line list or a multi-column holder snapshot both work. Each selected NFT is sent to one wallet, in order."
                                        >
                                            <div className="flex flex-wrap items-center gap-3">
                                                <input
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={(e) => {
                                                        void handleCsvUpload(e);
                                                    }}
                                                    className="text-sm text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-white/10"
                                                />
                                                <button type="button" onClick={downloadTemplate} className={btnGhost}>
                                                    <FiDownload size={13} />
                                                    Download template
                                                </button>
                                            </div>
                                            {(csvInvalid.length > 0 || csvDuplicates > 0) && (
                                                <div className="text-amber-400 text-xs mt-2">
                                                    {csvInvalid.length > 0 && (
                                                        <div>
                                                            Skipped {csvInvalid.length} invalid row
                                                            {csvInvalid.length === 1 ? "" : "s"}. First: row{" "}
                                                            {csvInvalid[0].row} — {csvInvalid[0].reason}.
                                                        </div>
                                                    )}
                                                    {csvDuplicates > 0 && (
                                                        <div>
                                                            Removed {csvDuplicates} duplicate address
                                                            {csvDuplicates === 1 ? "" : "es"}.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {recipients.length > 0 && (
                                                <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white">
                                                    <span className="font-bold text-trippyYellow">
                                                        {recipients.length}
                                                    </span>{" "}
                                                    valid recipient{recipients.length === 1 ? "" : "s"} loaded
                                                    {csvColumn ? (
                                                        <span className="text-slate-400"> from “{csvColumn}”</span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </SectionCard>
                                    )}

                                    {/* Step 4 — pairing preview */}
                                    {pairs.length > 0 && (
                                        <SectionCard
                                            step={4}
                                            title={`Assignment preview (${pairs.length} transfer${
                                                pairs.length === 1 ? "" : "s"
                                            })`}
                                        >
                                            <div className="mb-3 flex items-center justify-end">
                                                <button
                                                    type="button"
                                                    onClick={shuffleRecipients}
                                                    className={btnGhost}
                                                >
                                                    <FiShuffle size={13} />
                                                    Shuffle
                                                </button>
                                            </div>
                                            {(leftoverNfts > 0 || leftoverWallets > 0) && (
                                                <div className="mb-3 space-y-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                                                    {leftoverNfts > 0 && (
                                                        <div>
                                                            {leftoverNfts} selected NFT{leftoverNfts === 1 ? "" : "s"} won't
                                                            be sent — not enough wallets.
                                                        </div>
                                                    )}
                                                    {leftoverWallets > 0 && (
                                                        <div>
                                                            {leftoverWallets} wallet{leftoverWallets === 1 ? "" : "s"} won't
                                                            receive — not enough selected NFTs.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-xl border border-white/10">
                                                <table className="w-full table-auto text-xs text-white">
                                                    <thead className="sticky top-0 bg-[#04141b] text-slate-400">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">NFT</th>
                                                            <th className="px-3 py-2 text-left">Recipient</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pairs.map((p, i) => (
                                                            <tr
                                                                key={i}
                                                                className="border-b border-white/5 transition hover:bg-white/5"
                                                            >
                                                                <td className="whitespace-nowrap px-3 py-1.5">
                                                                    {p.image && (
                                                                        <img
                                                                            src={p.image}
                                                                            alt={p.tokenId}
                                                                            className="mr-2 inline-block h-6 w-6 rounded object-cover align-middle"
                                                                        />
                                                                    )}
                                                                    {p.name ?? `#${p.tokenId}`} (ID {p.tokenId})
                                                                </td>
                                                                <td className="break-all px-3 py-1.5 text-slate-300">
                                                                    {p.recipient}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </SectionCard>
                                    )}

                                    {error && (
                                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                            {error}
                                        </div>
                                    )}

                                    {/* Step 5 — review and confirm */}
                                    {pairs.length > 0 && (
                                        <SectionCard step={5} title="Review and confirm">
                                            {currentNetwork === "mainnet" && (
                                                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
                                                    <span className="text-slate-400">
                                                        Fee{" "}
                                                        <a
                                                            href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                                                            className="text-trippyYellow underline"
                                                        >
                                                            (buy SHROOM)
                                                        </a>
                                                    </span>
                                                    <span className="font-bold text-white">
                                                        {humanReadableAmount(SHROOM_COST)} SHROOM{" "}
                                                        <span className="font-normal text-slate-400">
                                                            (${shroomPrice ?? "0"})
                                                        </span>
                                                    </span>
                                                </div>
                                            )}
                                            <button
                                                disabled={loading}
                                                onClick={() => setShowConfirm(true)}
                                                className={`${btnPrimary} mt-4 w-full`}
                                            >
                                                Review NFT airdrop
                                            </button>
                                        </SectionCard>
                                    )}
                                </div>
                            ) : (
                                <div className="mx-auto max-w-md text-center">
                                    <div className={`${cardBase} flex flex-col items-center`}>
                                        <div className="mb-4 font-magic text-2xl text-white">NFT Airdrop Tool</div>
                                        <img
                                            src={parachute}
                                            style={{ width: 140 }}
                                            className="mb-4 rounded-xl"
                                            alt="airdrop"
                                        />
                                        <div className="mb-5 text-sm text-slate-400">
                                            Connect your wallet to airdrop your NFTs
                                        </div>
                                        <ConnectWallet hideNetwork={true} button={true} />
                                    </div>
                                </div>
                            )}

                            {loading && (
                                <div className="flex flex-col items-center justify-center pt-6">
                                    <GridLoader color="#f9d73f" />
                                    {progress.length > 0 && (
                                        <div className="mt-3 text-sm text-slate-400">{progress}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        </>
    );
};

export default NftAirdrop;
