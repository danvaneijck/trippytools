import { MsgInstantiateContract } from "@injectivelabs/sdk-ts";
import { BigNumberInBase } from "@injectivelabs/utils";
import { useCallback, useState } from "react";
import { CircleLoader } from "react-spinners";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import { sendTelegramMessage } from "../../modules/telegram";
import IPFSImage from "../../components/App/IpfsImage";
import { MdImageNotSupported } from "react-icons/md";

// NOTE: Replace with your mainnet code IDs when available
const TESTNET_REFLECTION_TOKEN_CODE_ID = 38905
const TESTNET_TREASURY_CODE_ID = 38906
const TESTNET_ROUTER_ADDRESS = "inj1tmzr3d0whrdgrgl08fu3kggqaesaazww247rd2"

const MAINNET_REFLECTION_TOKEN_CODE_ID = 0; // Replace with actual
const MAINNET_TREASURY_CODE_ID = 0; // Replace with actual
const MAINNET_ROUTER_ADDRESS = "inj1ne2durmsx2jurvy4wgnhegv3xt6789up8xgum3" // Replace with actual if different

interface ReflectionTokenConfirmModalProps {
    setShowModal: (show: boolean) => void;
    onLaunchSuccess: (addresses: { tokenAddress: string; treasuryAddress: string }) => void;
    tokenName: string;
    tokenSymbol: string;
    tokenSupply: number;
    tokenDecimals: number;
    tokenImage: string;
    tokenDescription: string;
    globalRate: number;
    reflectionRate: number;
    burnRate: number;
    antiwhaleRate: number;
}

/**
 * Parses the transaction result to find the instantiated contract address.
 * @param txResult The result object from the transaction.
 * @returns The new contract address or null if not found.
 */
const parseInstantiationAddresses = (
    txResult: any,
    tokenCodeId: number,
    treasuryCodeId: number
): { tokenAddress: string; treasuryAddress: string } | null => {
    try {
        const events = txResult?.events || (txResult?.rawLog && JSON.parse(txResult.rawLog)[0].events);
        if (!events) {
            console.error("No events found in transaction result");
            return null;
        }

        let tokenAddress: string | null = null;
        let treasuryAddress: string | null = null;

        for (const event of events) {
            if (event.type === 'instantiate' || event.type === 'instantiate_contract') {
                const addressAttr = event.attributes.find((attr: any) => attr.key === '_contract_address' || attr.key === 'contract_address');
                const codeIdAttr = event.attributes.find((attr: any) => attr.key === 'code_id');

                if (addressAttr && codeIdAttr) {
                    const codeId = parseInt(codeIdAttr.value, 10);
                    if (codeId === tokenCodeId) {
                        tokenAddress = addressAttr.value;
                    } else if (codeId === treasuryCodeId) {
                        treasuryAddress = addressAttr.value;
                    }
                }
            }
        }

        if (tokenAddress && treasuryAddress) {
            return { tokenAddress, treasuryAddress };
        }
    } catch (e) {
        console.error("Error parsing transaction result for contract addresses:", e);
    }
    return null;
};

