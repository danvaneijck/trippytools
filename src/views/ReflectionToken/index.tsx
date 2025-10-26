import { useState } from "react";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import ReflectionTokenConfirmModal from "./ReflectionTokenConfirmModal";

// NOTE: Replace with your mainnet code IDs when available
const TESTNET_REFLECTION_TOKEN_CODE_ID = 34924;
const MAINNET_REFLECTION_TOKEN_CODE_ID = 0; // Replace with actual mainnet code ID

const ReflectionTokenLaunch = () => {
    const { connectedWallet } = useWalletStore();
    const { networkKey } = useNetworkStore();

    const [tokenName, setTokenName] = useState("My Reflection Token");
    const [tokenSymbol, setTokenSymbol] = useState("REFLECT");
    const [tokenSupply, setTokenSupply] = useState(1000000);
    const [tokenDecimals, setTokenDecimals] = useState(6);
    const [tokenImageUrl, setTokenImageUrl] = useState("");
    const [tokenDescription, setTokenDescription] = useState("A cool reflection token.");

    const [globalRate, setGlobalRate] = useState(0.05); // 5%
    const [reflectionRate, setReflectionRate] = useState(0.5); // 50% of tax
    const [burnRate, setBurnRate] = useState(0.1); // 10% of tax
    const [antiwhaleRate, setAntiwhaleRate] = useState(0.01); // 1% of total supply

    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateInputs = () => {
        if (!tokenName || tokenName.length < 3 || tokenName.length > 50) {
            setError("Token name must be between 3 and 50 characters.");
            return false;
        }
        if (!tokenSymbol || tokenSymbol.length < 3 || tokenSymbol.length > 12) {
            setError("Token symbol must be between 3 and 12 characters.");
            return false;
        }
        if (tokenDecimals > 18 || tokenDecimals < 0) {
            setError("Decimals must be between 0 and 18.");
            return false;
        }
        if (globalRate > 1 || globalRate < 0) {
            setError("Global tax rate must be between 0 and 1.");
            return false;
        }
        if (reflectionRate + burnRate > 1) {
            setError("The sum of reflection and burn rates cannot exceed 1.");
            return false;
        }
        if (antiwhaleRate > 1 || antiwhaleRate <= 0) {
            setError("Anti-whale rate must be between 0 and 1.");
            return false;
        }
        setError(null);
        return true;
    };

    const handleConfirm = () => {
        if (validateInputs()) {
            setShowConfirm(true);
        }
    };


    return (
        <>
            {showConfirm &&
                <ReflectionTokenConfirmModal
                    setShowModal={setShowConfirm}
                    tokenName={tokenName}
                    tokenSymbol={tokenSymbol}
                    tokenSupply={tokenSupply}
                    tokenDecimals={tokenDecimals}
                    tokenImage={tokenImageUrl}
                    tokenDescription={tokenDescription}
                    globalRate={globalRate}
                    reflectionRate={reflectionRate}
                    burnRate={burnRate}
                    antiwhaleRate={antiwhaleRate}
                />
            }
            <div className="flex flex-col min-h-screen bg-customGray">
                <div className="pt-20 flex-grow mx-2">
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-screen-md px-2 pb-10">
                            <div className="text-center text-3xl font-magic mb-4">Launch Reflection Token</div>
                            <div className="text-xs text-center mb-6">on Injective {networkKey}</div>

                            {/* Token Details Section */}
                            <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-6">
                                <h2 className="text-xl font-bold mb-4 text-white">Token Details</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-base font-bold text-white">Token Name</label>
                                        <input type="text" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setTokenName(e.target.value)} value={tokenName} />
                                    </div>
                                    <div>
                                        <label className="block text-base font-bold text-white">Token Symbol</label>
                                        <input type="text" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setTokenSymbol(e.target.value)} value={tokenSymbol} />
                                    </div>
                                    <div>
                                        <label className="block text-base font-bold text-white">Total Supply</label>
                                        <input type="number" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setTokenSupply(Number(e.target.value))} value={tokenSupply} />
                                    </div>
                                    <div>
                                        <label className="block text-base font-bold text-white">Decimals</label>
                                        <input type="number" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setTokenDecimals(Number(e.target.value))} value={tokenDecimals} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-base font-bold text-white">Description</label>
                                        <input type="text" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setTokenDescription(e.target.value)} value={tokenDescription} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block font-bold text-white">Token Image URL</label>
                                        <span className="text-xs">Should be a public URL (e.g., hosted on IPFS).</span>
                                        <input type="text" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setTokenImageUrl(e.target.value)} value={tokenImageUrl} />
                                    </div>
                                </div>
                            </div>

                            {/* Tax Configuration Section */}
                            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
                                <h2 className="text-xl font-bold mb-4 text-white">Tax & Feature Configuration</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-base font-bold text-white">Global Tax Rate</label>
                                        <span className="text-xs">Tax on every transaction (e.g., 0.05 for 5%).</span>
                                        <input type="number" step="0.01" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setGlobalRate(Number(e.target.value))} value={globalRate} />
                                    </div>
                                    <div>
                                        <label className="block text-base font-bold text-white">Reflection Rate</label>
                                        <span className="text-xs">Portion of tax for reflection (e.g., 0.5 for 50%).</span>
                                        <input type="number" step="0.01" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setReflectionRate(Number(e.target.value))} value={reflectionRate} />
                                    </div>
                                    <div>
                                        <label className="block text-base font-bold text-white">Burn Rate</label>
                                        <span className="text-xs">Portion of tax to burn (e.g., 0.1 for 10%).</span>
                                        <input type="number" step="0.01" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setBurnRate(Number(e.target.value))} value={burnRate} />
                                    </div>
                                    <div>
                                        <label className="block text-base font-bold text-white">Anti-Whale Rate</label>
                                        <span className="text-xs">Max % of supply per transfer (e.g., 0.01 for 1%).</span>
                                        <input type="number" step="0.001" className="text-black w-full rounded p-2 text-sm" onChange={(e) => setAntiwhaleRate(Number(e.target.value))} value={antiwhaleRate} />
                                    </div>
                                </div>
                                <div className="text-xs mt-4">
                                    * The remaining portion of the tax will be sent to the treasury for liquidity.
                                </div>
                            </div>


                            {error && <div className="my-4 text-red-500 text-center">{error}</div>}

                            {connectedWallet ? (
                                <div className="my-10">
                                    <button
                                        onClick={handleConfirm}
                                        className="bg-gray-900 hover:bg-gray-700 rounded-lg p-3 w-full text-white mt-6 shadow-lg transition-colors"
                                    >
                                        Confirm and Review
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center bg-gray-800 rounded-lg p-3 mt-10">
                                    Please connect your wallet to continue
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

export default ReflectionTokenLaunch;