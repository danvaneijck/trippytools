import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleLoader } from "react-spinners";
import { gql, useMutation } from "@apollo/client";
import dayjs from "dayjs";
import { sendTelegramMessage } from "../../modules/telegram";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";
import { isValidInjAddress } from "./csv";
import { buildShroomFeeMessages } from "../../utils/shroomFee";
import type { NftPair } from "./types";

// transfer_nft is far heavier than a cw20 transfer, so chunks stay small to
// keep each tx under the block gas limit.
const NFT_CHUNK_SIZE = 25;
const GAS_PER_NFT = 250000;
const MIN_GAS = 5000000;

const INSERT_AIRDROP_MUTATION = gql`
    mutation insertAirdropLog(
        $time: timestamptz!
        $token_dropped_id: String!
        $wallet_id: String!
        $amount_dropped: float8
        $participants: [airdrop_tracker_airdroplog_participants_insert_input!]!
        $criteria: String
        $description: String
        $total_participants: Int!
        $tx_hashes: String
        $fee: float8
    ) {
        insert_airdrop_tracker_airdroplog_one(
            object: {
                time: $time
                token_dropped_id: $token_dropped_id
                wallet_id: $wallet_id
                amount_dropped: $amount_dropped
                criteria: $criteria
                description: $description
                total_participants: $total_participants
                participants: { data: $participants }
                tx_hashes: $tx_hashes
                fee: $fee
            }
        ) {
            id
        }
    }
`;

const INSERT_WALLETS_MUTATION = gql`
    mutation insertWallet($objects: [wallet_tracker_wallet_insert_input!]!) {
        insert_wallet_tracker_wallet(
            objects: $objects
            on_conflict: { constraint: wallet_tracker_wallet_pkey, update_columns: [] }
        ) {
            returning {
                address
            }
        }
    }
`;

const INSERT_TOKEN_MUTATION = gql`
    mutation insertToken($objects: [token_tracker_token_insert_input!]!) {
        insert_token_tracker_token(
            objects: $objects
            on_conflict: { constraint: token_tracker_token_pkey, update_columns: [] }
        ) {
            returning {
                address
            }
        }
    }
`;

