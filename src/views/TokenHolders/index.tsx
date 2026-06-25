import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { ClipLoader, GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, TokenInfo } from "../../constants/types";
import { useSearchParams } from 'react-router-dom';
import IPFSImage from "../../components/App/IpfsImage";
import { WALLET_LABELS } from "../../constants/walletLabels";
import TokenSelect from "../../components/Inputs/TokenSelect";
import { CW404_TOKENS, NFT_COLLECTIONS } from "../../constants/contractAddresses";
import HoldersChart from "../../components/App/HoldersChart";
import { MdWarning } from "react-icons/md";
import Footer from "../../components/App/Footer";
import { humanReadableAmount } from "../../utils/helpers";
import { shortAddress } from "../../utils/format";
import { arrayToCsv, downloadCsv } from "../../utils/csv";
import { evmAddressUrl, EVM_ADDRESS_RE } from "../../utils/evm";
import { gql, useMutation, useQuery } from "@apollo/client";
import dayjs from "dayjs";
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GrStatusUnknown } from "react-icons/gr";
import TokenHoldersTable from "./TokenHolderTable";
import useNetworkStore from "../../store/useNetworkStore";
import useTokenStore from "../../store/useTokenStore";
import useLiquidityPoolStore from "../../store/usePoolStore";
import { PANEL } from "../ShroomHub/styles";
import { SectionHeader, StatTile } from "../ShroomHub/ui";

const QUNT_DENOM = "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt";
const QUNT_LOGO = "https://wsrv.nl/?url=https%3A%2F%2Fi.ibb.co%2FRBHCm14%2Fbennypfp.png&n=-1";
const BTN =
    "rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5";

const INJ_CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

// One DEX liquidity source for a token, in the shape the holder UI consumes.
interface LiqEntry {
    infoDecoded: { contract_addr: string };
    factory: { name: string };
    price: number;
    liquidity: number;
    marketCap: number;
}

// The address forms a token can appear under in Choice's pool list: the cw20
// contract, its bank-adapter denom, and the inner token of a factory denom.
const addressForms = (denom: string): Set<string> => {
    const set = new Set<string>([denom]);
    set.add(`factory/${INJ_CW20_ADAPTER}/${denom}`);
    const m = /^factory\/[^/]+\/(.+)$/.exec(denom);
    if (m) set.add(m[1]);
    return set;
};

const assetUsdPrice = (asset: any): number | null => {
    const p = asset?.prices?.[0]?.price;
    return p != null ? Number(p) : null;
};

// Derive a token's DEX liquidity + USD price straight from the Choice pool/token
// stores — no on-chain factory scan needed. Pools carry their own USD TVL and
// the token registry carries the current price.
const deriveChoiceLiquidity = (
    denom: string,
    pools: any[],
    tokens: any[],
): { pools: LiqEntry[]; price: number | null } => {
    const forms = addressForms(denom);
    const matched = pools.filter(
        (p) => forms.has(p.asset_1?.address) || forms.has(p.asset_2?.address),
    );
    const storePrice = tokens.find((t) => forms.has(t.address))?.price ?? null;
    const tokenSide = (p: any) => (forms.has(p.asset_1?.address) ? p.asset_1 : p.asset_2);
    const price =
        storePrice && Number(storePrice) > 0
            ? Number(storePrice)
            : matched.length
              ? assetUsdPrice(tokenSide(matched[0]))
              : null;
    const entries: LiqEntry[] = matched.map((p) => ({
        infoDecoded: { contract_addr: p.contract_addr },
        factory: { name: p.dex?.name ?? "DEX" },
        price: price ?? 0,
        liquidity: Number(p.tvl) || 0,
        marketCap: 0,
    }));
    return { pools: entries, price: price ?? null };
};


const HOLDER_QUERY = gql`
query getTokenHolders($address: String!, $addresses: [String!], $balanceMin: float8) {
  token_info:token_tracker_token_by_pk(address: $address){
    address
    name
    symbol
    total_supply
    circulating_supply
    decimals
    holders_last_updated
    holders_query_progress
    holders_save_progress
  }
  holders: wallet_tracker_balance(where: {token_id: {_in: $addresses}, balance: { _gt: $balanceMin }}, order_by: {balance:desc}) {
    wallet_id
    balance
    percentage_held
    token_id
    id
  }
  holder_aggregate: wallet_tracker_balance_aggregate(
    where: {
      token_id: { _in: $addresses }
      balance: { _gt: 0 }
    }
  ) {
    aggregate {
      count
    }
  }
}
`

const PROGRESS_QUERY = gql`
query getTokenHolders($addresses: [String!]) {
  token_info: token_tracker_token(where: {address: {_in: $addresses}}) {
    address
    holders_query_progress
    holders_save_progress
    holders_last_updated
    balances_aggregate {
      aggregate {
        count
      }
    }
  }
}
`

