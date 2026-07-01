import { useCallback, useEffect, useMemo, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link, useSearchParams } from "react-router-dom";
import ConnectWallet from "../../components/App/ConnectKeplr";
import ShroomBalance from "../../components/App/ShroomBalance";
import { WALLET_LABELS } from "../../constants/walletLabels";
import IPFSImage from "../../components/App/IpfsImage";
import AirdropConfirmModal from "./AirdropConfirmModal";
import { Holder, MarketingInfo } from "../../constants/types";
import { CHOICE_FACTORY, CW404_TOKENS, NFT_COLLECTIONS } from "../../constants/contractAddresses";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { ChainGrpcGovApi } from "@injectivelabs/sdk-ts";
import dayjs from "dayjs";
import parachute from "../../assets/parachute.webp";
import Select from "react-select";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import useTokenStore from "../../store/useTokenStore";
import useLiquidityPoolStore from "../../store/usePoolStore";
import { allocate } from "./distribution";
import { parseAirdropCsv, ParsedCsv } from "./csv";
import { humanReadableAmount } from "./format";
import type { AirdropRecipient, DistMode, DropMode } from "./types";
import DistributionToggle from "./components/DistributionToggle";
import AirdropListSection from "./components/AirdropListSection";
import { withShroomMetadata } from "../../modules/shroomTokenMeta";

const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl";
const STAKING_CONTRACT_ADDRESS = "inj1gtze7qm07nky47n7mwgj4zatf2s77xqvh3k2n8";
const INJ_CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk";
const DOJO_BURN_ADDRESS = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const INJ_BURN_ADDRESS = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";
const MITO_ADDRESS = "inj14vnmw2wee3xtrsqfvpcqg35jg9v7j2vdpzx0kk";
const MITO_EXCLUDED_WALLETS = [
    "inj1gtze7qm07nky47n7mwgj4zatf2s77xqvh3k2n8",
    "inj1vcqkkvqs7prqu70dpddfj7kqeqfdz5gg662qs3",
];

const DROP_MODE_OPTIONS: { value: DropMode; label: string }[] = [
    { value: "NFT", label: "NFT community" },
    { value: "TOKEN", label: "Token holders" },
    { value: "CSV", label: "Custom CSV file upload" },
    { value: "GOV", label: "Proposal Voters" },
    { value: "MITO", label: "Mito Vault Holders / Stakers" },
    { value: "BUYBACK", label: "Community BuyBack Participants" },
];

const isNativeDenom = (denom: string) =>
    denom.includes("factory") || denom.includes("peggy") || denom.includes("ibc") || denom === "inj";

