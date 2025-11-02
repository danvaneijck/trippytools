import { useState } from "react";
import { ChainGrpcWasmApi, MsgExecuteContract } from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";
import { CircleLoader } from "react-spinners";
import { toast } from "react-toastify";
import Footer from "../../components/App/Footer";
import useNetworkStore from "../../store/useNetworkStore";
import useWalletStore from "../../store/useWalletStore";
import { performTransaction } from "../../utils/walletStrategy";
import { FaCheckCircle, FaMinusCircle } from "react-icons/fa";
import { BigNumberInWei } from "@injectivelabs/utils";


interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
}

interface TaxRates {
    global_rate: string;
    reflection_rate: string;
    burn_rate: string;
    antiwhale_rate: string;
}

const ManageExistingReflectionToken = () => {
    const { connectedWallet } = useWalletStore();
    const { network } = useNetworkStore();

    // State for the main token query
    const [tokenAddress, setTokenAddress] = useState("");
    const [treasuryAddress, setTreasuryAddress] = useState<string | null>(null);
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [taxRates, setTaxRates] = useState<TaxRates | null>(null);

    // State for managing the whitelist for a specific address
    const [manageAddress, setManageAddress] = useState("");
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);

    // Loading and error states
    const [loading, setLoading] = useState(false); // For transactions
    const [querying, setQuerying] = useState(false); // For initial token query
    const [checkingStatus, setCheckingStatus] = useState(false); // For checking whitelist status
    const [error, setError] = useState<string | null>(null);

    /**
    * Queries the token contract to get its treasury address, token info, and tax rates.
    */
    const handleQueryToken = async () => {
        if (!network || !tokenAddress) {
            setError("Please enter a valid token address.");
            return;
        }
        setQuerying(true);
        setError(null);
        // Reset all states
        setTreasuryAddress(null);
        setTokenInfo(null);
        setTaxRates(null);
        setIsWhitelisted(null);
        setManageAddress("");

        const wasmApi = new ChainGrpcWasmApi(network.grpc);

        try {
            // Prepare all queries
            const treasuryQuery = Buffer.from(JSON.stringify({ get_treasury: {} })).toString("base64");
            const tokenInfoQuery = Buffer.from(JSON.stringify({ token_info: {} })).toString("base64");
            const ratesQuery = Buffer.from(JSON.stringify({ query_rates: {} })).toString("base64");

            // Execute all queries in parallel
            const [treasuryResponse, tokenInfoResponse, ratesResponse] = await Promise.all([
                wasmApi.fetchSmartContractState(tokenAddress, treasuryQuery),
                wasmApi.fetchSmartContractState(tokenAddress, tokenInfoQuery),
                wasmApi.fetchSmartContractState(tokenAddress, ratesQuery)
            ]);

            // Parse and set treasury data
            const treasuryData = JSON.parse(Buffer.from(treasuryResponse.data).toString('utf8'));
            if (!treasuryData.address) throw new Error("Could not find a treasury address.");
            setTreasuryAddress(treasuryData.address);

            // Parse and set token info
            const tokenInfoData = JSON.parse(Buffer.from(tokenInfoResponse.data).toString('utf8'));
            setTokenInfo(tokenInfoData);

            const ratesDataArray = JSON.parse(Buffer.from(ratesResponse.data).toString('utf8'));

            if (Array.isArray(ratesDataArray) && ratesDataArray.length === 4) {
                const [global_rate, reflection_rate, burn_rate, antiwhale_rate] = ratesDataArray;
                setTaxRates({
                    global_rate,
                    reflection_rate,
                    burn_rate,
                    antiwhale_rate
                });
            } else {
                throw new Error("Received an unexpected format for tax rates.");
            }

            toast.success("Token data loaded successfully!", { theme: "dark" });

        } catch (e: any) {
            setError(`Failed to query token: ${e.message}`);
            toast.error("Failed to load token data. Is it a valid reflection token contract?", { theme: "dark" });
        } finally {
            setQuerying(false);
        }
    };

    /**
     * Checks if a specific address is on the whitelist.
     */
    const handleCheckWhitelistStatus = async () => {
        if (!network || !manageAddress) {
            setError("Please enter an address to check.");
            return;
        }
        setCheckingStatus(true);
        setError(null);

        const wasmApi = new ChainGrpcWasmApi(network.grpc);

        try {
            const query = Buffer.from(JSON.stringify({ get_whitelist: { address: manageAddress } })).toString("base64");
            const response = await wasmApi.fetchSmartContractState(tokenAddress, query);
            const data = JSON.parse(Buffer.from(response.data).toString('utf8'));
            console.log(data)
            setIsWhitelisted(data);
        } catch (e: any) {
            // setError(`Failed to check whitelist status: ${e.message}`);
            setIsWhitelisted(false); // Reset on error
        } finally {
            setCheckingStatus(false);
        }
    };


    /**
     * Sends a transaction to add or remove an address from the whitelist.
     */
    const handleWhitelistUpdate = async (address: string, enable: boolean) => {
        if (!connectedWallet) {
            setError("Please connect your wallet to make changes.");
            return;
        }
        setLoading(true);
        setError(null);

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: tokenAddress,
            sender: connectedWallet,
            msg: { set_whitelist: { user: address, enable } },
        });

        try {
            await performTransaction(connectedWallet, [msg]);
            toast.success(`Address ${enable ? 'added to' : 'removed from'} whitelist!`, { theme: "dark" });
            // Update the status for the current address after the transaction
            setIsWhitelisted(enable);
        } catch (e: any) {
            setError(e.message);
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-customGray">
            <div className="pt-20 flex-grow mx-2">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-md px-2 pb-10">
                        <div className="text-center text-3xl font-magic mb-6">Manage Reflection Token</div>

                        {/* Token Input Section */}
                        <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-bold mb-4 text-white">1. Find Your Token</h2>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    placeholder="Enter your CW20 token address (inj1...)"
                                    className="text-black w-full rounded p-2 text-sm"
                                    value={tokenAddress}
                                    onChange={(e) => setTokenAddress(e.target.value)}
                                />
                                <button
                                    onClick={handleQueryToken}
                                    disabled={querying || !tokenAddress}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 text-white font-semibold w-28"
                                >
                                    {querying ? <CircleLoader size={20} color="#fff" /> : "Query Token"}
                                </button>
                            </div>
                        </div>

                        {error && <div className="my-4 text-red-500 text-center">{error}</div>}

                        {tokenInfo && taxRates && (
                            <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Token Info Section */}
                                    <div>
                                        <h3 className="text-lg font-bold mb-3 text-white">Token Information</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between"><span>Name:</span> <span className="font-mono">{tokenInfo.name}</span></div>
                                            <div className="flex justify-between"><span>Symbol:</span> <span className="font-mono">{tokenInfo.symbol}</span></div>
                                            <div className="flex justify-between"><span>Decimals:</span> <span className="font-mono">{tokenInfo.decimals}</span></div>
                                            <div className="flex justify-between"><span>Total Supply:</span> <span className="font-mono">{new BigNumberInWei(tokenInfo.total_supply).toBase(tokenInfo.decimals).toFormat()}</span></div>
                                        </div>
                                    </div>
                                    {/* Tax Rates Section */}
                                    <div>
                                        <h3 className="text-lg font-bold mb-3 text-white">Current Tax Rates</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between"><span>Global Tax:</span> <span className="font-mono">{(parseFloat(taxRates.global_rate) * 100).toFixed(2)}%</span></div>
                                            <div className="flex justify-between"><span>Reflection Rate:</span> <span className="font-mono">{(parseFloat(taxRates.reflection_rate) * 100).toFixed(2)}%</span></div>
                                            <div className="flex justify-between"><span>Burn Rate:</span> <span className="font-mono">{(parseFloat(taxRates.burn_rate) * 100).toFixed(2)}%</span></div>
                                            <div className="flex justify-between"><span>Anti-Whale:</span> <span className="font-mono">{(parseFloat(taxRates.antiwhale_rate) * 100).toFixed(2)}%</span></div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs mt-4">Treasury Address: <code className="bg-slate-700 p-1 rounded">{treasuryAddress}</code></p>
                            </div>
                        )}

                        {treasuryAddress && (
                            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
                                <h2 className="text-xl font-bold mb-4 text-white">2. Manage Whitelist</h2>
                                <p className="text-xs mb-4">Check the status of an address or add/remove it from the tax-free whitelist.</p>

                                {/* Input for address to check/manage */}
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Enter address to check or manage (inj1...)"
                                        className="text-black w-full rounded p-2 text-sm"
                                        value={manageAddress}
                                        onChange={(e) => {
                                            setManageAddress(e.target.value);
                                            setIsWhitelisted(null); // Reset status on new input
                                        }}
                                    />
                                    <button
                                        onClick={handleCheckWhitelistStatus}
                                        disabled={checkingStatus || !manageAddress}
                                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 rounded-lg p-2 text-white font-semibold w-32"
                                    >
                                        {checkingStatus ? <CircleLoader size={20} color="#fff" /> : "Check Status"}
                                    </button>
                                </div>

                                {/* Status and Action Buttons */}
                                {isWhitelisted !== null && (
                                    <div className="mt-4 p-4 bg-slate-700 rounded-lg text-center">
                                        {isWhitelisted ? (
                                            <div className="flex items-center justify-center text-green-400">
                                                <FaCheckCircle className="mr-2" />
                                                <span>Address is whitelisted.</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center text-yellow-400">
                                                <FaMinusCircle className="mr-2" />
                                                <span>Address is not whitelisted.</span>
                                            </div>
                                        )}

                                        <div className="mt-4 flex justify-center space-x-4">
                                            {!isWhitelisted && (
                                                <button
                                                    onClick={() => handleWhitelistUpdate(manageAddress, true)}
                                                    disabled={loading}
                                                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 rounded-lg p-2 text-white w-32"
                                                >
                                                    {loading ? <CircleLoader size={20} color="#fff" /> : "Add to Whitelist"}
                                                </button>
                                            )}
                                            {isWhitelisted && (
                                                <button
                                                    onClick={() => handleWhitelistUpdate(manageAddress, false)}
                                                    disabled={loading}
                                                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-500 rounded-lg p-2 text-white w-36"
                                                >
                                                    {loading ? <CircleLoader size={20} color="#fff" /> : "Remove from Whitelist"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ManageExistingReflectionToken;