const UPDATE_TOKEN_HOLDERS_MUTATION = gql`
mutation updateTokenHolders($address: String!){
  updateTokenHolders(address: $address){
    success
  }
}
`

const ITEMS_PER_PAGE = 50;

// If the reported progress hasn't advanced for this long, the backend update
// task has almost certainly died (e.g. the worker was killed mid-run, which
// leaves the progress fields frozen). Treat it as stuck and re-offer Refresh so
// the user isn't stranded staring at a progress bar that will never move.
const STUCK_AFTER_MS = 2 * 60 * 1000;

interface ProgressBarProps {
    queryProgress: number | null;
    saveProgress: number | null;
}

const ProgressBar = ({ queryProgress, saveProgress }: ProgressBarProps) => {
    const [progress, setProgress] = useState(0);
    const prevProgress = useRef(0);
    const label = saveProgress !== null ? 'Holders Saving to Database' : 'Update Query Progress';

    useEffect(() => {
        const newProgress = saveProgress !== null ? saveProgress : queryProgress;
        if (newProgress !== null && newProgress >= prevProgress.current) {
            setProgress(Math.min(Number(newProgress.toFixed(2)), 100));
            prevProgress.current = newProgress;
        }
    }, [queryProgress, saveProgress]);

    return (
        <div className="w-full max-w-md mx-auto mt-4">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{label}</span>
                <span className="text-sm font-medium text-white">{progress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3">
                <div
                    className="bg-[#36d7b7] h-3 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

const TokenHolders = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const { tokens } = useTokenStore()

    const inFlight = useRef<AbortController | null>(null);

    const [contractAddress, setContractAddress] = useState(() => {
        const tokenOptions = tokens.map((t) => ({ value: t.address, label: t.symbol, img: t.icon }));
        const address = searchParams.get("address");
        if (!address) {
            return tokenOptions.find(x => x.value === "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8")
        }
        return tokenOptions.find(x => x.value === address) || NFT_COLLECTIONS.find(x => x.value === address) || { label: address, value: address };
    });

    const netPrefix = currentNetwork === 'testnet' ? 'testnet.' : '';
    const explorerBase = `https://${netPrefix}explorer.injective.network`;

    const { data, loading: queryLoading, refetch } = useQuery(HOLDER_QUERY, {
        skip: !contractAddress || !contractAddress.value,
        fetchPolicy: "network-only",
        pollInterval: 60000,
        variables: {
            address: contractAddress?.value || "",
            addresses: contractAddress ? [
                contractAddress.value,
                `factory/${INJ_CW20_ADAPTER}/${contractAddress.value}`
            ] : [],
            balanceMin: contractAddress && contractAddress.value == "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt" ? 1 : 0,
        }
    });

    const { data: progressData } = useQuery(PROGRESS_QUERY, {
        skip: !contractAddress || !contractAddress.value,
        pollInterval: 5000,
        fetchPolicy: "network-only",
        variables: {
            addresses: contractAddress ? [
                contractAddress.value,
                `factory/${INJ_CW20_ADAPTER}/${contractAddress.value}`
            ] : [],
        }
    });

    const [updateTokenHolders] = useMutation(UPDATE_TOKEN_HOLDERS_MUTATION)

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    // ERC-20 address this token is paired with on Injective EVM (null = none).
    const [erc20Pair, setErc20Pair] = useState<string | null>(null);
    // Toggle to display holder addresses in their EVM (0x) form.
    const [showEvm, setShowEvm] = useState(false);

    const [holders, setHolders] = useState<Holder[]>([]);
    const [totalHolderCount, setTotalHolderCount] = useState<number | null>(null)
    const [hasSplitBalances, setHasSplitBalances] = useState(false)

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState<string | null>(null)

    const [lastLoadedAddress, setLastLoadedAddress] = useState("")
    const [holdersLastUpdated, setHoldersLastUpdated] = useState<any>(null)

    const [liquidity, setLiquidity] = useState<any[]>([])
    const [findingLiq, setFindingLiq] = useState(false)
    const [liqError, setLiqError] = useState(false)
    const [totalBurned, setTotalBurned] = useState<number | null>(null)
    const [totalTreasuryHoldings, setTotalTreasuryHoldings] = useState<number | null>(null)

    const [mitoVault, setMitoVault] = useState<any>(null)
    const [tokenPrice, setTokenPrice] = useState<number | null>(null)

    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("");

    const [queryProgress, setQueryProgress] = useState<number | null>(null)
    const [saveProgress, setSaveProgress] = useState<number | null>(null)

    // True once an in-progress update has stopped advancing for STUCK_AFTER_MS —
    // i.e. its worker died and the progress fields are frozen.
    const [progressStalled, setProgressStalled] = useState(false)
    // Last seen progress signature + when it last changed, to detect the stall.
    // Seeded with at:0 (no Date.now() during render); the effect below resets it
    // before the timestamp is ever used in a comparison.
    const progressStallRef = useRef<{ sig: string; at: number }>({ sig: "", at: 0 })

    const startIndex = useMemo(() => {
        return (currentPage - 1) * ITEMS_PER_PAGE;
    }, [currentPage]);

    const endIndex = useMemo(() => {
        return startIndex + ITEMS_PER_PAGE;
    }, [startIndex]);

    const paginatedHolders = useMemo(() => {
        return holders
            .slice(startIndex, endIndex);
    }, [holders, startIndex, endIndex]);

    const totalPages = useMemo(() => {
        return Math.ceil(holders.length / ITEMS_PER_PAGE);
    }, [holders.length]);


    const handlePageInput = (e: any) => {
        const value = e.target.value;
        if (value === "" || /^[0-9\b]+$/.test(value)) {
            setPageInput(value);
        }
    };

    const goToPage = (e: any) => {
        e.preventDefault();
        const pageNumber = parseInt(pageInput, 10);
        if (!isNaN(pageNumber) && pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
        setPageInput("");
    };

    useEffect(() => {
        if (contractAddress) {
            setSearchParams({
                address: (contractAddress.value ? contractAddress.value : contractAddress) as any
            })
        }
    }, [contractAddress, setSearchParams])

    // Reset to the first page whenever a new token is selected, otherwise we can
    // land on a stale page index past the new token's holder count (empty table
    // showing e.g. "Page 8 of 1" until the user manually navigates back).
    useEffect(() => {
        setCurrentPage(1);
    }, [contractAddress?.value])

    useEffect(() => {
        setLastLoadedAddress("")
    }, [networkConfig])

    const handleUpdateTokenHolders = useCallback(() => {
        updateTokenHolders({
            variables: {
                address: (contractAddress?.value ? contractAddress.value : contractAddress) as any
            }
        }).then(() => {
            toast.success('Request sent to update holders. May take a few minutes...', {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
                transition: Bounce,
            });
        }).catch(e => {
            console.log(e)
        })
    }, [contractAddress, updateTokenHolders])

    useEffect(() => {
        if (!progressData || !Array.isArray(progressData.token_info)) return;

        const queryProgresses = progressData.token_info
            .map((info: any) => {
                const totalHolderCount = info.balances_aggregate?.aggregate?.count || 1;
                return info.holders_query_progress
                    ? (info.holders_query_progress / totalHolderCount) * 100
                    : null;
            })
            .filter((value: any) => value !== null);

        const saveProgresses = progressData.token_info
            .map((info: any) => info.holders_save_progress)
            .filter((value: any) => value !== null);

        const minQueryProgress = queryProgresses.length > 0 ? Math.min(...queryProgresses) : null;
        const minSaveProgress = saveProgresses.length > 0 ? Math.min(...saveProgresses) : null;

        setQueryProgress(minQueryProgress);
        setSaveProgress(minSaveProgress);

        // Stall detection: this effect re-runs on every poll (every 5s). If the
        // progress signature is unchanged for STUCK_AFTER_MS, the update task is
        // dead and we surface Refresh again (see below). Any change — including
        // progress clearing to null on completion — resets the timer.
        const sig = `${minQueryProgress}|${minSaveProgress}`;
        const now = Date.now();
        if ((minQueryProgress === null && minSaveProgress === null) || sig !== progressStallRef.current.sig) {
            progressStallRef.current = { sig, at: now };
            setProgressStalled(false);
        } else if (now - progressStallRef.current.at > STUCK_AFTER_MS) {
            setProgressStalled(true);
        }

        if (!minQueryProgress && !minSaveProgress) void refetch();
    }, [progressData, refetch]);

    useEffect(() => {
        if (!data) {
            setHoldersLastUpdated(null)
            return;
        }

        const BURN_ADDRESSES = [
            dojoBurnAddress,
            injBurnAddress,
        ]

        if (data.token_info && data.token_info.address) {
            BURN_ADDRESSES.push(data.token_info.address)
            setHoldersLastUpdated(data.token_info.holders_last_updated)
        }
        else {
            setHoldersLastUpdated(null)
        }

        const balances = data.holders;
        const tokenIds = new Set(balances.map((holder: any) => holder.token_id));

        if (tokenIds.size === 2) {
            setHasSplitBalances(true);
        } else {
            setHasSplitBalances(false);
        }

        const groupedByWallet = balances.reduce((acc: any, holder: any) => {
            if (!acc[holder.wallet_id]) {
                acc[holder.wallet_id] = {
                    cw20Balance: 0,
                    bankBalance: 0,
                    totalBalance: 0,
                    hasBothTokens: false,
                    wallet_id: holder.wallet_id
                };
            }
            const isFactoryToken = holder.token_id.includes("factory");
            const balanceValue = parseFloat(holder.balance);
            if (isFactoryToken) {
                acc[holder.wallet_id].bankBalance += balanceValue; // Accumulate bankBalance
            } else {
                acc[holder.wallet_id].cw20Balance += balanceValue; // Accumulate cw20Balance
            }
            if (acc[holder.wallet_id].cw20Balance > 0 && acc[holder.wallet_id].bankBalance > 0) {
                acc[holder.wallet_id].hasBothTokens = true;
            }
            return acc;
        }, {});

        let totalSupply = Object.values(groupedByWallet).reduce((sum: number, holder: any) => {
            if (holder.wallet_id === INJ_CW20_ADAPTER) {
                return sum + 0; // Only include cw20Balance, exclude factory token balance
            }
            return sum + (holder.cw20Balance + holder.bankBalance);

        }, 0);
        totalSupply = Math.round(totalSupply)

        const finalHolderList = Object.entries(groupedByWallet).map(([wallet_id, holder]: [string, any]) => {
            return {
                address: wallet_id,
                balance: holder.cw20Balance + holder.bankBalance,  // Total combined balance
                percentageHeld: (holder.cw20Balance + holder.bankBalance) / totalSupply * 100,
                cw20Balance: holder.cw20Balance ? holder.cw20Balance : 0,
                bankBalance: holder.bankBalance ? holder.bankBalance : 0,
                usdValue: tokenPrice ? Number(holder.cw20Balance + holder.bankBalance) * tokenPrice : null
            };
        }).filter(x => x.balance !== 0).sort((a, b) => b.balance - a.balance)

        setHolders(finalHolderList as Holder[]);

        if (tokenIds.size === 1) {
            setTotalHolderCount(data.holder_aggregate.aggregate.count)
        }
        else {
            setTotalHolderCount(finalHolderList.length)
        }

        const totalBurnedBalance = finalHolderList
            .filter(addressObj => BURN_ADDRESSES.includes(addressObj.address))
            .reduce((total, addressObj) => {
                return total + addressObj.balance;
            }, 0);

        setTotalBurned(totalBurnedBalance)

        const totalTreasuryHoldings = finalHolderList
            .filter(addressObj => (WALLET_LABELS as Record<string, any>)[addressObj.address]?.treasury)
            .reduce((total, addressObj) => {
                return total + addressObj.balance;
            }, 0);

        if (data.token_info && data.token_info.address == "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt") {
            setTotalTreasuryHoldings(totalTreasuryHoldings);
        }
        else {
            setTotalTreasuryHoldings(0)
        }
    }, [data, tokenPrice]);

    const getSpotMarkets = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchSpotMarkets();
            return markets;
        } catch (error) {
            console.error('Failed to fetch spot markets:', error);
            throw error;
        }
    }, [networkConfig]);

    const getMitoVaults = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchMitoVaults();
            return markets;
        } catch (error) {
            console.error('Failed to fetch mito vaults:', error);
            throw error;
        }
    }, [networkConfig]);

    const findLiquidity = useCallback(
        async (signal: AbortSignal) => {
            if (signal.aborted) return;

            const module = new TokenUtils(networkConfig);
            setFindingLiq(true);

            try {
                const denom = tokenInfo!.denom;

                // ---- DEX liquidity + price from the Choice stores (instant,
                // already loaded) instead of an on-chain factory scan. ----
                const poolsSnap = useLiquidityPoolStore.getState().pools;
                const tokensSnap = useTokenStore.getState().tokens;
                const choiceLiq = deriveChoiceLiquidity(denom, poolsSnap, tokensSnap);

                // ---- Mito MM vault lives on Helix, not in Choice's pool table,
                // so it's still discovered via the markets/vaults endpoints. ----
                const bankDenom = denom.includes('factory')
                    ? denom
                    : `factory/${INJ_CW20_ADAPTER}/${denom}`;

                const [spotMarkets, mitoVaults] = await Promise.all([
                    getSpotMarkets(),
                    getMitoVaults()
                ]);

                if (signal.aborted) {
                    return;  // guard after awaited work
                }

                const market = [...spotMarkets].reverse()
                    .find(m => m.baseDenom === bankDenom);
                const vault = market
                    ? [...mitoVaults].reverse().find(v => v.marketId === market.marketId)
                    : null;

                let price: number | null = choiceLiq.price;

                if (vault) {
                    setMitoVault(vault);
                    if (price == null) {
                        price = await module.getHelixMarketBestBuy(
                            vault.marketId,
                            18 - tokenInfo!.decimals,
                        );
                        if (signal.aborted) return;
                    }
                }

                if (choiceLiq.pools.length === 0 && !vault) {
                    setLiqError(true);
                    return;
                }

                setLiquidity(choiceLiq.pools);

                const validPrice = price ?? (choiceLiq.pools[0]?.price ?? null);
                if (validPrice != null) {
                    setHolders(h =>
                        h.map(x => ({ ...x, usdValue: Number(x.balance) * validPrice }))
                    );
                    setTokenPrice(validPrice);
                }
                setFindingLiq(false);
            } catch (e: any) {
                if (!signal.aborted) {
                    console.error('Error during liquidity fetch:', e);
                    setLiqError(true);
                    setFindingLiq(false);
                }
            } finally {

                inFlight.current = null;
            }
        },
        [tokenInfo, networkConfig, getSpotMarkets, getMitoVaults]
    );


    useEffect(() => {
        if (
            !tokenInfo ||
            liqError
        ) {
            return;
        }

        inFlight.current?.abort();

        const ctrl = new AbortController();
        inFlight.current = ctrl;

        findLiquidity(ctrl.signal).catch(console.error).finally(() => setFindingLiq(false));

        return () => ctrl.abort();
    }, [liqError, findLiquidity, tokenInfo]);


    const getTokenHolders = useCallback(async (address: string) => {
        if (loading) return
        if (lastLoadedAddress == address) return
        // A bare 0x address is resolved to its bank denom by the effect below;
        // don't try to load token info for it directly.
        if (EVM_ADDRESS_RE.test(address)) return
        const module = new TokenUtils(networkConfig);

        setLoading(true);
        setError(null);
        setTokenInfo(null);
        setPairMarketing(null);
        setErc20Pair(null);

        setProgress("");
        setLiquidity([])
        setMitoVault(null)
        setTokenPrice(null)
        setFindingLiq(false)
        setLiqError(false)

        try {
            const is404 = CW404_TOKENS.find(x => x.value == address) !== undefined
            const isNFT = NFT_COLLECTIONS.find(x => x.value == address) !== undefined

            if (is404) {
                const tokenInfo = await module.getCW404TokenInfo(address);
                setTokenInfo({ ...tokenInfo, denom: address });
                const holders = await module.getCW404Holders(address, setProgress)
                if (holders) setHolders(holders);
            }
            else if (isNFT) {
                const tokenInfo = await module.getNFTCollectionInfo(address)
                const holders = await module.getNFTHolders(address, setProgress)
                setTokenInfo({ ...tokenInfo, denom: address });
                if (holders) setHolders(holders as Holder[]);
            }
            else if (address.includes("factory") || address.includes("peggy") || address.includes("ibc")) {
                const metadata = await module.getDenomExtraMetadata(address);
                setTokenInfo(metadata as TokenInfo);
            }
            else {
                try {
                    const tokenInfo = await module.getTokenInfo(address);
                    setTokenInfo({ ...tokenInfo, denom: address });
                    const marketingInfo = await module.getTokenMarketing(address);
                    setPairMarketing(marketingInfo);
                } catch (error) {
                    if ((error as any).message.includes("Error parsing into type cw404")) {
                        try {
                            const tokenInfo = await module.getCW404TokenInfo(address);
                            setTokenInfo({ ...tokenInfo, denom: address });
                            const holders = await module.getCW404Holders(address, setProgress)
                            if (holders) setHolders(holders);
                        } catch (innerError) {
                            console.error("Error with CW404 token info retrieval:", innerError);
                        }
                    }
                    else if ((error as any).message.includes("Error parsing into type talis_nft") || (error as any).message.includes("Error parsing into type cw721_base") || (error as any).message.includes("Error parsing into type common::talis_nft")) {
                        const tokenInfo = await module.getNFTCollectionInfo(address)
                        const holders = await module.getNFTHolders(address, setProgress)
                        setTokenInfo({ ...tokenInfo, denom: address });
                        if (holders) setHolders(holders as Holder[]);
                    }
                    else {
                        console.error("Error with token info retrieval:", error);
                    }
                }
            }

            // Bank-denom tokens (tokenfactory/peggy/ibc/inj) can be paired with
            // an ERC-20 on the EVM — the paired holders are the SAME accounts,
            // so this is just status/explorer enrichment, not a second source.
            if (address.includes("factory") || address.includes("peggy") || address.includes("ibc") || address === "inj") {
                setErc20Pair(await module.getErc20Pair(address));
            }

            setLastLoadedAddress(address);
        } catch (e) {
            console.log(e);
            if (e && (e as any).message) {
                setError((e as any).message);
            }
            throw e
        } finally {
            setLoading(false);

        }
    }, [loading, lastLoadedAddress, networkConfig]);

    // If the user pastes an ERC-20 (0x) address, resolve it to the paired bank
    // denom and swap it in — everything downstream then keys off the denom.
    useEffect(() => {
        const v = contractAddress?.value;
        if (!v || !EVM_ADDRESS_RE.test(v)) return;
        let cancelled = false;
        const module = new TokenUtils(networkConfig);
        module.getErc20PairBankDenom(v).then((denom) => {
            if (cancelled) return;
            if (denom) setContractAddress({ value: denom, label: denom });
            else setError("No token is paired with that ERC-20 address.");
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [contractAddress, networkConfig]);

    useEffect(() => {
        const address = searchParams.get("address")
        if (address && address !== lastLoadedAddress && !loading) {
            getTokenHolders(address).catch(e => {
                console.error(e)
                setLastLoadedAddress(address);
            })
            setContractAddress((address: any) => tokens.find(v => v.address == address) ?? address)
        }
    }, [searchParams, lastLoadedAddress, getTokenHolders, loading, tokens])

    const downloadHoldersCsv = () => {
        const rows = holders.map(h => ({
            "Holder Address": h.address,
            "Balance": h.balance,
            "Percentage Held": h.percentageHeld,
        }));
        downloadCsv("holders.csv", arrayToCsv(rows, ["Holder Address", "Balance", "Percentage Held"]));
    };

    // Prefer Choice's registry logo (already loaded into the token store) over
    // raw on-chain metadata, which is frequently a dead IPFS link.
    const choiceLogo = useMemo(() => {
        const addr = tokenInfo?.denom ?? lastLoadedAddress;
        return tokens.find((t) => t.address === addr)?.icon;
    }, [tokens, tokenInfo, lastLoadedAddress]);

    const logoSrc =
        tokenInfo?.denom === QUNT_DENOM
            ? QUNT_LOGO
            : choiceLogo || tokenInfo?.logo || pairMarketing?.logo?.url || null;

    // Derived supply / value figures shown as stat tiles in the overview panel.
    const priceForCalc = tokenPrice ?? (liquidity.length > 0 ? liquidity[0].price : null);
    const supplyWhole =
        tokenInfo?.total_supply != null
            ? tokenInfo.total_supply / Math.pow(10, tokenInfo.decimals)
            : null;
    const circulating =
        supplyWhole != null && totalBurned != null ? supplyWhole - totalBurned : null;
    const totalLiquidity =
        liquidity.length > 0
            ? (mitoVault ? mitoVault.currentTvl : 0) +
              liquidity.reduce((acc, item) => acc + item.liquidity, 0)
            : mitoVault
              ? mitoVault.currentTvl
              : null;
    const usd = (whole: number | null) =>
        whole != null && priceForCalc != null
            ? `$${humanReadableAmount(whole * priceForCalc)}`
            : null;

    const adminLabel =
        tokenInfo?.admin != null
            ? (WALLET_LABELS as Record<string, any>)[tokenInfo.admin]
            : null;

    return (
        <div className="flex min-h-screen flex-col bg-customGray text-stone-100">
            <ToastContainer />
            <div className="mx-auto w-full max-w-5xl space-y-4 px-3 pt-20 pb-16 sm:px-5 md:space-y-5 md:pt-24">
                {/* ---- title ---- */}
                <div className="text-center">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                        Injective mainnet
                    </div>
                    <h1 className="font-magic text-3xl text-white md:text-4xl">Token holders</h1>
                </div>

                {/* ---- search ---- */}
                <section className={`${PANEL} p-5 md:p-6`}>
                    <label htmlFor="token-address" className="mb-2 block font-sans text-sm text-white/60">
                        Token address
                    </label>
                    <TokenSelect
                        options={[
                            {
                                label: "TOKENS",
                                options: tokens.filter(x => x.show_on_ui).map((t) => {
                                    return {
                                        value: t.address,
                                        label: t.symbol,
                                        img: t.icon
                                    }
                                }).sort((a, b) => a.label.localeCompare(b.label))
                            },
                            {
                                label: "CW404",
                                options: CW404_TOKENS
                            },
                            {
                                label: "NFT",
                                options: NFT_COLLECTIONS
                            }
                        ]}
                        selectedOption={contractAddress}
                        setSelectedOption={setContractAddress}
                    />

                    {!loading && !queryLoading &&
                        <div className="mt-4 flex flex-wrap items-center gap-3 font-sans text-sm text-white/60">
                            {holdersLastUpdated ?
                                <span>Holders last updated: {dayjs(holdersLastUpdated).fromNow()}</span>
                                :
                                <span className="flex items-center gap-2">
                                    Unknown last updated <GrStatusUnknown className="text-base" />
                                </span>
                            }
                            {(!queryProgress && !saveProgress || progressStalled) &&
                                <button onClick={handleUpdateTokenHolders} className={BTN}>
                                    Refresh
                                </button>
                            }
                            {progressStalled &&
                                <span className="flex items-center gap-1 text-amber-400">
                                    <MdWarning className="text-base" /> Update looks stuck — try Refresh
                                </span>
                            }
                        </div>
                    }
                    {(queryProgress || saveProgress) && !progressStalled &&
                        <ProgressBar queryProgress={queryProgress} saveProgress={saveProgress} />
                    }
                    {error && <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 font-sans text-sm text-red-400">
                        {error}
                    </div>}
                </section>

                {/* ---- token overview ---- */}
                {tokenInfo && (
                    <section className={`${PANEL} p-5 md:p-6`}>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                            {logoSrc &&
                                <IPFSImage
                                    width={88}
                                    className="shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                                    ipfsPath={logoSrc}
                                />
                            }
                            <div className="min-w-0 flex-1 font-sans text-sm text-white/65">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="text-2xl font-semibold text-white">{tokenInfo.name}</span>
                                    {tokenInfo.symbol &&
                                        <span className="text-lg text-white/45">{tokenInfo.symbol}</span>
                                    }
                                </div>
                                <div className="mt-0.5 break-all text-white/40">{tokenInfo.denom}</div>

                                {tokenInfo.description && tokenInfo.description.length > 0 &&
                                    <div className="mt-2 text-white/55">{tokenInfo.description}</div>
                                }
                                {tokenInfo.decimals !== null &&
                                    <div className="mt-2">decimals: <span className="text-white/85">{tokenInfo.decimals}</span></div>
                                }

                                {erc20Pair && (
                                    <div className="mt-1">
                                        ERC-20:{" "}
                                        <a
                                            className="text-emerald-400 underline break-all"
                                            target="_blank"
                                            href={evmAddressUrl(currentNetwork, erc20Pair)}
                                        >
                                            {shortAddress(erc20Pair)}
                                        </a>
                                        <span className="block text-xs text-white/40">paired on Injective EVM — same holders as the bank token</span>
                                    </div>
                                )}

                                {pairMarketing ? (
                                    <div className="mt-2 space-y-0.5">
                                        {pairMarketing.project && <div>project: <span className="text-white/85">{pairMarketing.project}</span></div>}
                                        {pairMarketing.description && <div>{pairMarketing.description}</div>}
                                        {pairMarketing.marketing &&
                                            <div>
                                                marketing:{" "}
                                                <a className="underline" href={`${explorerBase}/account/${pairMarketing.marketing}`}>
                                                    {shortAddress(pairMarketing.marketing)}
                                                </a>
                                                {(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing] && (
                                                    <span className={`${(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].bgColor} ${(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].textColor} ml-2`}>
                                                        {(WALLET_LABELS as Record<string, any>)[pairMarketing.marketing].label}
                                                    </span>
                                                )}
                                            </div>
                                        }
                                    </div>
                                ) : (
                                    tokenInfo.admin &&
                                    <div className="mt-2">
                                        <a className="underline" href={`${explorerBase}/account/${tokenInfo.admin}`}>
                                            admin: {shortAddress(tokenInfo.admin)}
                                            {adminLabel && (
                                                <span className={`${adminLabel.bgColor} ${adminLabel.textColor} ml-2`}>
                                                    {adminLabel.label}
                                                </span>
                                            )}
                                        </a>
                                        {tokenInfo.admin !== dojoBurnAddress && tokenInfo.admin !== injBurnAddress &&
                                            <div className="mt-1 flex flex-row items-center text-orange-400">
                                                admin can mint more supply <MdWarning className="ml-2" />
                                            </div>
                                        }
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* stat tiles */}
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatTile
                                label="Total supply"
                                value={supplyWhole != null ? humanReadableAmount(supplyWhole) : "—"}
                            />
                            <StatTile
                                label="Circulating"
                                value={circulating != null ? (
                                    <>
                                        {humanReadableAmount(circulating)}
                                        {usd(circulating) && <span className="ml-1 text-white/40">{usd(circulating)}</span>}
                                    </>
                                ) : "—"}
                            />
                            <StatTile
                                label="Burned 🔥"
                                value={totalBurned != null ? (
                                    <>
                                        {humanReadableAmount(totalBurned)}
                                        {usd(totalBurned) && <span className="ml-1 text-white/40">{usd(totalBurned)}</span>}
                                    </>
                                ) : "—"}
                            />
                            <StatTile
                                label="Liquidity"
                                accent
                                value={totalLiquidity != null ? `$${humanReadableAmount(totalLiquidity)}` : (findingLiq ? "…" : "—")}
                            />
                            {totalTreasuryHoldings !== null && totalTreasuryHoldings !== 0 && tokenInfo.denom === QUNT_DENOM && (
                                <StatTile
                                    label="Treasury 💰"
                                    value={
                                        <>
                                            {humanReadableAmount(totalTreasuryHoldings)}
                                            {usd(totalTreasuryHoldings) && <span className="ml-1 text-white/40">{usd(totalTreasuryHoldings)}</span>}
                                        </>
                                    }
                                />
                            )}
                        </div>

                        {/* liquidity sources */}
                        {(findingLiq || liquidity.length > 0 || mitoVault) &&
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                {findingLiq && <ClipLoader size={18} color="white" />}
                                {liquidity.map(({ infoDecoded, price, factory, liquidity }: any, index: number) => (
                                    <div key={index} className="rounded-xl bg-white/3 px-3 py-2 font-sans text-xs text-white/70">
                                        <a href={"https://coinhall.org/injective/" + infoDecoded.contract_addr} className="font-bold text-white hover:underline">
                                            {factory.name}
                                        </a>
                                        <div>price: ${price.toFixed(10)}</div>
                                        <div>liquidity: ${liquidity.toFixed(2)}</div>
                                        <Link to={`/token-liquidity?address=${infoDecoded.contract_addr}`} className="font-semibold text-trippyYellow hover:underline">
                                            view providers →
                                        </Link>
                                    </div>
                                ))}
                                {mitoVault !== null &&
                                    <div className="rounded-xl bg-white/3 px-3 py-2 font-sans text-xs text-white/70">
                                        <a href={`https://${netPrefix}mito.fi/vault/${mitoVault.contractAddress}`} className="font-bold text-white hover:underline">
                                            Mito vault
                                        </a>
                                        <div>liquidity: ${humanReadableAmount(mitoVault.currentTvl)}</div>
                                        {tokenPrice && <div>price: ${tokenPrice.toFixed(6)}</div>}
                                        <a className="font-semibold text-trippyYellow hover:underline" target="_blank" href={`https://${netPrefix}helixapp.com/spot/?marketId=${mitoVault.marketId}`}>
                                            helix market →
                                        </a>
                                    </div>
                                }
                            </div>
                        }
                    </section>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-10">
                        <GridLoader color="#f9d73f" />
                        {progress.length > 0 && <div className="mt-3 font-sans text-sm text-white/60">{progress}</div>}
                    </div>
                )}

                {/* ---- holders ---- */}
                {holders.length > 0 && (
                    <section className={`${PANEL} p-5 md:p-6`}>
                        <SectionHeader
                            eyebrow="Distribution"
                            title="Holders"
                            sub={totalHolderCount != null ? `${totalHolderCount.toLocaleString()} total` : undefined}
                        >
                            <div className="flex flex-wrap items-center gap-3 font-sans">
                                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
                                    <input type="checkbox" className="accent-trippyYellow" checked={showEvm} onChange={(e) => setShowEvm(e.target.checked)} />
                                    EVM (0x) addresses
                                </label>
                                <button onClick={downloadHoldersCsv} className={BTN}>Download CSV</button>
                            </div>
                        </SectionHeader>

                        <HoldersChart data={holders} />

                        <TokenHoldersTable
                            holders={paginatedHolders as any}
                            startIndex={startIndex}
                            hasSplitBalances={hasSplitBalances}
                            WALLET_LABELS={WALLET_LABELS}
                            lastLoadedAddress={lastLoadedAddress}
                            liquidity={liquidity}
                            findingLiq={findingLiq}
                            showEvm={showEvm}
                            network={currentNetwork}
                        />

                        {/* pagination */}
                        <div className="mt-4 flex flex-col items-center justify-between gap-3 font-sans text-sm text-white/60 sm:flex-row">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={BTN}
                                >
                                    Previous
                                </button>
                                <span>Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className={BTN}
                                >
                                    Next
                                </button>
                            </div>
                            <form onSubmit={goToPage} className="flex items-center gap-2">
                                <label htmlFor="pageSearch">Go to page:</label>
                                <input
                                    id="pageSearch"
                                    type="text"
                                    value={pageInput}
                                    onChange={handlePageInput}
                                    placeholder="#"
                                    className="w-20 rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-white placeholder:text-white/30"
                                />
                                <button type="submit" className={BTN}>Go</button>
                            </form>
                        </div>
                    </section>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default TokenHolders;