const ReflectionTokenConfirmModal = (props: ReflectionTokenConfirmModalProps) => {
    const { connectedWallet } = useWalletStore();
    const { networkKey } = useNetworkStore();

    const [progress, setProgress] = useState("");
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createReflectionToken = useCallback(async () => {
        if (!connectedWallet) return;
        setError(null);
        setTxLoading(true);
        setProgress("Preparing transaction...");

        const reflectionTokenCodeId = networkKey === 'mainnet' ? MAINNET_REFLECTION_TOKEN_CODE_ID : TESTNET_REFLECTION_TOKEN_CODE_ID;
        const treasuryCodeId = networkKey === 'mainnet' ? MAINNET_TREASURY_CODE_ID : TESTNET_TREASURY_CODE_ID;
        const routerAddress = networkKey === 'mainnet' ? MAINNET_ROUTER_ADDRESS : TESTNET_ROUTER_ADDRESS;

        const instantiateMsg = {
            name: props.tokenName,
            symbol: props.tokenSymbol,
            decimals: props.tokenDecimals,
            cw20_code_id: treasuryCodeId,
            initial_balances: [
                {
                    address: connectedWallet,
                    amount: new BigNumberInBase(props.tokenSupply).toWei(props.tokenDecimals).toFixed(),
                },
            ],
            admin: connectedWallet,
            router: routerAddress,
            mint: null,
            marketing: {
                project: "Reflection Token",
                description: props.tokenDescription,
                marketing: connectedWallet,
                logo: props.tokenImage ? { url: props.tokenImage } : null,
            },
        };

        const msg = MsgInstantiateContract.fromJSON({
            sender: connectedWallet,
            admin: connectedWallet,
            codeId: reflectionTokenCodeId,
            label: `${props.tokenSymbol}-reflection-token`,
            msg: instantiateMsg,
        });

        setProgress("Please sign the transaction in your wallet...");
        try {
            const txResult = await performTransaction(connectedWallet, msg);

            setProgress("Transaction successful! Parsing contract address...");
            const addresses = parseInstantiationAddresses(txResult, reflectionTokenCodeId, treasuryCodeId);

            if (addresses) {
                setProgress(`Token & Treasury created successfully!`);
                if (networkKey === "mainnet") {
                    await sendTelegramMessage(
                        `New Reflection Token created!\nName: ${props.tokenName}\nAddress: ${addresses.tokenAddress}`
                    );
                }
                // Use the new callback to notify the parent with both addresses
                props.onLaunchSuccess(addresses);
            } else {
                throw new Error("Could not parse the new contract address from the transaction. Please check the transaction on an explorer.");
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setProgress("");
        } finally {
            setTxLoading(false);
        }

    }, [connectedWallet, networkKey, props]);

    return (
        <>
            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none text-white text-sm">
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-none focus:outline-none">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">Confirm Token Launch on {networkKey}</h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-span-2 text-lg font-bold">Token Details</h4>
                                <div>Name: <span className="font-mono">{props.tokenName}</span></div>
                                <div>Symbol: <span className="font-mono">{props.tokenSymbol}</span></div>
                                <div>Supply: <span className="font-mono">{props.tokenSupply}</span></div>
                                <div>Decimals: <span className="font-mono">{props.tokenDecimals}</span></div>
                                <div className="col-span-2">Admin: <span className="font-mono text-xs">{connectedWallet}</span></div>
                                <div className="col-span-2">
                                    {props.tokenImage ? <IPFSImage width={100} className={'rounded'} ipfsPath={props.tokenImage} /> : <MdImageNotSupported className="text-5xl text-slate-500" />}
                                </div>

                                <h4 className="col-span-2 text-lg font-bold mt-4">Tax & Features</h4>
                                <div>Global Tax: <span className="font-mono">{(props.globalRate * 100).toFixed(2)}%</span></div>
                                <div>Reflection: <span className="font-mono">{(props.reflectionRate * 100).toFixed(2)}% of tax</span></div>
                                <div>Burn: <span className="font-mono">{(props.burnRate * 100).toFixed(2)}% of tax</span></div>
                                <div>Anti-Whale: <span className="font-mono">{(props.antiwhaleRate * 100).toFixed(2)}% of supply</span></div>
                            </div>
                            {progress && <div className="mt-5 text-center">{progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-4 m-auto" />}
                            {error && <div className="text-red-500 mt-5 text-center break-words max-w-md">{error}</div>}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-400 background-transparent font-bold uppercase px-6 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                disabled={txLoading}
                                onClick={() => props.setShowModal(false)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-blue-600 text-white active:bg-blue-700 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                disabled={txLoading}
                                onClick={() => void createReflectionToken()}
                            >
                                {txLoading ? "Launching..." : "Launch Token"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    );
};

export default ReflectionTokenConfirmModal;