const NftAirdropConfirmModal = (props: {
    pairs: NftPair[];
    collectionAddress: string;
    collectionName?: string;
    collectionSymbol?: string;
    shroomCost: number;
    setShowModal: (show: boolean) => void;
}) => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey: currentNetwork } = useNetworkStore();
    const navigate = useNavigate();

    const [progress, setProgress] = useState("");
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feePayed, setFeePayed] = useState(false);
    const [estimatedTx, setEstimatedTx] = useState<number | null>(null);
    const [completedTx, setCompletedTx] = useState(0);

    const [insertAirdropLog] = useMutation(INSERT_AIRDROP_MUTATION);
    const [insertWallets] = useMutation(INSERT_WALLETS_MUTATION);
    const [insertTokenDropped] = useMutation(INSERT_TOKEN_MUTATION);

    // Only pairs with a valid recipient address can be sent on chain.
    const sendable = useMemo(
        () => props.pairs.filter((p) => isValidInjAddress(p.recipient)),
        [props.pairs],
    );
    const invalidCount = props.pairs.length - sendable.length;
    const txCount = Math.ceil(sendable.length / NFT_CHUNK_SIZE);

    const criteria = `Direct NFT airdrop from ${props.collectionName ?? props.collectionAddress}`;
    const description = `Sent ${sendable.length} ${props.collectionSymbol ?? "NFT"}${
        sendable.length === 1 ? "" : "s"
    } from ${props.collectionName ?? "collection"} to ${sendable.length} wallet${sendable.length === 1 ? "" : "s"}`;

    const sendNfts = useCallback(async () => {
        const injectiveAddress = connectedAddress as string;
        if (!injectiveAddress) throw new Error("Wallet not connected");

        const records = sendable;
        if (records.length === 0) throw new Error("No valid recipients to airdrop to");

        const chunks: NftPair[][] = [];
        for (let i = 0; i < records.length; i += NFT_CHUNK_SIZE) {
            chunks.push(records.slice(i, i + NFT_CHUNK_SIZE));
        }

        const processedTokenIds = new Set<string>();
        const transactions: string[] = [];
        setEstimatedTx(chunks.length);

        for (const chunk of chunks) {
            let retries = 3;
            let success = false;

            while (retries > 0 && !success) {
                try {
                    const filteredChunk = chunk.filter((p) => !processedTokenIds.has(p.tokenId));
                    if (filteredChunk.length === 0) break;

                    const msgs = filteredChunk.map((p) =>
                        MsgExecuteContractCompat.fromJSON({
                            contractAddress: props.collectionAddress,
                            sender: injectiveAddress,
                            msg: {
                                transfer_nft: {
                                    recipient: p.recipient,
                                    token_id: p.tokenId,
                                },
                            },
                        }),
                    );

                    const calculatedGas = Math.max(filteredChunk.length * GAS_PER_NFT, MIN_GAS);
                    const gas = {
                        amount: [{ denom: "inj", amount: calculatedGas.toString() }],
                        gas: calculatedGas.toString(),
                    };
                    console.log("gas", gas);
                    console.log("msgs", msgs);

                    const response = await performTransaction(injectiveAddress, msgs as any);
                    filteredChunk.forEach((p) => processedTokenIds.add(p.tokenId));
                    success = true;
                    transactions.push(response!.txHash);
                    setCompletedTx(transactions.length);
                } catch (e) {
                    console.error("NFT transfer failed, retrying...", e);
                    retries -= 1;
                }
            }

            if (!success) throw new Error("Failed to send NFT airdrop after multiple retries");
        }
        return transactions;
    }, [connectedAddress, sendable, props.collectionAddress]);

    const payFee = useCallback(async () => {
        const injectiveAddress = connectedAddress as string;
        // 90% fee / 10% burn, auto-converting bank SHROOM → CW20 when needed.
        const messages = await buildShroomFeeMessages(injectiveAddress, props.shroomCost, { burn: true });
        return await performTransaction(injectiveAddress, messages);
    }, [props.shroomCost, connectedAddress]);

    const startAirdrop = useCallback(async () => {
        setError(null);
        if (sendable.length === 0) {
            setError("No valid recipients to airdrop to");
            return;
        }
        setTxLoading(true);

        try {
            if (currentNetwork === "mainnet" && props.shroomCost !== 0 && !feePayed) {
                setProgress("Pay shroom fee for airdrop");
                const result = await payFee();
                if (result) setFeePayed(true);
            }

            setProgress("Sending NFTs");
            const txHashes = await sendNfts();
            setProgress("Done...");

            if (currentNetwork === "mainnet") {
                await sendTelegramMessage(
                    `wallet ${connectedAddress} performed an NFT airdrop on trippyinj!\n` +
                        `collection: ${props.collectionAddress}\n` +
                        `nfts dropped: ${sendable.length}\n${criteria}\n${description}`,
                );

                try {
                    await insertTokenDropped({ variables: { objects: [{ address: props.collectionAddress }] } });
                    await insertWallets({
                        variables: {
                            objects: sendable.map((p) => ({ address: p.recipient, burn_address: false })),
                        },
                    });
                    insertAirdropLog({
                        variables: {
                            time: dayjs(),
                            token_dropped_id: props.collectionAddress,
                            wallet_id: connectedAddress,
                            amount_dropped: sendable.length,
                            total_participants: sendable.length,
                            participants: sendable.map((p) => ({ wallet_id: p.recipient })),
                            criteria,
                            description,
                            tx_hashes: txHashes.join(","),
                            fee: props.shroomCost.toString(),
                        },
                    }).catch((e) => console.log("failed to insert airdrop log", e));
                } catch (e) {
                    console.log(e);
                }
            }

            setTxLoading(false);
            void navigate("/airdrop-history");
        } catch (e: any) {
            console.log(e);
            setError(e?.message ?? "Airdrop failed");
            setProgress("");
            setTxLoading(false);
        }
    }, [
        sendable,
        currentNetwork,
        props.shroomCost,
        props.collectionAddress,
        feePayed,
        payFee,
        sendNfts,
        connectedAddress,
        criteria,
        description,
        insertTokenDropped,
        insertWallets,
        insertAirdropLog,
        navigate,
    ]);

    return (
        <>
            <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-hidden focus:outline-hidden text-white text-sm">
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-gray-800 outline-hidden focus:outline-hidden">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">NFT Airdrop on {currentNetwork}</h3>
                        </div>

                        <div className="relative p-6 flex-auto">
                            <p>
                                Airdropping NFTs from <br />
                                {props.collectionName ? `${props.collectionName} — ` : ""}
                                {props.collectionAddress}
                            </p>

                            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                                <div className="rounded-md bg-slate-900 p-2">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">NFTs</div>
                                    <div className="text-sm font-bold">{sendable.length.toLocaleString()}</div>
                                </div>
                                <div className="rounded-md bg-slate-900 p-2">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Recipients</div>
                                    <div className="text-sm font-bold">{sendable.length.toLocaleString()}</div>
                                </div>
                                <div className="rounded-md bg-slate-900 p-2">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Transactions</div>
                                    <div className="text-sm font-bold">
                                        {txCount}
                                        {currentNetwork === "mainnet" ? " + fee" : ""}
                                    </div>
                                </div>
                            </div>

                            {invalidCount > 0 && (
                                <div className="text-amber-400 text-xs mt-2">
                                    {invalidCount} pair{invalidCount === 1 ? "" : "s"} with an invalid address will be
                                    skipped.
                                </div>
                            )}

                            <div className="mt-5 max-h-80 overflow-y-scroll overflow-x-auto">
                                <table className="table-auto w-full">
                                    <thead className="text-white">
                                        <tr>
                                            <th className="px-4 py-2 text-left">NFT</th>
                                            <th className="px-4 py-2 text-left">Recipient</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sendable.map((p, index) => (
                                            <tr key={index} className="text-white border-b text-xs">
                                                <td className="px-4 py-1 whitespace-nowrap">
                                                    {p.image && (
                                                        <img
                                                            src={p.image}
                                                            alt={p.tokenId}
                                                            className="inline-block w-6 h-6 rounded mr-2 object-cover align-middle"
                                                        />
                                                    )}
                                                    {p.name ?? `#${p.tokenId}`} (ID {p.tokenId})
                                                </td>
                                                <td className="px-4 py-1">
                                                    <a
                                                        className="hover:text-indigo-400"
                                                        href={`https://explorer.injective.network/account/${p.recipient}`}
                                                    >
                                                        {p.recipient}
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {progress && <div className="mt-5">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-rose-600 mt-5">{error}</div>}
                        </div>

                        {estimatedTx !== null && (
                            <div className="mx-5 mb-2">
                                <div>Total number of tx for airdrop: {estimatedTx}</div>
                                <div>Completed tx: {completedTx}</div>
                            </div>
                        )}
                        <div className="mx-5">
                            If the airdrop TX fails, try increasing the gas fee in your wallet. Each tx will retry up to 3
                            times.
                        </div>
                        {currentNetwork === "mainnet" && sendable.length > 0 && (
                            <div className="m-5">
                                Fee for airdrop: {props.shroomCost} shroom (cw20)
                                <br />
                                <a
                                    href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                                    className="underline text-sm"
                                >
                                    buy here
                                </a>
                                <div className="mt-2">Fee payed: {feePayed ? "True" : "False"}</div>
                            </div>
                        )}
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => props.setShowModal(false)}
                            >
                                Back
                            </button>
                            <button
                                className="bg-gray-600 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded-sm shadow-sm hover:shadow-lg outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => {
                                    void startAirdrop();
                                }}
                            >
                                Do NFT Airdrop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    );
};

export default NftAirdropConfirmModal;
