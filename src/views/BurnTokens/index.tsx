import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { MsgBurn } from "@injectivelabs/sdk-ts";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import useTokenStore from "../../store/useTokenStore";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { BigNumberInBase } from "@injectivelabs/utils";

const BurnTokens = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { network: networkConfig, networkKey } = useNetworkStore() // networkKey for explorer URL
    const { tokens } = useTokenStore()

    const [selectedToken, setSelectedToken] = useState(null)
    const [tokenInfo, setTokenInfo] = useState(null)
    const [balance, setBalance] = useState(null)

    const [amountToBurn, setAmountToBurn] = useState(0)
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false)
    const [txHash, setTxHash] = useState(null)
    const [copied, setCopied] = useState(false);

    const explorerBaseUrl = networkKey === 'testnet'
        ? 'https://testnet.explorer.injective.network'
        : 'https://injscan.com';

    const getTokenInfo = useCallback(async () => {
        if (!selectedToken) return

        setLoading(true)
        setError(null)
        setTokenInfo(null)
        setBalance(null)
        setAmountToBurn(0)

        const module = new TokenUtils(networkConfig)
        try {
            const info = await module.getDenomExtraMetadata(selectedToken.value)
            setTokenInfo(info)
            const balance = await module.getBalanceOfToken(selectedToken.value, connectedAddress)
            if (!balance) return
            setBalance(Number(balance.amount))
        } catch (e) {
            // Updated error message to be more generic for native tokens
            setError("Error fetching token info. Please select a valid native token.")
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [networkConfig, selectedToken, connectedAddress])

    useEffect(() => {
        if (connectedAddress && selectedToken) {
            getTokenInfo()
        }
    }, [connectedAddress, selectedToken, getTokenInfo])

    const sendBurn = useCallback(async () => {
        if (!connectedAddress) return
        if (!tokenInfo || !amountToBurn || !selectedToken) {
            setError("Please select a token and enter a valid amount to burn.");
            return
        }

        if (parseFloat(amountToBurn) <= 0) {
            setError("Amount to burn must be greater than 0.");
            return;
        }

        const amountInBase = new BigNumberInBase(amountToBurn).toWei(tokenInfo.decimals);

        if (new BigNumberInBase(balance).lt(amountInBase)) {
            setError("Insufficient balance.");
            return;
        }

        setError(null)
        setSuccess(false)
        setTxHash(null) // Reset hash before new transaction

        const injectiveAddress = connectedAddress;

        const burnMsg = MsgBurn.fromJSON({
            sender: injectiveAddress,
            amount: {
                denom: selectedToken.value,
                amount: amountInBase.toFixed(),
            },
            burnFromAddress: injectiveAddress
        });

        try {
            const result = await performTransaction(injectiveAddress, [burnMsg]);
            console.log(result)

            if (result && result.txHash) {
                setSuccess(true)
                setTxHash(result.txHash)
                setAmountToBurn(0)
                void getTokenInfo() // Refresh balance
            } else {
                setError("Transaction failed or hash not received.")
            }
        } catch (e) {
            setError(e.message || "An error occurred during the transaction.")
            console.error(e)
        } finally {
            setLoading(false)
        }

    }, [connectedAddress, amountToBurn, tokenInfo, selectedToken, balance, getTokenInfo])

    const copyToClipboard = useCallback(() => {
        if (!txHash) return;
        navigator.clipboard.writeText(`${explorerBaseUrl}/transaction/${txHash}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        });
    }, [explorerBaseUrl, txHash]);

    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">
            <div className="pt-14 md:pt-24 mx-2 pb-20">
                <div className="min-h-full mt-2 md:mt-0 ">
                    <div className="text-white text-center text-3xl font-magic">
                        Burn Tokens 🔥
                    </div>
                    <p className="text-center">Burn token factory tokens</p>

                    <div className="mt-10 w-full max-w-md mx-auto">
                        <label
                            htmlFor="token-address"
                            className="block text-white mb-2"
                        >
                            Select Token to Burn
                        </label>
                        <TokenSelect
                            options={[
                                {
                                    label: "TOKENS",
                                    options: tokens.filter(t => t.show_on_ui && (t.address.startsWith('factory/'))).map((t) => {
                                        return {
                                            value: t.address,
                                            label: t.symbol,
                                            img: t.icon
                                        }
                                    }).sort((a, b) => a.label.localeCompare(b.label))
                                }
                            ]}
                            selectedOption={selectedToken}
                            setSelectedOption={setSelectedToken}
                        />
                    </div>


                    {loading && <div className="text-center mt-5">Loading token data...</div>}

                    {tokenInfo !== null && balance !== null &&
                        <div className="text-center mt-10">
                            Your balance: {new BigNumberInBase(balance).shiftedBy(-tokenInfo.decimals).toFormat(6)} {tokenInfo.symbol}
                        </div>
                    }

                    {tokenInfo &&
                        <div className="flex flex-col justify-center mt-5">
                            <label className="text-center">Amount to burn</label>
                            <input
                                type="number"
                                className="text-black m-auto p-1 rounded"
                                value={amountToBurn}
                                onChange={(e) => setAmountToBurn(e.target.value)}
                                placeholder="0.0"
                            />
                        </div>
                    }

                    {tokenInfo !== null &&
                        <div
                            className={`bg-slate-800 w-40 m-auto mt-5 p-2 text-center rounded shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:cursor-pointer'}`}
                            onClick={!loading ? sendBurn : undefined}
                        >
                            {loading ? 'Burning...' : 'Burn Tokens'}
                        </div>
                    }

                    {error !== null &&
                        <div className="text-rose-600 text-lg mt-5 text-center">
                            {error}
                        </div>
                    }

                    {success && txHash &&
                        <div className="text-emerald-600 text-lg mt-5 text-center p-4 max-w-xl mx-auto bg-gray-800/20 rounded-lg">
                            <div>Token successfully burned!</div>
                            <div className="mt-3 text-sm text-white">
                                <p className="font-bold">Transaction Details:</p>
                                <div className="flex items-center justify-center mt-1">
                                    <a
                                        href={`${explorerBaseUrl}/transaction/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline break-all hover:text-yellow-400"
                                    >
                                        {txHash}
                                    </a>
                                    <button
                                        onClick={copyToClipboard}
                                        className="ml-3 px-2 py-1 text-xs bg-gray-600 rounded hover:bg-gray-500 transition-colors"
                                    >
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    }
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default BurnTokens;