const Airdrop = () => {
    const { connectedWallet: connectedAddress } = useWalletStore();
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore();

    const { tokens } = useTokenStore();
    const { pools } = useLiquidityPoolStore();

    const [searchParams, setSearchParams] = useSearchParams();

    const [tokenAddress, setTokenAddress] = useState<any>(null);
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [balance, setBalance] = useState(0);
    const [balanceToDrop, setBalanceToDrop] = useState<string>("0");
    const dropAmount = Number(balanceToDrop) || 0;

    const [shroomCost] = useState(25000);
    const [shroomPrice, setShroomPrice] = useState<any>(null);

    const [dropMode, setDropMode] = useState<{ value: DropMode; label: string }>({
        value: "TOKEN",
        label: "Token holders",
    });

    const [nftCollection, setNftCollection] = useState(NFT_COLLECTIONS[0]);
    const [nftCollectionInfo, setNftCollectionInfo] = useState<any>(null);
    const [airdropTokenAddress, setAirdropTokenAddress] = useState<any>();
    const [airdropTokenInfo, setAirdropTokenInfo] = useState<any>(null);

    const [airdropDetails, setAirdropDetails] = useState<AirdropRecipient[]>([]);
    const [csvInvalidRows, setCsvInvalidRows] = useState<ParsedCsv["invalidRows"]>([]);

    const [showConfirm, setShowConfirm] = useState(false);

    const [proposalNumber, setProposalNumber] = useState("417");
    const [blockHeight, setBlockHeight] = useState(76938079);
    const [attemptFindBlock, setAttemptFindBlock] = useState(true);

    // Community BuyBack: pick a monthly round, then load its committed wallets.
    // `total` carries the round's total_deposit (INJ) so the fetch can stop once
    // every committer is found.
    type BuybackRoundOption = { value: number; label: string; total: number };
    const [buybackRounds, setBuybackRounds] = useState<BuybackRoundOption[]>([]);
    const [buybackRound, setBuybackRound] = useState<BuybackRoundOption | null>(null);

    const [criteria, setCriteria] = useState("");
    const [description, setDescription] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);
    const [distMode, setDistMode] = useState<DistMode>("fair");
    const [progress, setProgress] = useState("");

    const [mitoHolderType, setMitoHolderType] = useState<"stake" | "non-stake">("non-stake");
    const [mitoVaults, setMitoVaults] = useState<any[]>([]);
    const [mitoHolders, setMitoHolders] = useState<any[]>([]);
    const [selectedMitoVault, setSelectedMitoVault] = useState<any>(null);

    // GOV is always an equal split (no distribution toggle); everything else
    // follows the selected fair/proportionate mode.
    const activeDist: DistMode = dropMode.value === "GOV" ? "fair" : distMode;

    const buildMitoRecipients = useCallback(
        (holders: any[], holderType: "stake" | "non-stake", dist: DistMode, total: number): AirdropRecipient[] => {
            const base: AirdropRecipient[] = holders
                .filter((h) => !MITO_EXCLUDED_WALLETS.includes(h.holderAddress))
                .map((h) => ({
                    address: h.holderAddress,
                    balance: holderType === "stake" ? Number(h.stakedAmount) : Number(h.amount),
                    amountToAirdrop: 0,
                    percentToAirdrop: 0,
                    includeInDrop: true,
                }))
                .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
            return allocate(base, dist, total);
        },
        [],
    );

    // Re-allocate the current list when the amount or distribution changes.
    // Skipped for CSV (amounts are fixed by the uploaded file).
    useEffect(() => {
        if (dropMode.value === "CSV") return;
        setAirdropDetails((prev) => (prev.length ? allocate(prev, activeDist, dropAmount) : prev));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDist, dropAmount]);

    // Rebuild Mito recipients when the holder set or balance-type changes.
    useEffect(() => {
        if (dropMode.value !== "MITO" || mitoHolders.length === 0) return;
        setAirdropDetails(buildMitoRecipients(mitoHolders, mitoHolderType, activeDist, dropAmount));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mitoHolders, mitoHolderType]);

    useEffect(() => {
        setAirdropDetails([]);
        setCsvInvalidRows([]);
    }, [selectedMitoVault]);

    // Switching modes clears the list so a mode never shows another mode's data.
    useEffect(() => {
        setAirdropDetails([]);
        setCsvInvalidRows([]);
    }, [dropMode.value]);

    // Load the list of buyback rounds once, when the mode is first opened on
    // mainnet (the program is mainnet-only). Newest round first.
    useEffect(() => {
        if (dropMode.value !== "BUYBACK" || currentNetwork !== "mainnet") return;
        if (buybackRounds.length > 0) return;
        let cancelled = false;
        void (async () => {
            try {
                const module = new TokenUtils(networkConfig);
                const rounds = await module.fetchBuybackRounds();
                if (cancelled) return;
                const opts = rounds
                    .slice()
                    .reverse()
                    .map((r) => ({
                        value: r.round,
                        total: r.totalDeposit,
                        label: `Round ${r.round} — ${
                            r.startDate ? dayjs.unix(r.startDate).format("MMM YYYY") : "?"
                        } · ${r.totalDeposit.toLocaleString(undefined, { maximumFractionDigits: 0 })} INJ committed`,
                    }));
                setBuybackRounds(opts);
                if (opts.length) setBuybackRound((prev) => prev ?? opts[0]);
            } catch (e) {
                console.log(e);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dropMode.value, currentNetwork, networkConfig]);

    // Changing the selected round invalidates any loaded participant list.
    useEffect(() => {
        if (dropMode.value === "BUYBACK") setAirdropDetails([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buybackRound]);

    const getMitoVaultHolders = useCallback(
        async (vaultAddress: any) => {
            const module = new TokenUtils(networkConfig);
            setLoading(true);
            setError(null);
            try {
                const holders = await module.fetchMitoVaultHolders(vaultAddress, STAKING_CONTRACT_ADDRESS, setProgress);
                setMitoHolders(holders);
                setAirdropDetails(buildMitoRecipients(holders, mitoHolderType, activeDist, dropAmount));
                setLoading(false);
            } catch (e) {
                console.error("Failed to fetch mito vault holders:", e);
                setError((e as any)?.message ?? "Failed to fetch mito vault holders");
                setLoading(false);
            }
        },
        [networkConfig, buildMitoRecipients, mitoHolderType, activeDist, dropAmount],
    );

    const getMitoVaults = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        return module.fetchMitoVaults();
    }, [networkConfig]);

    const getSpotMarkets = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        return module.fetchSpotMarkets();
    }, [networkConfig]);

    const getMitoMarketList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const spotMarkets = await getSpotMarkets();
            const vaults = await getMitoVaults();

            const matchedMarkets = spotMarkets.map((market) => {
                const matchingVault = vaults
                    .slice()
                    .reverse()
                    .find((vault) => vault.marketId === market.marketId);
                return { ...market, matchingVault: matchingVault || null };
            });

            const options: any[] = [];
            matchedMarkets.forEach((market: any) => {
                if (market.matchingVault !== null) {
                    options.push({
                        value: market,
                        label: `${market.baseToken ? market.baseToken.name : market.marketId} vault (${
                            market.baseDenom ?? market.baseToken.address
                        })`,
                    });
                }
            });
            setMitoVaults(options);
            setLoading(false);
        } catch (e) {
            console.error("Failed to fetch mito vault list:", e);
            setError((e as any)?.message ?? "Failed to fetch mito vault list");
            setLoading(false);
        }
    }, [getSpotMarkets, getMitoVaults]);

    const updateDescription = useCallback(() => {
        let criteriaUpdate = "";
        let descriptionUpdate = "";
        const totalToDrop = airdropDetails
            .reduce((sum, airdrop) => sum + Number(airdrop.amountToAirdrop), 0)
            .toFixed(2);
        const mode = activeDist[0].toUpperCase() + activeDist.slice(1);
        const now = dayjs().toISOString();

        if (dropMode.value === "TOKEN" && airdropTokenAddress) {
            const targetToken = tokens.find((token) => token.address === airdropTokenAddress.value);
            criteriaUpdate = `Holders of ${airdropTokenInfo.symbol} token at ${now}`;
            descriptionUpdate = `${mode} drop of ${totalToDrop} ${tokenInfo.symbol} to holders of ${airdropTokenInfo.symbol} token`;
            if (targetToken?.liquidity_token_pool) {
                const tokenLabel = `${targetToken.liquidity_token_pool.asset_1.symbol}/${targetToken.liquidity_token_pool.asset_2.symbol} on ${targetToken.liquidity_token_pool.dex.name}`;
                descriptionUpdate = `${mode} drop of ${totalToDrop} ${tokenInfo.symbol} to liquidity providers of ${tokenLabel}`;
                criteriaUpdate = `Liquidity providers of ${tokenLabel} at ${now}`;
            }
        } else if (dropMode.value === "NFT") {
            criteriaUpdate = `Holders of ${nftCollectionInfo.symbol} NFTs at ${now}`;
            descriptionUpdate = `${mode} drop of ${totalToDrop} ${tokenInfo.symbol} to holders of ${nftCollectionInfo.symbol} NFTs`;
        } else if (dropMode.value === "CSV") {
            criteriaUpdate = `Custom CSV airdrop file upload`;
            descriptionUpdate = `Drop of ${totalToDrop} ${tokenInfo.symbol} to custom list of participants`;
        } else if (dropMode.value === "GOV") {
            const includedVotes = Array.from(
                new Set(
                    airdropDetails
                        .filter((r) => r.includeInDrop && r.vote_option)
                        .map((r) => (r.vote_option as string).replace("VOTE_OPTION_", "")),
                ),
            );
            const who = includedVotes.length === 0 || includedVotes.length >= 4 ? "All" : includedVotes.join(", ");
            criteriaUpdate = `${who} voters on proposal ${proposalNumber} at ${now}`;
            descriptionUpdate = `Drop of ${totalToDrop} ${tokenInfo.symbol} to voters on proposal ${proposalNumber}`;
        } else if (dropMode.value === "MITO") {
            criteriaUpdate = `Holders of ${mitoHolderType === "stake" ? "staked" : "all"} LP tokens in the ${selectedMitoVault.value.baseToken.name} mito vault at ${now}`;
            descriptionUpdate = `${mode} drop of ${totalToDrop} ${tokenInfo.symbol} to holders of ${selectedMitoVault.value.baseToken.name} mito vault tokens`;
        } else if (dropMode.value === "BUYBACK") {
            const roundLabel = buybackRound ? `round ${buybackRound.value}` : "a round";
            criteriaUpdate = `Participants of Community BuyBack ${roundLabel} at ${now}`;
            descriptionUpdate = `${mode} drop of ${totalToDrop} ${tokenInfo.symbol} to Community BuyBack ${roundLabel} participants`;
        }

        setCriteria(criteriaUpdate);
        setDescription(descriptionUpdate);
    }, [
        airdropTokenAddress,
        tokens,
        dropMode,
        activeDist,
        airdropDetails,
        tokenInfo,
        airdropTokenInfo,
        nftCollectionInfo,
        proposalNumber,
        selectedMitoVault,
        mitoHolderType,
        buybackRound,
    ]);

    async function fetchBlock(height: any) {
        const baseUrl = "https://sentry.lcd.injective.network/cosmos/base/tendermint/v1beta1/blocks";
        let attempts = 0;
        const maxAttempts = 50;
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${baseUrl}/${height}`);
                if (!response.ok) throw new Error(`Failed to fetch block at height ${height}`);
                return response.json();
            } catch (e) {
                attempts += 1;
                await new Promise((res) => setTimeout(res, 2000));
                if (attempts >= maxAttempts) {
                    throw new Error(`Failed to fetch block after ${maxAttempts} attempts: ${(e as any).message}`, { cause: e });
                }
            }
        }
    }

    const getProposalAndBlockHeight = useCallback(
        async (propNumber: any) => {
            async function findBlockBeforeTime(targetTime: any) {
                const targetDate = new Date(targetTime);
                const latestBlock = await fetchBlock("latest");
                const latestHeight = parseInt(latestBlock.block.header.height);
                const latestBlockTime = new Date(latestBlock.block.header.time);
                const timeDifference = targetDate.getTime() - latestBlockTime.getTime();
                let estimatedHeight = latestHeight + Math.floor(timeDifference / 690);

                if (estimatedHeight < 1) estimatedHeight = 1;
                else if (estimatedHeight > latestHeight) estimatedHeight = latestHeight;

                let lastValidBlock = null;
                let low = Math.max(1, estimatedHeight - Math.floor(Math.abs(timeDifference) / 1000));
                let high = Math.min(latestHeight, estimatedHeight + Math.floor(Math.abs(timeDifference) / 1000));

                while (low < high - 1) {
                    const mid = Math.floor((low + high) / 2);
                    const midBlock = await fetchBlock(mid);
                    const midBlockTime = new Date(midBlock.block.header.time);
                    if (midBlockTime < targetDate) {
                        lastValidBlock = midBlock;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                    if (high - low < 100 && midBlockTime < targetDate) break;
                }
                return lastValidBlock;
            }

            const api = new ChainGrpcGovApi(networkConfig.grpc);
            const proposal = await api.fetchProposal(propNumber);
            const endVoteTime = dayjs.unix(proposal!.votingEndTime);
            const closestBlock = await findBlockBeforeTime(endVoteTime);
            return Number(closestBlock.block.header.height);
        },
        [networkConfig],
    );

    // Deep-link prefill: an external tool (e.g. the SHROOM launchpad's "airdrop
    // this token" link) can open `/airdrop?token=<denom-or-contract>` to
    // pre-load the "token to airdrop" field. Consumed once on mount and stripped
    // from the URL so a later manual clear of the field isn't undone on rerender.
    useEffect(() => {
        const prefill = searchParams.get("token");
        if (!prefill) return;
        setTokenAddress({ value: prefill, label: prefill });
        const next = new URLSearchParams(searchParams);
        next.delete("token");
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!loading) setProgress("");
    }, [loading]);

    useEffect(() => {
        setTokenInfo(null);
        setPairMarketing(null);
        setAirdropDetails([]);
        setShowConfirm(false);
    }, [tokenAddress]);

    useEffect(() => {
        setAirdropDetails([]);
        setNftCollectionInfo(null);
        setAirdropTokenInfo(null);
    }, [airdropTokenAddress]);

    useEffect(() => {
        if (dropAmount > balance) {
            setError("drop amount must be less than balance");
        } else if (error === "drop amount must be less than balance") {
            setError(null);
        }
    }, [balance, dropAmount, error]);

    useEffect(() => {
        const getShroomCost = async () => {
            const module = new TokenUtils(networkConfig);
            try {
                const [baseAssetPrice, pairInfo] = await Promise.all([
                    module.getINJPrice(),
                    module.getPairInfo(SHROOM_PAIR_ADDRESS),
                ]);
                const quote = await module.getSellQuoteRouter(pairInfo, shroomCost + "0".repeat(18));
                const returnAmount = Number(quote.amount) / Math.pow(10, 18);
                const totalUsdValue = (returnAmount * baseAssetPrice!).toFixed(3);
                setShroomPrice(totalUsdValue);
            } catch (e) {
                console.error("Failed to update shroom cost:", e);
            }
        };
        if (currentNetwork === "mainnet") void getShroomCost();
    }, [currentNetwork, networkConfig, shroomCost]);

    const getTokenInfo = useCallback(() => {
        setLoading(true);
        setError(null);
        setTokenInfo(null);
        setPairMarketing(null);
        const module = new TokenUtils(networkConfig);
        if (isNativeDenom(tokenAddress.value)) {
            module
                .getDenomExtraMetadata(tokenAddress.value)
                // SHROOM launch tokens carry a raw subdenom as their on-chain
                // name/symbol; overlay the friendly name/symbol/logo pulled from
                // the launchpad metadata (no-op for every other denom). decimals
                // stay from the on-chain metadata, so balance math is unchanged.
                .then((meta) => withShroomMetadata(tokenAddress.value, meta))
                .then((meta) => {
                    setTokenInfo(meta);
                    module
                        .getBalanceOfToken(tokenAddress.value, connectedAddress as string)
                        .then((r) => {
                            const bal = Number(r.amount) / Math.pow(10, meta.decimals);
                            setBalance(bal);
                            setBalanceToDrop(String(bal));
                            setLoading(false);
                        })
                        .catch((e: any) => {
                            console.log(e);
                            setLoading(false);
                            if (e?.message) setError(e.message);
                        });
                })
                .catch((e: any) => {
                    console.log(e);
                    setLoading(false);
                    if (e?.message) setError(e.message);
                });
        } else {
            module
                .getTokenInfo(tokenAddress.value)
                .then((meta) => {
                    setTokenInfo(meta);
                    module
                        .queryTokenForBalance(tokenAddress.value, connectedAddress as string)
                        .then((r) => {
                            const bal = Number(r.balance) / Math.pow(10, meta.decimals);
                            setBalance(bal);
                            setBalanceToDrop(String(bal));
                            setLoading(false);
                        })
                        .catch((e: any) => {
                            console.log(e);
                            setLoading(false);
                            if (e?.message) setError(e.message);
                        });
                })
                .catch((e: any) => {
                    console.log(e);
                    setLoading(false);
                    if (e?.message) setError(e.message);
                });
            module
                .getTokenMarketing(tokenAddress.value)
                .then((r) => setPairMarketing(r))
                .catch((e) => {
                    console.log(e);
                    setLoading(false);
                    const errorMessage = e?.message ? e.message.toString() : "";
                    if (
                        !errorMessage.startsWith(
                            "codespace wasm code 9: query wasm contract failed: Error parsing into type cw404::msg::QueryMsg: unknown variant `marketing_info`",
                        )
                    ) {
                        setError(errorMessage);
                    }
                });
        }
    }, [networkConfig, tokenAddress, connectedAddress]);

    const getNftCollection = useCallback(async () => {
        const is404 = CW404_TOKENS.find((x) => x.value === nftCollection.value) !== undefined;
        try {
            setAirdropDetails([]);
            setLoading(true);
            setError(null);
            setNftCollectionInfo(null);
            const module = new TokenUtils(networkConfig);

            let info, holders;
            if (is404) {
                info = await module.getCW404TokenInfo(nftCollection.value);
                holders = await module.getCW404Holders(nftCollection.value, setProgress);
            } else {
                info = await module.getNFTCollectionInfo(nftCollection.value);
                holders = await module.getNFTHolders(nftCollection.value, setProgress);
            }
            setNftCollectionInfo(info);

            const base: AirdropRecipient[] = holders.map((holder: any) => ({
                address: holder.address,
                balance: Number(holder.balance),
                percentageHeld: holder.percentageHeld,
                amountToAirdrop: 0,
                percentToAirdrop: 0,
                includeInDrop: true,
            }));
            setAirdropDetails(allocate(base, activeDist, dropAmount));
            setLoading(false);
        } catch (e) {
            console.log(e);
            setError((e as any)?.message ?? "Failed to fetch NFT holders");
            setLoading(false);
        }
    }, [networkConfig, nftCollection, dropAmount, activeDist]);

    const getTokenHolders = useCallback(async () => {
        if (!airdropTokenAddress) return;
        const module = new TokenUtils(networkConfig);
        setAirdropDetails([]);
        setLoading(true);
        setError(null);

        let tokenMeta: any;
        const liquidityPoolAddresses = pools.map((pool) => pool.contract_addr);
        const tokenAddresses = tokens.map((token) => token.address);
        const addressesToExclude = [
            INJ_CW20_ADAPTER,
            DOJO_BURN_ADDRESS,
            INJ_BURN_ADDRESS,
            MITO_ADDRESS,
            ...liquidityPoolAddresses,
            ...tokenAddresses,
        ];

        try {
            const native = isNativeDenom(airdropTokenAddress.value);
            if (native) {
                const r = await module.getDenomExtraMetadata(airdropTokenAddress.value);
                setAirdropTokenInfo(r);
            } else {
                const r = await module.getTokenInfo(airdropTokenAddress.value);
                setAirdropTokenInfo({ ...r, denom: airdropTokenAddress.value });
                tokenMeta = r;
            }

            let holders: Holder[] = [];
            if (native) {
                const factoryHolders = await module.getTokenFactoryTokenHolders(airdropTokenAddress.value, setProgress);
                const cleanList = factoryHolders.filter((holder) => !addressesToExclude.includes(holder.address));
                const totalBalance = cleanList.reduce((sum, holder) => sum + holder.balance, 0);
                cleanList.forEach((holder) => {
                    holder.percentageHeld = (holder.balance / totalBalance) * 100;
                });
                holders = cleanList;
            } else {
                const cw20Holders = await module.getCW20TokenHolders(airdropTokenAddress.value, setProgress);
                const factoryAddress = `factory/${INJ_CW20_ADAPTER}/${airdropTokenAddress.value}`;
                const factoryHolders = await module.getTokenFactoryTokenHolders(factoryAddress, setProgress);

                const holdersMap = new Map();
                cw20Holders.forEach(({ address, balance: bal }) => {
                    if (!holdersMap.has(address)) holdersMap.set(address, { address, balance: 0, percentageHeld: 0 });
                    holdersMap.get(address).balance += bal;
                });
                factoryHolders.forEach(({ address, balance: bal }) => {
                    if (!holdersMap.has(address)) holdersMap.set(address, { address, balance: 0, percentageHeld: 0 });
                    holdersMap.get(address).balance += bal / Math.pow(10, tokenMeta.decimals);
                });

                const combinedHolders = Array.from(holdersMap.values()).filter(
                    (holder) => !addressesToExclude.includes(holder.address),
                );
                const totalBalance = combinedHolders.reduce((sum, holder) => sum + holder.balance, 0);
                combinedHolders.forEach((holder) => {
                    holder.percentageHeld = (holder.balance / totalBalance) * 100;
                });
                holders = combinedHolders.sort((a, b) => Number(b.balance) - Number(a.balance));
            }

            const base: AirdropRecipient[] = holders.map((holder) => ({
                address: holder.address,
                balance: Number(holder.balance),
                percentageHeld: holder.percentageHeld,
                amountToAirdrop: 0,
                percentToAirdrop: 0,
                includeInDrop: true,
            }));
            setAirdropDetails(allocate(base, activeDist, dropAmount));
            setLoading(false);
        } catch (e) {
            setError((e as any)?.message ?? "Failed to fetch token holders");
            setLoading(false);
        }
    }, [airdropTokenAddress, activeDist, dropAmount, networkConfig, tokens, pools]);

    const handleFileUpload = useCallback(async (event: any) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null);
        try {
            const { recipients, invalidRows } = await parseAirdropCsv(file);
            setCsvInvalidRows(invalidRows);
            setAirdropDetails(recipients);
        } catch (e) {
            console.log(e);
            setError((e as any)?.message ?? "Failed to parse CSV");
        }
    }, []);

    const getPropVoters = useCallback(async () => {
        setAirdropDetails([]);
        setLoading(true);
        setError(null);
        try {
            const module = new TokenUtils(networkConfig);
            let height = blockHeight;
            if (attemptFindBlock) {
                setProgress("Fetching closest block");
                height = await getProposalAndBlockHeight(proposalNumber);
                setBlockHeight(height);
            }
            const voters = await module.fetchProposalVoters(proposalNumber, height, setProgress);
            const base: AirdropRecipient[] = voters.map((holder) => ({
                address: holder.address,
                balance: Number(holder.weight) || 0,
                vote_option: holder.vote_option,
                amountToAirdrop: 0,
                percentToAirdrop: 0,
                includeInDrop: true,
            }));
            setAirdropDetails(allocate(base, "fair", dropAmount));
            setLoading(false);
        } catch (e) {
            console.log(e);
            setError((e as any)?.message ?? "Failed to fetch proposal voters");
            setLoading(false);
        }
    }, [getProposalAndBlockHeight, proposalNumber, networkConfig, dropAmount, attemptFindBlock, blockHeight]);

    const getBuybackParticipants = useCallback(async () => {
        if (!buybackRound) {
            setError("select a buyback round");
            return;
        }
        setAirdropDetails([]);
        setLoading(true);
        setError(null);
        try {
            const module = new TokenUtils(networkConfig);
            const participants = await module.fetchBuybackParticipants(
                buybackRound.value,
                buybackRound.total,
                setProgress,
            );
            const base: AirdropRecipient[] = participants
                .map((p) => ({
                    address: p.address,
                    balance: p.deposit,
                    amountToAirdrop: 0,
                    percentToAirdrop: 0,
                    includeInDrop: true,
                }))
                .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
            setAirdropDetails(allocate(base, activeDist, dropAmount));
            setLoading(false);
        } catch (e) {
            console.log(e);
            setError((e as any)?.message ?? "Failed to fetch buyback participants");
            setLoading(false);
        }
    }, [buybackRound, networkConfig, activeDist, dropAmount]);

    const csvTotal = useMemo(
        () => airdropDetails.reduce((sum, r) => sum + (r.includeInDrop ? Number(r.amountToAirdrop) || 0 : 0), 0),
        [airdropDetails],
    );

    const tokenSymbol = tokenInfo?.symbol ?? "";
    const tokenDecimals = tokenInfo?.decimals ?? 6;

    return (
        <>
            {showConfirm && tokenInfo && (
                <AirdropConfirmModal
                    setShowModal={setShowConfirm}
                    tokenAddress={tokenAddress.value}
                    tokenDecimals={tokenInfo.decimals}
                    tokenSymbol={tokenInfo.symbol}
                    airdropDetails={airdropDetails}
                    shroomCost={shroomCost}
                    description={description}
                    criteria={criteria}
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
                                <div>
                                    <div className="text-center text-white mb-2">
                                        <div className="text-3xl font-magic">New Airdrop</div>
                                        <div className="text-sm">on Injective {currentNetwork}</div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 my-4">
                                        <Link to="/nft-airdrop" className="flex-1">
                                            <div className="bg-slate-800 hover:bg-slate-700 p-2 rounded-sm text-center text-sm">
                                                Airdrop NFTs instead →
                                            </div>
                                        </Link>
                                        <Link to="/airdrop-history" className="flex-1">
                                            <div className="bg-slate-800 hover:bg-slate-700 p-2 rounded-sm text-center text-sm">
                                                View airdrop history
                                            </div>
                                        </Link>
                                    </div>

                                    {/* Step 1 — token to airdrop */}
                                    <div className="border p-4 rounded-lg border-slate-700">
                                        <label className="font-bold text-base text-white mb-2">
                                            1. Token to airdrop (contract address / denom)
                                        </label>
                                        <TokenSelect
                                            options={[
                                                {
                                                    label: "TOKENS",
                                                    options: tokens
                                                        .filter((t) => t.show_on_ui)
                                                        .map((t) => ({
                                                            label: t.name + " (" + t.symbol + ")",
                                                            value: t.address,
                                                            img: t.icon,
                                                        })),
                                                },
                                                { label: "CW404", options: CW404_TOKENS },
                                            ]}
                                            selectedOption={tokenAddress}
                                            setSelectedOption={setTokenAddress}
                                        />
                                        {tokenAddress && (
                                            <button
                                                disabled={loading}
                                                onClick={getTokenInfo}
                                                className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white mt-4 shadow-lg"
                                            >
                                                Get token info
                                            </button>
                                        )}

                                        <div className="flex flex-col md:flex-row justify-between">
                                            {tokenInfo && (
                                                <div className="mt-5 text-sm text-white">
                                                    <div>name: {tokenInfo.name}</div>
                                                    <div>symbol: {tokenInfo.symbol}</div>
                                                    <div>decimals: {tokenInfo.decimals}</div>
                                                    {tokenInfo.description && <div>description: {tokenInfo.description}</div>}
                                                    {tokenInfo.total_supply && (
                                                        <div>
                                                            total supply:{" "}
                                                            {tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!pairMarketing && tokenInfo && tokenInfo.logo && (
                                                <div className="mt-5 text-sm text-white">
                                                    <IPFSImage
                                                        width={100}
                                                        className={"mb-2 rounded-lg"}
                                                        ipfsPath={tokenInfo.logo}
                                                    />
                                                    <a
                                                        href={`https://${
                                                            currentNetwork === "testnet" ? "testnet." : ""
                                                        }explorer.injective.network/account/${tokenInfo.admin}`}
                                                    >
                                                        admin: {tokenInfo.admin.slice(0, 5) + "..." + tokenInfo.admin.slice(-5)}
                                                        {(WALLET_LABELS as Record<string, any>)[tokenInfo.admin] ? (
                                                            <span
                                                                className={`${(WALLET_LABELS as Record<string, any>)[tokenInfo.admin].bgColor} ${
                                                                    (WALLET_LABELS as Record<string, any>)[tokenInfo.admin].textColor
                                                                } ml-2`}
                                                            >
                                                                {(WALLET_LABELS as Record<string, any>)[tokenInfo.admin].label}
                                                            </span>
                                                        ) : null}
                                                    </a>
                                                </div>
                                            )}
                                            {pairMarketing && pairMarketing.logo && (
                                                <div className="mt-5 text-sm text-white">
                                                    <img
                                                        src={pairMarketing.logo.url}
                                                        style={{ width: 50, height: 50 }}
                                                        className="mb-2 rounded-lg"
                                                        alt="logo"
                                                    />
                                                    <div>project: {pairMarketing.project}</div>
                                                    <div>description: {pairMarketing.description}</div>
                                                    <div>
                                                        marketing: {pairMarketing.marketing}
                                                        {(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing] ? (
                                                            <span
                                                                className={`${(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].bgColor} ${
                                                                    (WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].textColor
                                                                } ml-2`}
                                                            >
                                                                {(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].label}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {tokenInfo && (
                                            <div>
                                                <div className="my-2">
                                                    Your balance: {balance} {tokenInfo.symbol}
                                                </div>
                                                <div>
                                                    <label className="text-base font-bold text-white mb-1">
                                                        Amount to airdrop
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="bg-white text-black w-full rounded-sm p-1 text-sm"
                                                            onChange={(e) => setBalanceToDrop(e.target.value)}
                                                            value={balanceToDrop}
                                                        />
                                                        <button
                                                            className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-sm text-sm whitespace-nowrap"
                                                            onClick={() => setBalanceToDrop(String(balance))}
                                                        >
                                                            Max
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2 — drop mode */}
                                    {tokenInfo && (
                                        <div className="mt-5 border p-4 rounded-lg border-slate-700">
                                            <div className="space-y-2 mb-5">
                                                <label className="text-base font-bold text-white">2. Drop Mode</label>
                                                <Select
                                                    className="text-black"
                                                    value={dropMode}
                                                    onChange={setDropMode as any}
                                                    options={DROP_MODE_OPTIONS}
                                                />
                                            </div>

                                            {dropMode.value === "NFT" && (
                                                <div>
                                                    <div className="space-y-2">
                                                        <label className="text-base font-bold text-white">
                                                            NFT collection address
                                                        </label>
                                                        <TokenSelect
                                                            options={[
                                                                { label: "CW404", options: CW404_TOKENS },
                                                                { label: "NFT", options: NFT_COLLECTIONS },
                                                            ]}
                                                            selectedOption={nftCollection}
                                                            setSelectedOption={setNftCollection}
                                                        />
                                                    </div>
                                                    <div className="mt-4 mb-2">
                                                        <DistributionToggle value={distMode} onChange={setDistMode} />
                                                    </div>
                                                    <button
                                                        disabled={loading}
                                                        onClick={() => { void getNftCollection(); }}
                                                        className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white mt-4 shadow-lg"
                                                    >
                                                        Get collection holders
                                                    </button>
                                                    {nftCollectionInfo && (
                                                        <div className="text-sm mt-5">
                                                            Collection Name: {nftCollectionInfo.name}
                                                            <br />
                                                            Collection Symbol: {nftCollectionInfo.symbol}
                                                        </div>
                                                    )}
                                                    {airdropDetails.length > 0 && (
                                                        <AirdropListSection
                                                            recipients={airdropDetails}
                                                            setRecipients={setAirdropDetails}
                                                            distMode={activeDist}
                                                            total={dropAmount}
                                                            tokenSymbol={tokenSymbol}
                                                            tokenDecimals={tokenDecimals}
                                                            sourceDecimals={2}
                                                            filter="topN"
                                                            columns={{ include: true, position: true, balance: true }}
                                                            network={currentNetwork}
                                                            csvFilename={`airdrop-${tokenSymbol}-nft.csv`}
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {dropMode.value === "TOKEN" && (
                                                <div>
                                                    <div className="mt-4 space-y-2">
                                                        <label className="block text-white">airdrop to holders of token</label>
                                                        <TokenSelect
                                                            options={[
                                                                {
                                                                    label: "Tokens",
                                                                    options: tokens
                                                                        .filter((t) => t.show_on_ui)
                                                                        .map((t) => ({
                                                                            label: t.name + " (" + t.symbol + ")",
                                                                            value: t.address,
                                                                            img: t.icon,
                                                                        })),
                                                                },
                                                                {
                                                                    label: "LIQUIDITY tokens",
                                                                    options: pools
                                                                        .filter((p) => p.liquidity_token !== null)
                                                                        .sort((a, b) => {
                                                                            const aChoice = a.dex.factory_address === CHOICE_FACTORY;
                                                                            const bChoice = b.dex.factory_address === CHOICE_FACTORY;
                                                                            if (aChoice === bChoice) {
                                                                                return `${a.asset_1.symbol}/${a.asset_2.symbol}`.localeCompare(
                                                                                    `${b.asset_1.symbol}/${b.asset_2.symbol}`,
                                                                                );
                                                                            }
                                                                            return aChoice ? -1 : 1;
                                                                        })
                                                                        .map((p) => ({
                                                                            value: p.liquidity_token.address,
                                                                            label: `${p.asset_1.symbol}/${p.asset_2.symbol} (${p.dex.name}) LP`,
                                                                            img: p.asset_1.icon,
                                                                        })),
                                                                },
                                                            ]}
                                                            selectedOption={airdropTokenAddress}
                                                            setSelectedOption={setAirdropTokenAddress}
                                                        />
                                                    </div>
                                                    <div className="mt-4 mb-2">
                                                        <DistributionToggle value={distMode} onChange={setDistMode} />
                                                    </div>
                                                    <button
                                                        disabled={loading}
                                                        onClick={() => { void getTokenHolders(); }}
                                                        className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white mt-4 shadow-lg"
                                                    >
                                                        Generate airdrop list
                                                    </button>
                                                    {airdropDetails.length > 0 && (
                                                        <AirdropListSection
                                                            recipients={airdropDetails}
                                                            setRecipients={setAirdropDetails}
                                                            distMode={activeDist}
                                                            total={dropAmount}
                                                            tokenSymbol={tokenSymbol}
                                                            tokenDecimals={tokenDecimals}
                                                            sourceSymbol={airdropTokenInfo?.symbol}
                                                            sourceDecimals={airdropTokenInfo?.decimals ?? 2}
                                                            filter="topN"
                                                            columns={{ include: true, position: true, balance: true }}
                                                            network={currentNetwork}
                                                            csvFilename={`airdrop-${tokenSymbol}-token.csv`}
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {dropMode.value === "CSV" && (
                                                <div>
                                                    {airdropDetails.length === 0 && (
                                                        <div className="text-sm my-2">
                                                            CSV file like:
                                                            <br />
                                                            address,amount
                                                            <br />
                                                            inj...,10.1
                                                            <br />
                                                            inj...,20.2
                                                        </div>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        onChange={(e) => { void handleFileUpload(e); }}
                                                        className="text-white text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-white hover:file:bg-slate-600"
                                                    />
                                                    {csvInvalidRows.length > 0 && (
                                                        <div className="text-amber-400 text-xs mt-2">
                                                            Skipped {csvInvalidRows.length} invalid row
                                                            {csvInvalidRows.length === 1 ? "" : "s"} (bad address or amount).
                                                            First: row {csvInvalidRows[0].row} — {csvInvalidRows[0].reason}.
                                                        </div>
                                                    )}
                                                    {airdropDetails.length > 0 && (
                                                        <AirdropListSection
                                                            recipients={airdropDetails}
                                                            setRecipients={setAirdropDetails}
                                                            distMode={activeDist}
                                                            total={csvTotal}
                                                            tokenSymbol={tokenSymbol}
                                                            tokenDecimals={tokenDecimals}
                                                            filter="none"
                                                            columns={{ include: true, position: false, balance: false }}
                                                            network={currentNetwork}
                                                            csvFilename={`airdrop-${tokenSymbol}-csv.csv`}
                                                            fixedAmounts
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {dropMode.value === "GOV" && (
                                                <div>
                                                    <div className="space-y-2">
                                                        <label className="text-base font-bold text-white mr-2">
                                                            Governance Proposal #
                                                        </label>
                                                        <input
                                                            className="bg-white text-black rounded-sm p-1"
                                                            value={proposalNumber}
                                                            onChange={(e) => setProposalNumber(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-base font-bold text-white mr-2">Block height</label>
                                                        <input
                                                            disabled={attemptFindBlock === true}
                                                            className="bg-white text-black rounded-sm p-1 disabled:bg-slate-400"
                                                            value={blockHeight}
                                                            onChange={(e) => setBlockHeight(Number(e.target.value))}
                                                        />
                                                        <label className="text-base font-bold text-white mx-2">OR</label>
                                                        <input
                                                            type="checkbox"
                                                            className="text-black"
                                                            checked={attemptFindBlock === true}
                                                            onChange={() => setAttemptFindBlock(!attemptFindBlock)}
                                                        />
                                                        <label className="text-base font-bold text-white mx-2">
                                                            attempt to auto find block
                                                        </label>
                                                    </div>
                                                    <button
                                                        onClick={() => { void getPropVoters(); }}
                                                        className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white mt-6 shadow-lg"
                                                    >
                                                        Get voters
                                                    </button>
                                                    {airdropDetails.length > 0 && (
                                                        <AirdropListSection
                                                            recipients={airdropDetails}
                                                            setRecipients={setAirdropDetails}
                                                            distMode="fair"
                                                            total={dropAmount}
                                                            tokenSymbol={tokenSymbol}
                                                            tokenDecimals={tokenDecimals}
                                                            filter="vote"
                                                            columns={{ include: true, position: true, balance: false, vote: true }}
                                                            network={currentNetwork}
                                                            csvFilename={`airdrop-${tokenSymbol}-gov.csv`}
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {dropMode.value === "BUYBACK" && (
                                                <div>
                                                    {currentNetwork !== "mainnet" ? (
                                                        <div className="text-amber-400 text-sm">
                                                            Community BuyBack is a mainnet-only program. Switch to
                                                            mainnet to load round participants.
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="space-y-2">
                                                                <label className="text-base font-bold text-white">
                                                                    BuyBack round
                                                                </label>
                                                                <Select
                                                                    className="text-black"
                                                                    value={buybackRound}
                                                                    onChange={setBuybackRound}
                                                                    options={buybackRounds}
                                                                    isLoading={buybackRounds.length === 0}
                                                                    placeholder={
                                                                        buybackRounds.length
                                                                            ? "Select a round"
                                                                            : "Loading rounds…"
                                                                    }
                                                                />
                                                                <div className="text-xs text-slate-400">
                                                                    Wallets that committed INJ in the selected monthly
                                                                    buyback round.
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 mb-2">
                                                                <DistributionToggle
                                                                    value={distMode}
                                                                    onChange={setDistMode}
                                                                />
                                                            </div>
                                                            <button
                                                                disabled={loading || !buybackRound}
                                                                onClick={() => {
                                                                    void getBuybackParticipants();
                                                                }}
                                                                className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white mt-2 shadow-lg disabled:opacity-50"
                                                            >
                                                                Get participants
                                                            </button>
                                                            {airdropDetails.length > 0 && (
                                                                <AirdropListSection
                                                                    recipients={airdropDetails}
                                                                    setRecipients={setAirdropDetails}
                                                                    distMode={activeDist}
                                                                    total={dropAmount}
                                                                    tokenSymbol={tokenSymbol}
                                                                    tokenDecimals={tokenDecimals}
                                                                    sourceSymbol="INJ"
                                                                    sourceDecimals={2}
                                                                    filter="none"
                                                                    columns={{ include: true, position: true, balance: true }}
                                                                    network={currentNetwork}
                                                                    csvFilename={`airdrop-${tokenSymbol}-buyback-round-${
                                                                        buybackRound?.value ?? ""
                                                                    }.csv`}
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {dropMode.value === "MITO" && (
                                                <div>
                                                    <button
                                                        disabled={loading}
                                                        onClick={() => { void getMitoMarketList(); }}
                                                        className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white shadow-lg"
                                                    >
                                                        Get vault list
                                                    </button>
                                                    {mitoVaults.length > 0 && (
                                                        <div className="mt-2">
                                                            <label>Select Vault</label>
                                                            <Select
                                                                className="text-black"
                                                                value={selectedMitoVault}
                                                                options={mitoVaults}
                                                                onChange={setSelectedMitoVault}
                                                            />
                                                        </div>
                                                    )}
                                                    {selectedMitoVault !== null && (
                                                        <div className="mt-4">
                                                            <div className="mt-4 mb-2">
                                                                <DistributionToggle value={distMode} onChange={setDistMode} />
                                                            </div>
                                                            <div className="mt-4 mb-2">
                                                                <label className="text-base font-bold text-white">Balance type</label>
                                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setMitoHolderType("non-stake")}
                                                                        className={`rounded-md p-2 text-sm border transition ${
                                                                            mitoHolderType === "non-stake"
                                                                                ? "bg-slate-600 border-slate-400 text-white"
                                                                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                                                        }`}
                                                                    >
                                                                        total balance
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setMitoHolderType("stake")}
                                                                        className={`rounded-md p-2 text-sm border transition ${
                                                                            mitoHolderType === "stake"
                                                                                ? "bg-slate-600 border-slate-400 text-white"
                                                                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                                                        }`}
                                                                    >
                                                                        staked balance only
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    void getMitoVaultHolders(
                                                                        selectedMitoVault.value.matchingVault.contractAddress,
                                                                    );
                                                                }}
                                                                className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white shadow-lg"
                                                            >
                                                                Generate airdrop list
                                                            </button>
                                                        </div>
                                                    )}
                                                    {airdropDetails.length > 0 && (
                                                        <AirdropListSection
                                                            recipients={airdropDetails}
                                                            setRecipients={setAirdropDetails}
                                                            distMode={activeDist}
                                                            total={dropAmount}
                                                            tokenSymbol={tokenSymbol}
                                                            tokenDecimals={tokenDecimals}
                                                            sourceDecimals={2}
                                                            filter="topN"
                                                            columns={{ include: true, position: true, balance: true }}
                                                            network={currentNetwork}
                                                            csvFilename={`airdrop-${tokenSymbol}-mito.csv`}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-xl mb-5">Airdrop Tool</div>
                                    <img
                                        src={parachute}
                                        style={{ width: 140 }}
                                        className="m-auto rounded-xl mb-4"
                                        alt="airdrop"
                                    />
                                    <div className="mb-5">Please connect wallet to plan a new airdrop</div>
                                    <ConnectWallet hideNetwork={true} button={true} />
                                    <Link to="/airdrop-history">
                                        <div className="bg-slate-800 hover:bg-slate-700 p-2 mt-10 rounded-sm text-sm">
                                            View airdrop history
                                        </div>
                                    </Link>
                                </div>
                            )}

                            {error && <div className="text-red-500 mt-2">{error}</div>}

                            {/* Step 3 — review and confirm */}
                            {airdropDetails.length > 0 && connectedAddress && (
                                <div className="mt-5 border p-4 rounded-lg border-slate-700">
                                    <div className="text-base font-bold text-white">3. Review and confirm</div>
                                    {currentNetwork === "mainnet" && (
                                        <div className="mt-2">
                                            Fee: {humanReadableAmount(shroomCost)} shroom (${shroomPrice ? shroomPrice : "0"})
                                            <br />
                                            <a
                                                href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                                                className="underline text-sm"
                                            >
                                                buy here
                                            </a>
                                        </div>
                                    )}
                                    <button
                                        disabled={loading || (error && error.length > 0)}
                                        onClick={() => {
                                            updateDescription();
                                            setShowConfirm(true);
                                        }}
                                        className="bg-gray-800 hover:bg-gray-700 rounded-lg p-2 w-full text-white mt-6 shadow-lg disabled:opacity-50"
                                    >
                                        Review airdrop details
                                    </button>
                                </div>
                            )}

                            {loading && (
                                <div className="flex flex-col items-center justify-center pt-5">
                                    <GridLoader color="#f9d73f" />
                                    {progress.length > 0 && <div className="mt-2">{progress}</div>}
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

export default Airdrop;
