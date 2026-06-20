import {
    MsgCreateDenom,
    MsgMint,
    MsgSetDenomMetadata,
} from "@injectivelabs/sdk-ts";
import { BigNumberInBase } from "@injectivelabs/utils";
import { useCallback, useState } from "react";
import { MdImageNotSupported } from "react-icons/md";
import { FaExternalLinkAlt, FaRegCopy } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import IPFSImage from "../../components/App/IpfsImage";
import { sendTelegramMessage } from "../../modules/telegram";
import TokenUtils from "../../modules/tokenUtils";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import { buildCreateTokenPairMsg, evmAddressUrl, PAIR_ERC20_GAS } from "../../utils/evm";
import { shortAddress } from "../../utils/format";


const TokenConfirmModal = (props: {
    tokenDescription: string;
    tokenImage: string;
    tokenDecimals: number;
    tokenSupply: number;
    tokenSymbol: string;
    tokenName: string;
    pairErc20: boolean;
    setShowModal: (arg0: boolean) => void;
}) => {

    const { connectedWallet } = useWalletStore()
    const { networkKey } = useNetworkStore()
    const networkConfig = useNetworkStore((state) => state.network);

    const navigate = useNavigate();

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Set once the launch lands; drives the success panel.
    const [result, setResult] = useState<{ denom: string; erc20: string | null } | null>(null)

    const denom = connectedWallet ? `factory/${connectedWallet}/${props.tokenSymbol}` : "";

    const createAndMint = useCallback(async () => {
        if (!connectedWallet) return
        setError(null)
        setTxLoading(true)

        const subdenom = props.tokenSymbol
        const fullDenom = `factory/${connectedWallet}/${subdenom}`;
        const { tokenSupply: amount, tokenDescription: description, tokenImage: image, tokenName: name, tokenDecimals: decimals } = props

        // Set name/symbol/decimals at creation so the auto-deployed ERC-20
        // (when pairing) mirrors them — the erc20 module reads decimals from
        // the tokenfactory denom, not from the bank metadata.
        const msgCreateDenom = MsgCreateDenom.fromJSON({
            subdenom,
            sender: connectedWallet,
            name,
            symbol: subdenom,
            decimals,
        });

        const msgMint = MsgMint.fromJSON({
            sender: connectedWallet,
            amount: {
                denom: fullDenom,
                amount: new BigNumberInBase(amount).toWei(decimals).toFixed()
            }
        });

        const msgSetDenomMetadata = MsgSetDenomMetadata.fromJSON({
            sender: connectedWallet,
            metadata: {
                base: fullDenom,
                description,
                display: subdenom,
                name,
                symbol: subdenom,
                uri: image,
                decimals,
                denomUnits: [
                    { denom: fullDenom, exponent: 0, aliases: [`u${subdenom.toLowerCase()}`] },
                    { denom: subdenom, exponent: decimals, aliases: [] },
                ],
                uriHash: ""
            }
        });

        const msgs: any[] = [msgCreateDenom, msgMint, msgSetDenomMetadata];
        if (props.pairErc20) {
            // Empty erc20_address → chain auto-deploys a MintBurnBankERC20 and
            // registers the pair. Runs after mint (the module rejects pairing a
            // zero-supply denom).
            msgs.push(buildCreateTokenPairMsg(connectedWallet, fullDenom));
        }

        setProgress(props.pairErc20 ? "Creating token + ERC-20 pair…" : "Creating token…")
        // The paired path embeds an inner EVM deploy, so pass an explicit gas
        // limit (auto-simulation under-provisions it).
        await performTransaction(
            connectedWallet,
            msgs,
            props.pairErc20 ? { gas: PAIR_ERC20_GAS } : {},
        )

        let erc20: string | null = null;
        if (props.pairErc20) {
            setProgress("Confirming ERC-20 address…")
            const utils = new TokenUtils(networkConfig);
            // The pair is queryable as soon as the tx commits, but retry a few
            // times to absorb any node read lag.
            for (let i = 0; i < 4 && !erc20; i++) {
                erc20 = await utils.getErc20Pair(fullDenom);
                if (!erc20) await new Promise((r) => setTimeout(r, 1500));
            }
        }

        setProgress("")
        setTxLoading(false)
        setResult({ denom: fullDenom, erc20 })

        if (networkKey == "mainnet") await sendTelegramMessage(`wallet ${connectedWallet} created a new token on trippyinj!\nname: ${props.tokenName}\nsymbol: ${props.tokenSymbol}\ndenom: ${fullDenom}\nerc20: ${erc20 ?? "none"}`)

    }, [connectedWallet, networkKey, networkConfig, props])

    const erc20Url = result?.erc20 ? evmAddressUrl(networkKey, result.erc20) : null;

    return (
        <>
            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-hidden focus:outline-hidden text-white text-sm">
                <div className="relative my-4 mx-auto max-w-2xl w-full px-3">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-hidden focus:outline-hidden">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-slate-700 rounded-t">
                            <h3 className="text-xl font-semibold font-magic">
                                {result ? "Token launched 🎉" : `Review launch on ${networkKey}`}
                            </h3>
                        </div>

                        {connectedWallet && !result &&
                            <div className="relative p-6 flex-auto">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="space-y-1">
                                        <Row label="Name" value={props.tokenName} />
                                        <Row label="Symbol" value={props.tokenSymbol} />
                                        <Row label="Supply" value={props.tokenSupply.toLocaleString()} />
                                        <Row label="Decimals" value={String(props.tokenDecimals)} />
                                        <Row label="Admin" value={shortAddress(connectedWallet)} />
                                        <div className="text-xs break-all"><span className="text-slate-400">Denom:</span> {denom}</div>
                                        <div className="pt-1">
                                            {props.pairErc20
                                                ? <span className="inline-block text-xs bg-emerald-700/60 border border-emerald-500 rounded px-2 py-0.5">Paired ERC-20 will be auto-created</span>
                                                : <span className="inline-block text-xs bg-slate-700 border border-slate-600 rounded px-2 py-0.5">Cosmos-only (no ERC-20)</span>}
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <div className="text-xs text-slate-400 mb-1">Token image</div>
                                        {props.tokenImage ?
                                            <IPFSImage width={100} className={'rounded-md'} ipfsPath={props.tokenImage} />
                                            :
                                            <MdImageNotSupported className="text-5xl text-slate-500" />
                                        }
                                    </div>
                                </div>
                                {progress && <div className="mt-5 text-trippyYellow">{progress}</div>}
                                {txLoading && <CircleLoader color="#36d7b7" className="mt-2" />}
                                {error && <div className="text-rose-400 mt-5 break-all">{error}</div>}
                            </div>
                        }

                        {result &&
                            <div className="relative p-6 flex-auto space-y-3">
                                <div className="text-xs break-all"><span className="text-slate-400">Denom:</span> {result.denom}</div>
                                {props.pairErc20 && (
                                    result.erc20 ?
                                        <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-3">
                                            <div className="text-xs text-slate-400 mb-1">Paired ERC-20 address</div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-trippyYellow break-all">{result.erc20}</span>
                                                <button title="Copy" onClick={() => void navigator.clipboard.writeText(result.erc20 as string)} className="text-slate-300 hover:text-white"><FaRegCopy /></button>
                                                {erc20Url && <a title="View on explorer" target="_blank" href={erc20Url} className="text-slate-300 hover:text-white"><FaExternalLinkAlt /></a>}
                                            </div>
                                        </div>
                                        :
                                        <div className="text-xs text-amber-400">ERC-20 pair is registering — check the Manage page in a moment.</div>
                                )}
                            </div>
                        }

                        <div className="flex items-center justify-end p-4 border-t border-solid border-slate-700 rounded-b gap-2">
                            {result ?
                                <button
                                    className="bg-trippyYellow text-black font-bold uppercase text-sm px-6 py-2.5 rounded-md"
                                    type="button"
                                    onClick={() => navigate('/manage-tokens')}
                                >
                                    Manage tokens
                                </button>
                                :
                                <>
                                    <button
                                        className="text-slate-400 font-bold uppercase px-6 py-2 text-sm disabled:opacity-40"
                                        type="button"
                                        disabled={txLoading}
                                        onClick={() => props.setShowModal(false)}
                                    >
                                        Back
                                    </button>
                                    <button
                                        className="bg-slate-600 text-white font-bold uppercase text-sm px-6 py-3 rounded-md shadow-sm hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                        type="button"
                                        disabled={txLoading}
                                        onClick={() => { void createAndMint().catch(e => {
                                            console.log(e)
                                            setError(e?.message ?? String(e))
                                            setProgress("")
                                            setTxLoading(false)
                                        }) }}
                                    >
                                        {txLoading ? "Launching…" : "Launch"}
                                    </button>
                                </>
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="text-sm"><span className="text-slate-400">{label}:</span> {value}</div>
);

export default TokenConfirmModal
