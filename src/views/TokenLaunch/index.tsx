import { useMemo, useState } from "react";
import parachute from "../../assets/parachute.webp"
import TokenConfirmModal from "./TokenConfirmModal";
import ShroomBalance from "../../components/App/ShroomBalance";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";

// Tokenfactory subdenoms (and therefore the symbol we derive one from) allow
// letters, digits and a few separators — never spaces. Keep this in sync with
// the chain's tokenfactory denom validation.
const SYMBOL_RE = /^[A-Za-z0-9._-]{1,44}$/;

const labelClass = "block text-sm font-bold text-white mb-1";
const inputClass =
    "w-full rounded-md bg-slate-900 border border-slate-700 text-white p-2 text-sm focus:outline-none focus:border-trippyYellow placeholder:text-slate-500";
const helpClass = "text-xs text-slate-400 mt-1";

const TokenLaunch = () => {

    const { connectedWallet } = useWalletStore()
    const { networkKey } = useNetworkStore()

    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [tokenSupply, setTokenSupply] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState(""); // no default — user must choose
    const [tokenImageUrl, setTokenImageUrl] = useState("");
    const [tokenDescription, setTokenDescription] = useState("");
    const [pairErc20, setPairErc20] = useState(true);

    const [showConfirm, setShowConfirm] = useState(false);

    const supplyNum = Number(tokenSupply);
    const decimalsNum = Number(tokenDecimals);

    // Per-field validation drives both the inline hints and the submit gate.
    const errors = useMemo(() => {
        const e: Record<string, string> = {};
        if (!tokenName.trim()) e.name = "Required";
        if (!tokenSymbol.trim()) e.symbol = "Required";
        else if (!SYMBOL_RE.test(tokenSymbol.trim()))
            e.symbol = "Letters, digits, . _ - only (no spaces)";
        if (!tokenSupply.trim()) e.supply = "Required";
        else if (!(supplyNum > 0) || !Number.isFinite(supplyNum))
            e.supply = "Must be greater than 0";
        if (tokenDecimals === "") e.decimals = "Required";
        else if (!Number.isInteger(decimalsNum) || decimalsNum < 0 || decimalsNum > 18)
            e.decimals = "Whole number 0–18";
        if (tokenImageUrl && !/^(https:\/\/|ipfs:\/\/)/.test(tokenImageUrl.trim()))
            e.image = "Use an https:// or ipfs:// URL";
        return e;
    }, [tokenName, tokenSymbol, tokenSupply, supplyNum, tokenDecimals, decimalsNum, tokenImageUrl]);

    const isValid = Object.keys(errors).length === 0;
    const denomPreview = connectedWallet && tokenSymbol.trim()
        ? `factory/${connectedWallet}/${tokenSymbol.trim()}`
        : null;

    return (
        <>
            {showConfirm && isValid &&
                <TokenConfirmModal
                    setShowModal={setShowConfirm}
                    tokenName={tokenName.trim()}
                    tokenSymbol={tokenSymbol.trim()}
                    tokenSupply={supplyNum}
                    tokenDecimals={decimalsNum}
                    tokenImage={tokenImageUrl.trim()}
                    tokenDescription={tokenDescription.trim()}
                    pairErc20={pairErc20}
                />
            }
            <div className="flex flex-col min-h-screen bg-customGray">
                <div className="pt-20 grow mx-2">
                    {networkKey == "mainnet" && <div className="flex "><ShroomBalance /></div>}
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-(--breakpoint-sm) px-2 pb-10">
                            <div className="flex flex-row justify-center items-center">
                                <div>
                                    <div className="text-center text-3xl font-magic text-white">Launch new token</div>
                                    <div className="text-xs text-center text-slate-300">on Injective {networkKey}</div>
                                </div>
                                <img
                                    src={parachute}
                                    style={{ width: 120 }}
                                    className="ml-5 rounded-xl"
                                    alt="airdrop"
                                />
                            </div>

                            <div className="mt-6 rounded-xl bg-slate-800/60 border border-slate-700 p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1">
                                        <label className={labelClass}>Token name</label>
                                        <input
                                            type="text"
                                            className={inputClass}
                                            placeholder="My Token"
                                            onChange={(e) => setTokenName(e.target.value)}
                                            value={tokenName}
                                        />
                                        {errors.name && <div className="text-xs text-rose-400 mt-1">{errors.name}</div>}
                                    </div>
                                    <div className="flex-1">
                                        <label className={labelClass}>Token symbol</label>
                                        <input
                                            type="text"
                                            className={inputClass}
                                            placeholder="MYTOKEN"
                                            onChange={(e) => setTokenSymbol(e.target.value)}
                                            value={tokenSymbol}
                                        />
                                        {errors.symbol
                                            ? <div className="text-xs text-rose-400 mt-1">{errors.symbol}</div>
                                            : <div className={helpClass}>Used for the ticker and the denom.</div>}
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className={labelClass}>Token description</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="What is this token for?"
                                        onChange={(e) => setTokenDescription(e.target.value)}
                                        value={tokenDescription}
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                                    <div className="flex-1">
                                        <label className={labelClass}>Total supply</label>
                                        <input
                                            type="number"
                                            className={inputClass}
                                            placeholder="1000000"
                                            min={0}
                                            onChange={(e) => setTokenSupply(e.target.value)}
                                            value={tokenSupply}
                                        />
                                        {errors.supply
                                            ? <div className="text-xs text-rose-400 mt-1">{errors.supply}</div>
                                            : <div className={helpClass}>Minted to your wallet on launch.</div>}
                                    </div>
                                    <div className="flex-1">
                                        <label className={labelClass}>Decimals</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                className={inputClass}
                                                placeholder="choose"
                                                min={0}
                                                max={18}
                                                onChange={(e) => setTokenDecimals(e.target.value)}
                                                value={tokenDecimals}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setTokenDecimals("18")}
                                                className={`px-3 rounded-md text-xs font-bold border ${tokenDecimals === "18" ? "bg-trippyYellow text-black border-trippyYellow" : "bg-slate-900 text-white border-slate-700"}`}
                                            >18</button>
                                            <button
                                                type="button"
                                                onClick={() => setTokenDecimals("6")}
                                                className={`px-3 rounded-md text-xs font-bold border ${tokenDecimals === "6" ? "bg-trippyYellow text-black border-trippyYellow" : "bg-slate-900 text-white border-slate-700"}`}
                                            >6</button>
                                        </div>
                                        {errors.decimals
                                            ? <div className="text-xs text-rose-400 mt-1">{errors.decimals}</div>
                                            : <div className={helpClass}>18 = EVM standard (recommended). 6 = Cosmos style.</div>}
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className={labelClass}>Token image URL</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="https://… or ipfs://…"
                                        onChange={(e) => setTokenImageUrl(e.target.value)}
                                        value={tokenImageUrl}
                                    />
                                    {errors.image
                                        ? <div className="text-xs text-rose-400 mt-1">{errors.image}</div>
                                        : <div className={helpClass}>Optional. A small webp hosted on IPFS works best.</div>}
                                </div>

                                {/* EVM pairing — default on */}
                                <label className="mt-5 flex items-start gap-3 rounded-lg bg-slate-900/70 border border-slate-700 p-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 accent-trippyYellow"
                                        checked={pairErc20}
                                        onChange={(e) => setPairErc20(e.target.checked)}
                                    />
                                    <span>
                                        <span className="text-sm font-bold text-white">Create a paired ERC-20 <span className="text-trippyYellow">(recommended)</span></span>
                                        <span className="block text-xs text-slate-400 mt-0.5">
                                            Auto-deploys an ERC-20 on Injective EVM mirroring this token, so it works
                                            with MetaMask and EVM DeFi. Uncheck for a Cosmos-only token.
                                        </span>
                                    </span>
                                </label>

                                {denomPreview &&
                                    <div className="mt-4 text-xs text-slate-300 break-all">
                                        Denom preview: <span className="text-trippyYellow">{denomPreview}</span>
                                    </div>
                                }
                            </div>

                            {connectedWallet ?
                                <button
                                    disabled={!isValid}
                                    onClick={() => setShowConfirm(true)}
                                    className="mt-6 w-full rounded-lg p-2.5 font-bold text-white shadow-lg bg-slate-700 enabled:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isValid ? "Review & launch" : "Fill in the details above"}
                                </button>
                                :
                                <div className="text-center text-white bg-slate-800 rounded-lg p-2.5 mt-6">
                                    Please connect your wallet to continue
                                </div>
                            }
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        </>

    );
};

export default TokenLaunch;
