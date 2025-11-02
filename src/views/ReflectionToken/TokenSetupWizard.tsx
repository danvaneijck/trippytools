// src/pages/cw20-reflection/TokenSetupWizard.tsx

import { ChainGrpcWasmApi, MsgExecuteContract } from "@injectivelabs/sdk-ts";
import { useCallback, useEffect, useState } from "react";
import useWalletStore from "../../store/useWalletStore";
import { performTransaction } from "../../utils/walletStrategy";
import useNetworkStore from "../../store/useNetworkStore";
import { CircleLoader } from "react-spinners";
import { FaTimesCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { BigNumberInBase, BigNumberInWei } from "@injectivelabs/utils";
import { Buffer } from "buffer";
import TokenUtils from "../../modules/tokenUtils";

interface TokenSetupWizardProps {
    tokenAddress: string;
    treasuryAddress: string;
    tokenDecimals: number;
    initialTaxRates: {
        globalRate: number;
        reflectionRate: number;
        burnRate: number;
        antiwhaleRate: number;
    };
}

const MAINNET_DEX_FACTORY_ADDRESS = "inj1k9lcqtn3y92h4t3tdsu7z8qx292mhxhgsssmxg";
const MAINNET_DEX_ADAPTER_ADDRESS = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk";
const MAINNET_SEND_AUCTION_ADDRESS = "inj1yr7srge0lku4h3gd473qdlpdfw63ejdjwkh4c0";
const MAINNET_AGGREGATOR_ADDRESS = "inj1a4qvqym6ajewepa7v8y2rtxuz9f92kyq2zsg26";

const TESTNET_DEX_FACTORY_ADDRESS = "inj150qeu7h9ktn2aqz94tepsh089u63nasfc2t6sw";
const TESTNET_DEX_ADAPTER_ADDRESS = "inj1kjmmqkl3jrgzq70026xhcvfxeysgjs0mr44pp4";
const TESTNET_AGGREGATOR_ADDRESS = "inj1sw8yrju07xe59v60xcs76tej5svwc3fwgzqc7t";
const TESTNET_SEND_AUCTION_ADDRESS = "inj1xdc0n3jljz4uupwjjmlz76c3dtc3cpma8vr6f8";

const INJ_DENOM = "inj";
const INJ_DECIMALS = 18;

const TokenSetupWizard = ({ tokenAddress, treasuryAddress, tokenDecimals, initialTaxRates }: TokenSetupWizardProps) => {
    const { connectedWallet } = useWalletStore();
    const { network, networkKey } = useNetworkStore();

    // --- State for UI & Logic ---
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState("");

    const [stepSuccess, setStepSuccess] = useState({
        whitelistInfra: false,
        createPair: false,
        setTax: false,
        registerAdapter: false,
        configureTreasury: false,
        addAggregator: false,
        addTransferRecipient: false,
    });

    // --- State for Step 2 (Whitelist) ---
    const getInitialWhitelist = () => networkKey === 'mainnet'
        ? [MAINNET_DEX_FACTORY_ADDRESS, MAINNET_DEX_ADAPTER_ADDRESS, MAINNET_SEND_AUCTION_ADDRESS]
        : [TESTNET_DEX_FACTORY_ADDRESS, TESTNET_DEX_ADAPTER_ADDRESS, TESTNET_SEND_AUCTION_ADDRESS];

    const [aggregatorAddress, setAggregatorAddress] = useState(networkKey === 'mainnet' ? MAINNET_AGGREGATOR_ADDRESS : TESTNET_AGGREGATOR_ADDRESS);


    const [whitelistAddresses, setWhitelistAddresses] = useState<string[]>(getInitialWhitelist);
    const [currentWhitelistInput, setCurrentWhitelistInput] = useState("");

    // --- State for Step 3 (Create Pool) ---
    const [baseAmount, setBaseAmount] = useState("");
    const [quoteAmount, setQuoteAmount] = useState("");
    const [baseBalance, setBaseBalance] = useState("0");
    const [quoteBalance, setQuoteBalance] = useState("0");
    const [allowanceApproved, setAllowanceApproved] = useState(false);
    const [newPairAddress, setNewPairAddress] = useState<string | null>(null);
    const [reflectionPairAddress, setReflectionPairAddress] = useState("");

    const [needsAdapterRegistration, setNeedsAdapterRegistration] = useState(true);
    const [adapterFee, setAdapterFee] = useState(null);
    const [checkingAdapter, setCheckingAdapter] = useState(true);


    useEffect(() => {
        if (newPairAddress) {
            setReflectionPairAddress(newPairAddress);
        }
    }, [newPairAddress]);

    useEffect(() => {
        const checkAdapterRegistration = async () => {
            if (!network) return;
            setCheckingAdapter(true);
            const wasmApi = new ChainGrpcWasmApi(network.grpc);
            const adapterAddress = networkKey === 'mainnet' ? MAINNET_DEX_ADAPTER_ADDRESS : TESTNET_DEX_ADAPTER_ADDRESS;

            try {
                // Check if already registered
                const registeredQuery = Buffer.from(JSON.stringify({ registered_contracts: {} })).toString("base64");
                const registeredInfo = await wasmApi.fetchSmartContractState(adapterAddress, registeredQuery);
                const registeredList = JSON.parse(Buffer.from(registeredInfo.data).toString('utf8'));

                if (registeredList.includes(tokenAddress)) {
                    setNeedsAdapterRegistration(false);
                    setStepSuccess(prev => ({ ...prev, registerAdapter: true })); // Auto-complete the step
                } else {
                    // If not registered, get the fee
                    setNeedsAdapterRegistration(true);
                    const feeQuery = Buffer.from(JSON.stringify({ new_denom_fee: {} })).toString("base64");
                    const feeInfo = await wasmApi.fetchSmartContractState(adapterAddress, feeQuery);
                    const feeData = JSON.parse(Buffer.from(feeInfo.data).toString('utf8'));

                    setAdapterFee(feeData[0]); // The fee is returned as an array with one Coin object
                }
            } catch (e: any) {
                setError("Could not check CW20 Adapter status. Please refresh and try again.");
                console.error(e);
            } finally {
                setCheckingAdapter(false);
            }
        };

        void checkAdapterRegistration();
    }, [network, networkKey, tokenAddress]);


    // --- Balance Fetching ---
    useEffect(() => {
        const fetchBalances = async () => {
            if (!connectedWallet || !network) return;
            const wasmApi = new ChainGrpcWasmApi(network.grpc);
            const module = new TokenUtils(network);

            try {
                // Fetch base token (your CW20) balance
                const baseResponse = await wasmApi.fetchSmartContractState(
                    tokenAddress,
                    Buffer.from(JSON.stringify({ balance: { address: connectedWallet } })).toString('base64')
                );
                const baseBalanceData = JSON.parse(Buffer.from(baseResponse.data).toString('utf8'));
                setBaseBalance(baseBalanceData.balance);

                // Fetch quote token (INJ) balance
                const inj = await module.getBalanceOfToken("inj", connectedWallet)
                setQuoteBalance(inj.amount);
                setError(null)
            } catch (e: any) {
                setError("Could not fetch token balances.");
                console.error(e);
            }
        };
        void fetchBalances();
    }, [connectedWallet, network, tokenAddress]);

    // --- A new function to handle a batch of messages ---
    const handleExecuteBatch = useCallback(async (msgs, successCallback?: (result: any) => void) => {
        if (!connectedWallet || msgs.length === 0) return;
        setLoading(true);
        setError(null);
        setProgress("Preparing and signing transaction...");
        try {
            const result = await performTransaction(connectedWallet, msgs);
            setProgress(`Transaction successful!`);
            toast.success("Transaction successful!", { theme: "dark" });
            if (successCallback) successCallback(result);
        } catch (e: any) {
            setError(e.message);
            toast.error(e.message, { theme: "dark" });
            setProgress("");
        } finally {
            setLoading(false);
        }
    }, [connectedWallet]);

    const handleAddAggregator = () => {
        if (!connectedWallet || !aggregatorAddress) {
            setError("Wallet not connected or aggregator address is missing.");
            return;
        }

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: tokenAddress,
            sender: connectedWallet,
            msg: { add_aggregator: { address: aggregatorAddress } },
        });

        void handleExecuteBatch([msg], () => setStepSuccess(prev => ({ ...prev, addAggregator: true })));
    };

    const handleRegisterOnAdapter = useCallback(async () => {
        if (!connectedWallet || !adapterFee) {
            setError("Cannot register: Wallet not connected or fee not loaded.");
            return;
        }
        const adapterAddress = networkKey === 'mainnet' ? MAINNET_DEX_ADAPTER_ADDRESS : TESTNET_DEX_ADAPTER_ADDRESS;

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: adapterAddress,
            sender: connectedWallet,
            msg: { register_cw20_contract: { addr: tokenAddress } },
            funds: adapterFee,
        });

        await handleExecuteBatch([msg], () => {
            setNeedsAdapterRegistration(false);
            setStepSuccess(prev => ({ ...prev, registerAdapter: true }));
        });
    }, [adapterFee, connectedWallet, handleExecuteBatch, networkKey, tokenAddress]);

    // Handler for setting tax rates (no changes needed)
    const handleSetTaxRates = useCallback(() => {
        if (!connectedWallet) {
            setError("Wallet not connected.");
            return;
        }

        const taxMsg = {
            set_tax_rate: {
                global_rate: String(initialTaxRates.globalRate),
                reflection_rate: String(initialTaxRates.reflectionRate),
                burn_rate: String(initialTaxRates.burnRate),
                antiwhale_rate: String(initialTaxRates.antiwhaleRate)
            }
        };

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: tokenAddress,
            sender: connectedWallet,
            msg: taxMsg,
        });

        // Use the primary batch execution function with the success callback
        void handleExecuteBatch([msg], () => setStepSuccess(prev => ({ ...prev, setTax: true })));
    }, [connectedWallet, handleExecuteBatch, initialTaxRates.antiwhaleRate, initialTaxRates.burnRate,
        initialTaxRates.globalRate, initialTaxRates.reflectionRate, tokenAddress]);

    // --- UI handlers for managing the whitelist input ---
    const handleAddWhitelistAddress = () => {
        if (currentWhitelistInput && !whitelistAddresses.includes(currentWhitelistInput) && currentWhitelistInput.startsWith("inj1")) {
            setWhitelistAddresses([...whitelistAddresses, currentWhitelistInput]);
            setCurrentWhitelistInput(""); // Clear the input field
        }
    };

    const handleRemoveWhitelistAddress = (addressToRemove: string) => {
        setWhitelistAddresses(whitelistAddresses.filter(addr => addr !== addressToRemove));
    };

    // --- Updated handler to submit the entire list of whitelist addresses ---
    const handleSetWhitelist = useCallback(() => {
        if (whitelistAddresses.length === 0) {
            setError("Please add at least one address to whitelist.");
            return;
        }

        const whitelistMsgs = whitelistAddresses.map(address => {
            return MsgExecuteContract.fromJSON({
                contractAddress: tokenAddress,
                sender: connectedWallet!,
                msg: { set_whitelist: { user: address, enable: true } },
            });
        });

        void handleExecuteBatch(whitelistMsgs, () => setStepSuccess(prev => ({ ...prev, whitelistInfra: true })));
    }, [connectedWallet, handleExecuteBatch, tokenAddress, whitelistAddresses]);

    const handleApproveAllowance = useCallback(() => {
        const factoryAddress = networkKey === 'mainnet' ? MAINNET_DEX_FACTORY_ADDRESS : TESTNET_DEX_FACTORY_ADDRESS;
        const amount = new BigNumberInBase(baseAmount).toWei(tokenDecimals).toFixed();

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: tokenAddress,
            sender: connectedWallet!,
            msg: { increase_allowance: { spender: factoryAddress, amount } },
        });

        void handleExecuteBatch([msg], () => setAllowanceApproved(true));
    }, [baseAmount, connectedWallet, handleExecuteBatch, networkKey, tokenAddress, tokenDecimals]);

    const handleCreatePair = useCallback(async () => {
        const factoryAddress = networkKey === 'mainnet' ? MAINNET_DEX_FACTORY_ADDRESS : TESTNET_DEX_FACTORY_ADDRESS;
        const baseTokenAmount = new BigNumberInBase(baseAmount).toWei(tokenDecimals).toFixed();
        const quoteTokenAmount = new BigNumberInBase(quoteAmount).toWei(INJ_DECIMALS).toFixed();

        const createPairMsg = {
            create_pair: {
                assets: [
                    { info: { token: { contract_addr: tokenAddress } }, amount: baseTokenAmount },
                    { info: { native_token: { denom: INJ_DENOM } }, amount: quoteTokenAmount },
                ],
            },
        };

        // Note: The factory creation fee is typically sent with the native token amount.
        // Assuming a 0.1 INJ fee for this example. Adjust if needed.
        const fee = networkKey == "testnet" ? 1 : 0.1
        const creationFee = new BigNumberInBase(fee).toWei(INJ_DECIMALS);
        const totalInjToSend = new BigNumberInBase(quoteTokenAmount).plus(creationFee).toFixed();

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: factoryAddress,
            sender: connectedWallet!,
            msg: createPairMsg,
            funds: { denom: INJ_DENOM, amount: totalInjToSend },
        });

        await handleExecuteBatch([msg], (result) => {
            // After success, parse the new pair address from the transaction logs
            try {
                const events = result?.events || (result?.rawLog && JSON.parse(result.rawLog)[0].events);
                let pairAddr: string | null = null;
                for (const event of events) {
                    if (event.type === 'instantiate' || event.type === 'instantiate_contract') {
                        // The factory creates a new contract (the pair), so we look for its address
                        const addressAttr = event.attributes.find((attr: any) => attr.key === '_contract_address' || attr.key === 'contract_address');
                        // You might need to add more logic here if other contracts are instantiated
                        if (addressAttr) {
                            pairAddr = addressAttr.value;
                            break;
                        }
                    }
                }
                if (pairAddr) {
                    setNewPairAddress(pairAddr);
                    setStepSuccess(prev => ({ ...prev, createPair: true }));
                } else {
                    throw new Error("Could not find the new pair address in the transaction result.");
                }
            } catch (e: any) {
                setError(e.message);
                toast.error("Pair created, but failed to parse its address automatically.", { theme: "dark" });
            }
        });
    }, [baseAmount, connectedWallet, handleExecuteBatch, networkKey, quoteAmount, tokenAddress, tokenDecimals]);

    const handleAddTransferFromRecipient = useCallback(() => {
        if (!connectedWallet || !newPairAddress) {
            setError("Wallet not connected or the pair address has not been set.");
            return;
        }

        const msg = MsgExecuteContract.fromJSON({
            contractAddress: tokenAddress,
            sender: connectedWallet,
            msg: { add_transfer_from_recipient: { address: newPairAddress } },
        });

        void handleExecuteBatch([msg], () => setStepSuccess(prev => ({ ...prev, addTransferRecipient: true })));
    }, [connectedWallet, handleExecuteBatch, newPairAddress, tokenAddress]);

    // --- Step 4 Handler ---
    const handleSetPairs = useCallback(() => {
        if (!treasuryAddress || !newPairAddress || !reflectionPairAddress) {
            setError("The liquidity and reflection pair addresses must be set.");
            return;
        }

        const asset_infos = [
            { token: { contract_addr: tokenAddress } },
            { native_token: { denom: INJ_DENOM } }
        ];

        const msgs = [
            // Liquidity pair is ALWAYS the newly created pair
            MsgExecuteContract.fromJSON({
                contractAddress: treasuryAddress,
                sender: connectedWallet!,
                msg: { set_liquidity_pair: { asset_infos, pair_contract: newPairAddress } },
            }),
            // Reflection pair uses the (potentially user-modified) value from the input
            MsgExecuteContract.fromJSON({
                contractAddress: treasuryAddress,
                sender: connectedWallet!,
                msg: { set_reflection_pair: { asset_infos, pair_contract: reflectionPairAddress } },
            })
        ];

        void handleExecuteBatch(msgs, () => setStepSuccess(prev => ({ ...prev, configureTreasury: true })));
    }, [connectedWallet, handleExecuteBatch, newPairAddress, reflectionPairAddress, tokenAddress, treasuryAddress]);


    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-6">
            <h2 className="text-xl font-bold mb-2 text-white">Post-Launch Setup Wizard</h2>
            <p className="text-xs mb-4">Token: <code className="bg-slate-700 p-1 rounded">{tokenAddress}</code></p>
            <p className="text-xs mb-4">Treasury: <code className="bg-slate-700 p-1 rounded">{treasuryAddress}</code></p>

            {loading && <div className="text-center"><CircleLoader color="#36d7b7" className="mt-4 m-auto" /></div>}
            {progress && <div className="my-4 text-green-400 text-center">{progress}</div>}
            {error && <div className="my-4 text-red-500 text-center">{error}</div>}

            {/* Step 1: Set Tax Rate */}
            <div className={`p-4 rounded-md mt-4 ${stepSuccess.setTax ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 1: Set Tax Rates</h3>
                <p className="text-xs mb-2">Confirm the tax rates you selected during launch.</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-slate-700 p-3 rounded-md my-3">
                    <div><span className="font-semibold">Global Tax:</span> {(initialTaxRates.globalRate * 100).toFixed(2)}%</div>
                    <div><span className="font-semibold">Reflection:</span> {(initialTaxRates.reflectionRate * 100).toFixed(2)}%</div>
                    <div><span className="font-semibold">Burn:</span> {(initialTaxRates.burnRate * 100).toFixed(2)}%</div>
                    <div><span className="font-semibold">Anti-Whale:</span> {(initialTaxRates.antiwhaleRate * 100).toFixed(2)}%</div>
                </div>
                <button
                    onClick={handleSetTaxRates}
                    disabled={loading || stepSuccess.setTax}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-2 shadow-lg transition-colors"
                >
                    {stepSuccess.setTax ? "✓ Rates Set" : "Set Tax Rates"}
                </button>
            </div>

            {/* Step 2: Whitelist Addresses */}
            <div className={`p-4 rounded-md mt-4 transition-opacity ${stepSuccess.setTax ? 'opacity-100' : 'opacity-50 cursor-not-allowed'}  ${stepSuccess.whitelistInfra ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 2: Whitelist DEX Contracts</h3>
                {!stepSuccess.setTax && <p className="text-xs text-yellow-400">Complete Step 1 to enable this step.</p>}
                <div className={`${!stepSuccess.setTax || stepSuccess.whitelistInfra ? 'pointer-events-none opacity-60' : ''}`}>
                    <p className="text-xs mb-2">
                        Whitelist addresses like the DEX factory, cw20 adapter and send to auction contracts to exempt them from taxes.
                    </p>
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder="Enter address (e.g., inj1...)"
                            className="text-black w-full rounded p-2 text-sm"
                            value={currentWhitelistInput}
                            onChange={(e) => setCurrentWhitelistInput(e.target.value)}
                        />
                        <button
                            onClick={handleAddWhitelistAddress}
                            className="bg-indigo-600 hover:bg-indigo-700 rounded-lg p-2 text-white text-sm"
                        >
                            Add
                        </button>
                    </div>
                    {whitelistAddresses.length > 0 && (
                        <div className="mt-3 space-y-1">
                            {whitelistAddresses.map((addr) => (
                                <div key={addr} className="flex items-center justify-between bg-slate-600 p-2 rounded">
                                    <code className="text-xs">{addr}</code>
                                    <button onClick={() => handleRemoveWhitelistAddress(addr)}>
                                        <FaTimesCircle className="h-5 w-5 text-red-400 hover:text-red-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={handleSetWhitelist}
                        disabled={loading || whitelistAddresses.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-4 shadow-lg transition-colors"
                    >
                        {`Whitelist ${whitelistAddresses.length} Address(es)`}
                    </button>
                </div>
                {stepSuccess.whitelistInfra && <div className="text-center text-green-400 mt-2">✓ Addresses Whitelisted.</div>}
            </div>

            {/* Step 3: Register Aggregation Contract */}
            <div className={`p-4 rounded-md mt-4 transition-opacity ${stepSuccess.whitelistInfra ? 'opacity-100' : 'opacity-50 cursor-not-allowed'} ${stepSuccess.addAggregator ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 3: Register Aggregation Contract</h3>
                {!stepSuccess.whitelistInfra && <p className="text-xs text-yellow-400">Complete Step 2 to enable this step.</p>}
                <div className={`${!stepSuccess.whitelistInfra || stepSuccess.addAggregator ? 'pointer-events-none opacity-60' : ''}`}>
                    <p className="text-xs mb-2">Register a trusted aggregator contract for tax-free swaps. This is required for Choice DEX integration.</p>
                    <input
                        type="text"
                        placeholder="Enter aggregator address"
                        className="text-black w-full rounded p-2 text-sm"
                        value={aggregatorAddress}
                        onChange={(e) => setAggregatorAddress(e.target.value)}
                    />
                    <button
                        onClick={handleAddAggregator}
                        disabled={loading || !aggregatorAddress}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-2 shadow-lg transition-colors"
                    >
                        Register Aggregator
                    </button>
                </div>
                {stepSuccess.addAggregator && <div className="text-center text-green-400 mt-2">✓ Aggregator Registered.</div>}
            </div>

            {/* Step 4: Register on CW20 Adapter */}
            <div className={`p-4 rounded-md mt-4 transition-opacity ${stepSuccess.addAggregator ? 'opacity-100' : 'opacity-50 cursor-not-allowed'} ${stepSuccess.registerAdapter ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 4: Register on CW20 Adapter</h3>
                {!stepSuccess.addAggregator && <p className="text-xs text-yellow-400">Complete Step 3 to enable this step.</p>}
                <div className={`${!stepSuccess.addAggregator || stepSuccess.registerAdapter ? 'pointer-events-none opacity-60' : ''}`}>
                    {checkingAdapter ? (
                        <p className="text-xs text-slate-300 mt-2">Checking registration status...</p>
                    ) : needsAdapterRegistration ? (
                        <>
                            <p className="text-xs text-yellow-400 mt-2 mb-2">
                                Your token must be registered on the Injective CW20 Adapter before creating a pool.
                                {adapterFee && ` The one-time fee is ${new BigNumberInWei((adapterFee as any).amount).toBase(INJ_DECIMALS)} ${((adapterFee as any).denom).toUpperCase()}.`}
                            </p>
                            <button onClick={() => void handleRegisterOnAdapter()} disabled={loading || !adapterFee} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-2 shadow-lg transition-colors">
                                Register Token
                            </button>
                        </>
                    ) : null}
                </div>
                {stepSuccess.registerAdapter && !needsAdapterRegistration && <div className="text-center text-green-400 mt-2">✓ Token is registered on the CW20 Adapter.</div>}
            </div>

            {/* Step 5: Create Liquidity Pool */}
            <div className={`p-4 rounded-md mt-4 transition-opacity ${stepSuccess.registerAdapter ? 'opacity-100' : 'opacity-50 cursor-not-allowed'} ${stepSuccess.createPair ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 5: Create Liquidity Pool</h3>
                {!stepSuccess.registerAdapter && <p className="text-xs text-yellow-400">Complete Step 4 to enable this step.</p>}
                <div className={`space-y-4 mt-2 ${!stepSuccess.registerAdapter || stepSuccess.createPair ? 'pointer-events-none opacity-60' : ''}`}>
                    <div>
                        <label className="text-base font-bold">Your Token Amount</label>
                        <span className="text-xs block">
                            Balance: {new BigNumberInWei(baseBalance).toBase(tokenDecimals).toFixed(4)}
                        </span>
                        <input type="number" value={baseAmount} onChange={e => setBaseAmount(e.target.value)}
                            className="text-black w-full rounded p-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-base font-bold">INJ Amount</label>
                        <span className="text-xs block">
                            Balance: {new BigNumberInWei(quoteBalance).toBase(INJ_DECIMALS).toFixed(4)}
                        </span>
                        <input
                            type="number" value={quoteAmount}
                            onChange={e => setQuoteAmount(e.target.value)}
                            className="text-black w-full rounded p-2 text-sm"
                        />
                    </div>
                    {!allowanceApproved ? (
                        <button
                            onClick={handleApproveAllowance} disabled={loading || !baseAmount}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-2 shadow-lg transition-colors">
                            1. Approve Token spending
                        </button>
                    ) : (
                        <p className="text-green-400 text-center">✓ Token spending approved</p>
                    )}
                    <button
                        onClick={() => void handleCreatePair()} disabled={loading || !allowanceApproved || !baseAmount || !quoteAmount}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-2 shadow-lg transition-colors">
                        2. Create Pool
                    </button>
                </div>
                {stepSuccess.createPair && <div className="text-center text-green-400 mt-2">✓ Pool created successfully at: <code className="text-xs">{newPairAddress}</code></div>}
            </div>

            {/* Step 6: Enable Tax-Free Liquidity Provision */}
            <div className={`p-4 rounded-md mt-4 transition-opacity ${stepSuccess.createPair ? 'opacity-100' : 'opacity-50 cursor-not-allowed'} ${stepSuccess.addTransferRecipient ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 6: Enable Tax-Free Liquidity Provision</h3>
                {!stepSuccess.createPair && <p className="text-xs text-yellow-400">Complete Step 5 to enable this step.</p>}
                <div className={`${!stepSuccess.createPair || stepSuccess.addTransferRecipient ? 'pointer-events-none opacity-60' : ''}`}>
                    <p className="text-xs mb-2">
                        Whitelist the newly created pair for tax free "transfer_from" messages to allow tax-free liquidity provision.
                    </p>
                    <button
                        onClick={handleAddTransferFromRecipient}
                        disabled={loading || !newPairAddress}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-2 shadow-lg transition-colors"
                    >
                        Enable Tax-Free Liquidity
                    </button>
                </div>
                {stepSuccess.addTransferRecipient && <div className="text-center text-green-400 mt-2">✓ Tax-free liquidity provision enabled for the pair.</div>}
            </div>

            {/* Step 7: Configure Treasury */}
            <div className={`p-4 rounded-md mt-4 transition-opacity ${stepSuccess.addTransferRecipient ? 'opacity-100' : 'opacity-50 cursor-not-allowed'} ${stepSuccess.configureTreasury ? 'bg-green-900' : 'bg-slate-700'}`}>
                <h3 className="font-bold">Step 7: Configure Treasury</h3>
                {!stepSuccess.addTransferRecipient && <p className="text-xs text-yellow-400">Complete Step 6 to enable this step.</p>}

                <div className={`space-y-4 mt-2 ${!stepSuccess.addTransferRecipient || stepSuccess.configureTreasury ? 'pointer-events-none opacity-60' : ''}`}>
                    <div>
                        <label className="block text-base font-bold text-white">Liquidity Pair Address</label>
                        <span className="text-xs text-slate-300">
                            This is automatically set to the pool you created in Step 5.
                        </span>
                        <div className="bg-slate-700 p-2 rounded mt-1">
                            <code className="text-sm text-slate-300">{newPairAddress || "Complete previous steps"}</code>
                        </div>
                    </div>
                    <div>
                        <label className="block text-base font-bold text-white">Reflection Pair Address</label>
                        <span className="text-xs text-slate-300">
                            This is for swapping reflection rewards. It's pre-filled but can be changed to a different pool if needed.
                        </span>
                        <input
                            type="text"
                            placeholder="Enter Reflection Pair Address"
                            className="text-black w-full rounded p-2 text-sm mt-1"
                            value={reflectionPairAddress}
                            onChange={(e) => setReflectionPairAddress(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleSetPairs}
                        disabled={loading || !newPairAddress || !reflectionPairAddress}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 rounded-lg p-2 w-full text-white mt-4 shadow-lg transition-colors"
                    >
                        Configure Treasury
                    </button>
                </div>
                {stepSuccess.configureTreasury && <div className="text-center text-green-400 mt-2">✓ Treasury configured!</div>}
            </div>

            {stepSuccess.configureTreasury &&
                <div className="mt-6 text-center text-lg font-bold text-green-400">
                    Setup Complete! Your reflection token is fully configured.
                </div>
            }
        </div>
    );
};

export default TokenSetupWizard;