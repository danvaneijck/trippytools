import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";
import ShroomBalance from "../../components/App/ShroomBalance";
import { WALLET_LABELS } from "../../constants/walletLabels";
import IPFSImage from "../../components/App/IpfsImage";
import AirdropConfirmModal from "./AirdropConfirmModal";
import { Holder, MarketingInfo } from "../../constants/types";
import { CW404_TOKENS, LIQUIDITY_TOKENS, NFT_COLLECTIONS, TOKENS } from "../../constants/contractAddresses";
import TokenSelect from "../../components/Inputs/TokenSelect";
import Papa from 'papaparse';
import { ChainGrpcGovApi } from '@injectivelabs/sdk-ts'
import moment from "moment";
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
import parachute from "../../assets/parachute.webp"
import Select from "react-select"
import Footer from "../../components/App/Footer";

const STAKING_CONTRACT_ADDRESS = 'inj1gtze7qm07nky47n7mwgj4zatf2s77xqvh3k2n8'


function humanReadableAmount(number) {
    if (!number) {
        return 0
    }
    const units = ["", "k", "m", "b", "t"];
    let unitIndex = 0;

    while (number >= 1000 && unitIndex < units.length - 1) {
        number /= 1000;
        unitIndex++;
    }

    return `${number.toFixed(number >= 10 ? 0 : 2)}${units[unitIndex]}`;
}

const Airdrop = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [tokenAddress, setTokenAddress] = useState(null);
    const [tokenInfo, setTokenInfo] = useState(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const dropModeOptions = [
        {
            value: "NFT",
            label: "NFT community"
        },
        {
            value: "TOKEN",
            label: "Token holders"
        },
        {
            value: "CSV",
            label: "Custom CSV file upload"
        },
        {
            value: "GOV",
            label: "Proposal Voters"
        },
        {
            value: "MITO",
            label: "Mito Vault Holders / Stakers"
        }
    ]

    const [balance, setBalance] = useState(0)
    const [balanceToDrop, setBalanceToDrop] = useState(0)

    const [limitSwitch, setLimitSwitch] = useState(false)
    const [walletLimit, setWalletLimit] = useState(0)

    const [shroomCost, setShroomCost] = useState(100000)
    const [shroomPrice, setShroomPrice] = useState(null)

    const [dropMode, setDropMode] = useState({
        value: "TOKEN",
        label: "Token Holders"
    });

    const [nftCollection, setNftCollection] = useState(NFT_COLLECTIONS[0]);
    const [nftCollectionInfo, setNftCollectionInfo] = useState(null);
    const [airdropTokenAddress, setAirdropTokenAddress] = useState(TOKENS[0]);
    const [airdropTokenInfo, setAirdropTokenInfo] = useState(null);

    const [airdropDetails, setAirdropDetails] = useState([]);

    const [showConfirm, setShowConfirm] = useState(false);

    const [proposalNumber, setProposalNumber] = useState(417)
    const [blockHeight, setBlockHeight] = useState(76938079)
    const [attemptFindBlock, setAttemptFindBlock] = useState(true)

    const [proposalVoters, setProposalVoters] = useState()
    const [filterByVote, setFilterByVote] = useState(false)

    const [criteria, setCriteria] = useState("")
    const [description, setDescription] = useState("")

    const [voteFilters, setVoteFilters] = useState({
        "VOTE_OPTION_YES": true,
        "VOTE_OPTION_ABSTAIN": true,
        "VOTE_OPTION_NO": true,
        "VOTE_OPTION_NO_WITH_VETO": true,
    })

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null)
    const [distMode, setDistMode] = useState("fair");
    const [progress, setProgress] = useState("")

    const [mitoHolderType, setMitoHolderType] = useState("non-stake");

    const [mitoVaults, setMitoVaults] = useState([])
    const [mitoHolders, setMitoHolders] = useState([])

    const [selectedMitoVault, setSelectedMitoVault] = useState(null)

    const handleCheckboxChange = (index: number, dist: string, balance) => {
        const newDetails = [...airdropDetails];
        newDetails[index].includeInDrop = !newDetails[index].includeInDrop;
        updateAirdropAmounts(newDetails, dist, null, balance);
        setAirdropDetails(newDetails);
    };

    const updateList = (dist: string, walletLimit, balance) => {
        const newDetails = [...airdropDetails];
        updateAirdropAmounts(newDetails, dist, walletLimit, balance);
        setAirdropDetails(newDetails);
    }

    const calculateMitoAirdrop = useCallback((holders, mitoHolderType, distMode) => {
        let airdropData = [];
        const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.00001));

        const excludedWallets = ["inj1gtze7qm07nky47n7mwgj4zatf2s77xqvh3k2n8", "inj1vcqkkvqs7prqu70dpddfj7kqeqfdz5gg662qs3"];

        const eligibleHolders = holders.filter(holder => !excludedWallets.includes(holder.holderAddress));

        const totalRelevantAmount = eligibleHolders.reduce((acc, holder) => {
            const relevantAmount = mitoHolderType === "stake" ? Number(holder.stakedAmount) : Number(holder.amount);
            return acc + relevantAmount;
        }, 0);

        airdropData = holders.map(holder => {
            const relevantAmount = mitoHolderType === "stake" ? Number(holder.stakedAmount) : Number(holder.amount);

            if (excludedWallets.includes(holder.holderAddress)) return null;

            if (distMode === "fair") {
                const amountToAirdrop = supplyToAirdrop / eligibleHolders.length;
                return {
                    address: holder.holderAddress,
                    balance: relevantAmount,
                    amountToAirdrop,
                    percentToAirdrop: (amountToAirdrop / supplyToAirdrop) * 100,
                    includeInDrop: true
                };
            } else if (distMode === "proportionate") {
                const percentToAirdrop = (relevantAmount / totalRelevantAmount) * 100;
                const amountToAirdrop = (relevantAmount / totalRelevantAmount) * supplyToAirdrop;
                return {
                    address: holder.holderAddress,
                    balance: relevantAmount,
                    amountToAirdrop,
                    percentToAirdrop,
                    includeInDrop: true
                };
            }
        });

        setAirdropDetails(airdropData.filter(Boolean).sort((a, b) => b.balance - a.balance));
    }, [balanceToDrop])

    const getMitoVaultHolders = useCallback(async (vaultAddress) => {
        console.log("get mito vault holders", vaultAddress);
        const module = new TokenUtils(networkConfig);
        setLoading(true)
        try {
            const holders = await module.fetchMitoVaultHolders(vaultAddress, STAKING_CONTRACT_ADDRESS, setProgress);
            setMitoHolders(holders)
            calculateMitoAirdrop(holders, mitoHolderType, distMode)
            setLoading(false)
        } catch (error) {
            console.error('Failed to fetch mito vault holders:', error);
            setLoading(false)
            throw error;
        }
    }, [networkConfig, calculateMitoAirdrop, mitoHolderType, distMode]);

    useEffect(() => {
        if (dropMode.value == "MITO") {
            calculateMitoAirdrop(mitoHolders, mitoHolderType, distMode)
        }
    }, [mitoHolders, mitoHolderType, distMode, calculateMitoAirdrop, dropMode])

    useEffect(() => {
        setAirdropDetails([])
    }, [selectedMitoVault])

    const getMitoVaults = useCallback(async () => {
        console.log("get mito vaults")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchMitoVaults();
            return markets
        } catch (error) {
            console.error('Failed to fetch mito vaults:', error);
            throw error;
        }
    }, [networkConfig]);

    const getSpotMarkets = useCallback(async () => {
        console.log("get spot markets")
        const module = new TokenUtils(networkConfig);
        try {
            const markets = await module.fetchSpotMarkets();
            return markets;
        } catch (error) {
            console.error('Failed to fetch spot markets:', error);
            throw error;
        }
    }, [networkConfig]);

    const getMitoMarketList = useCallback(async () => {
        const spotMarkets = await getSpotMarkets();
        const mitoVaults = await getMitoVaults();

        const matchedMarkets = spotMarkets.map((market) => {
            const matchingVault = mitoVaults.slice().reverse().find(vault => vault.marketId === market.marketId);
            return {
                ...market,
                matchingVault: matchingVault || null, // Add the matching vault or null if no match is found
            };
        });

        const options = []
        matchedMarkets.map((market) => {
            if (market.matchingVault !== null) {
                options.push({
                    value: market,
                    label: `${market.baseToken ? market.baseToken.name : market.marketId} vault (${market.baseDenom ?? market.baseToken.address})`
                })
            }
        })
        setMitoVaults(options)
    }, [getSpotMarkets, getMitoVaults])

    const updateDescription = useCallback(() => {
        let criteriaUpdate = ""
        let descriptionUpdate = ""
        const totalToDrop = airdropDetails.reduce((sum, airdrop) => sum + Number(airdrop.amountToAirdrop), 0).toFixed(2)

        if (dropMode.value == "TOKEN") {
            criteriaUpdate = `Holders of ${airdropTokenInfo.symbol} token at ${moment().toISOString()}`
            descriptionUpdate = `${distMode} drop of ${totalToDrop} ${tokenInfo.symbol} to holders of ${airdropTokenInfo.symbol} token`
        }
        else if (dropMode.value == "NFT") {
            criteriaUpdate = `Holders of ${nftCollectionInfo.symbol} NFTs at ${moment().toISOString()}`
            descriptionUpdate = `${distMode} drop of ${totalToDrop} ${tokenInfo.symbol} to holders of ${nftCollectionInfo.symbol} NFTs`
        }
        else if (dropMode.value == "CSV") {
            criteriaUpdate = `Custom CSV airdrop file upload`
            descriptionUpdate = `Drop of ${totalToDrop} ${tokenInfo.symbol} to custom list of participants`
        }
        else if (dropMode.value == "GOV") {
            criteriaUpdate = filterByVote ? `${Object.keys(voteFilters).filter(key => voteFilters[key])} voters on proposal ${proposalNumber} at ${moment().toISOString()}` : `All voters on proposal ${proposalNumber} at ${moment().toISOString()}`
            descriptionUpdate = `Drop of ${totalToDrop} ${tokenInfo.symbol} to voters on proposal ${proposalNumber}`
        }
        else if (dropMode.value == "MITO") {
            criteriaUpdate = `Holders of ${mitoHolderType == "stake" ? "staked" : "all"} LP tokens in the ${selectedMitoVault.value.baseToken.name} mito vault at ${moment().toISOString()}`
            descriptionUpdate = `${distMode} drop of ${totalToDrop} ${tokenInfo.symbol} to holders of ${selectedMitoVault.value.baseToken.name} mito vault tokens`
        }

        console.log(criteriaUpdate)
        console.log(descriptionUpdate)

        setCriteria(criteriaUpdate)
        setDescription(descriptionUpdate)
    }, [dropMode, distMode, voteFilters, filterByVote, airdropDetails, tokenInfo, airdropTokenInfo, nftCollectionInfo, proposalNumber, selectedMitoVault, mitoHolderType])

    async function fetchBlock(height) {
        const baseUrl = 'https://sentry.lcd.injective.network/cosmos/base/tendermint/v1beta1/blocks';
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${baseUrl}/${height}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch block at height ${height}`);
                }
                return response.json();
            } catch (error) {
                attempts += 1;
                await new Promise(res => setTimeout(res, 2000));
                if (attempts >= maxAttempts) {
                    throw new Error(`Failed to fetch block after ${maxAttempts} attempts: ${error.message}`);
                }
            }
        }
    }

    const getProposalAndBlockHeight = useCallback(async (proposalNumber) => {
        async function findBlockBeforeTime(targetTime) {
            const targetDate = new Date(targetTime);

            const latestBlock = await fetchBlock('latest');
            const latestHeight = parseInt(latestBlock.block.header.height);

            const latestBlockTime = new Date(latestBlock.block.header.time);
            const timeDifference = targetDate - latestBlockTime;
            let estimatedHeight = latestHeight + Math.floor(timeDifference / 690);

            let low = estimatedHeight - 50000;
            let high = estimatedHeight + 50000;

            if (estimatedHeight < 1) {
                estimatedHeight = 1;
            } else if (estimatedHeight > latestHeight) {
                estimatedHeight = latestHeight;
            }

            let lastValidBlock = null;
            low = Math.max(1, estimatedHeight - Math.floor(Math.abs(timeDifference) / 1000));
            high = Math.min(latestHeight, estimatedHeight + Math.floor(Math.abs(timeDifference) / 1000));

            // Binary search for the block just before the targetTime
            while (low < high - 1) {
                const mid = Math.floor((low + high) / 2);
                const midBlock = await fetchBlock(mid);

                const midBlockTime = new Date(midBlock.block.header.time);

                console.log(midBlockTime.toISOString(), targetDate.toISOString())

                if (midBlockTime < targetDate) {
                    lastValidBlock = midBlock;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
                console.log(low, high)

                if ((high - low < 100) && midBlockTime < targetDate) {
                    break
                }
            }

            return lastValidBlock;
        }

        const api = new ChainGrpcGovApi(networkConfig.grpc)

        const proposal = await api.fetchProposal(proposalNumber)
        console.log(proposal)
        const endVoteTime = moment.unix(proposal.votingEndTime)
        console.log(endVoteTime)

        const closestBlock = await findBlockBeforeTime(endVoteTime);
        console.log("closest block: ", closestBlock)

        return Number(closestBlock.block.header.height)
    }, [networkConfig])

    useEffect(() => {
        if (!loading) {
            setProgress("")
        }
    }, [loading])

    useEffect(() => {
        setTokenInfo(null)
        setPairMarketing(null)
        setAirdropDetails([])
        setShowConfirm(false)
    }, [tokenAddress])

    useEffect(() => {
        setAirdropDetails([])
        setNftCollectionInfo(null)
        setAirdropTokenInfo(null)
    }, [airdropTokenAddress])

    useEffect(() => {
        if (balanceToDrop > balance) {
            setError("drop amount must be less than balance")
        }
        else {
            if (error == "drop amount must be less than balance") {
                setError(null)
            }
        }
    }, [balance, balanceToDrop, error])

    useEffect(() => {
        const getShroomCost = async () => {
            const module = new TokenUtils(networkConfig)
            try {
                const [baseAssetPrice, pairInfo] = await Promise.all([
                    module.getINJPrice(),
                    module.getPairInfo(SHROOM_PAIR_ADDRESS)
                ]);
                const quote = await module.getSellQuoteRouter(pairInfo, shroomCost + "0".repeat(18));
                console.log(quote)
                const returnAmount = Number(quote.amount) / Math.pow(10, 18);
                const totalUsdValue = (returnAmount * baseAssetPrice).toFixed(3);
                setShroomPrice(totalUsdValue);
                return totalUsdValue
            } catch (error) {
                console.error('Failed to update balance and USD value:', error);
            }
        }
        if (currentNetwork == "mainnet") {
            getShroomCost().then(r => {
                console.log(r)
            }).catch(e => {
                console.log(e)
            })
        }
    }, [currentNetwork, networkConfig, shroomCost])

    const getTokenInfo = useCallback(() => {
        setLoading(true)
        setError(null)
        setTokenInfo(null)
        setPairMarketing(null)
        const module = new TokenUtils(networkConfig);
        if (
            tokenAddress.value.includes("factory") ||
            tokenAddress.value.includes("peggy") ||
            tokenAddress.value.includes("ibc")
        ) {
            module
                .getDenomExtraMetadata(tokenAddress.value)
                .then((meta) => {
                    setTokenInfo(meta);
                    module.getBalanceOfToken(tokenAddress.value, connectedAddress).then((r) => {
                        setBalance(Number(r.amount) / Math.pow(10, meta.decimals));
                        setBalanceToDrop(Number(r.amount) / Math.pow(10, meta.decimals))
                        setLoading(false)
                    })
                        .catch((e: unknown) => {
                            console.log(e);
                            setLoading(false);
                            if (e && e.message) {
                                setError(e.message)
                            }
                        });
                })
                .catch((e: unknown) => {
                    console.log(e);
                    setLoading(false);
                    if (e && e.message) {
                        setError(e.message)
                    }
                });
        } else {
            module
                .getTokenInfo(tokenAddress.value)
                .then((meta) => {
                    setTokenInfo(
                        meta
                    );
                    console.log(meta)
                    module.queryTokenForBalance(tokenAddress.value, connectedAddress).then((r) => {
                        setBalance(Number(r.balance) / Math.pow(10, meta.decimals));
                        setBalanceToDrop(Number(r.balance) / Math.pow(10, meta.decimals))
                        setLoading(false)
                    })
                        .catch((e: unknown) => {
                            console.log(e);
                            setLoading(false);
                            if (e && e.message) {
                                setError(e.message)
                            }
                        });
                })
                .catch((e: unknown) => {
                    console.log(e);
                    setLoading(false);
                    if (e && e.message) {
                        setError(e.message)
                    }
                });
            module.getTokenMarketing(tokenAddress.value).then(r => {
                setPairMarketing(r)
            }).catch(e => {
                console.log(e)
                setLoading(false);
                if (e && e.message) {
                    const errorMessage = e.message ? e.message.toString() : "";
                    if (!errorMessage.startsWith("codespace wasm code 9: query wasm contract failed: Error parsing into type cw404::msg::QueryMsg: unknown variant `marketing_info`")) {
                        setError(errorMessage);
                    }
                }
            })
        }
    }, [networkConfig, tokenAddress, connectedAddress])


    const updateAirdropAmounts = (details: any[], dist: string, walletLimit = null, balanceToDrop: number, voteFilter = null) => {
        const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.00001))

        if (voteFilter !== null) {
            details.forEach((holder) => {
                holder.includeInDrop = voteFilter[holder.vote_option] == true;
            });
        }
        else if (walletLimit && walletLimit > 0) {
            details.sort((a, b) => b.balance - a.balance);

            details.forEach((holder, index) => {
                holder.includeInDrop = index < walletLimit;
            });
        }
        const includedHolders = details.filter((holder: { includeInDrop: any; }) => holder.includeInDrop);

        if (dist === "fair") {
            const amountPerHolder = supplyToAirdrop / includedHolders.length;
            details.forEach((holder: { includeInDrop: any; amountToAirdrop: number; percentToAirdrop: number; }) => {
                if (holder.includeInDrop) {
                    holder.amountToAirdrop = amountPerHolder;
                    holder.percentToAirdrop = (amountPerHolder / balanceToDrop) * 100;
                } else {
                    holder.amountToAirdrop = 0;
                    holder.percentToAirdrop = 0;
                }
            });
        }
        else if (dist === "proportionate") {
            const totalAmountHeldByIncluded = includedHolders.reduce((total: number, holder: { balance: any; }) => total + Number(holder.balance), 0);
            details.forEach((holder: { includeInDrop: any; balance: number; }) => {
                if (holder.includeInDrop) {
                    holder.percentageHeld = totalAmountHeldByIncluded === 0 ? 0 : (holder.balance / totalAmountHeldByIncluded) * 100
                    holder.amountToAirdrop = (Number(holder.balance) / totalAmountHeldByIncluded) * supplyToAirdrop
                    holder.percentToAirdrop = (holder.balance / totalAmountHeldByIncluded) * 100

                } else {
                    holder.amountToAirdrop = 0
                    holder.percentToAirdrop = 0
                    holder.percentageHeld = 0
                }
            })
        }
    };

    const getNftCollection = useCallback(async () => {
        console.log("GET NFT COLLECTION")
        const is404 = CW404_TOKENS.find(x => x.value == nftCollection.value) !== undefined

        try {
            setAirdropDetails([])
            setLoading(true)
            setNftCollectionInfo(null)
            let info, holders
            const module = new TokenUtils(networkConfig);

            if (is404) {
                info = await module.getCW404TokenInfo(nftCollection.value)
                holders = await module.getCW404Holders(nftCollection.value, setProgress)
            }
            else {
                info = await module.getNFTCollectionInfo(nftCollection.value)
                holders = await module.getNFTHolders(nftCollection.value, setProgress)
            }

            console.log(info, holders)
            setNftCollectionInfo(info)

            const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.00001))

            let airdropData = [];
            if (distMode === "fair") {
                const amountToAirdrop = supplyToAirdrop / holders.length;
                airdropData = holders.map(holder => ({
                    address: holder.address,
                    balance: holder.balance,
                    percentageHeld: holder.percentageHeld,
                    amountToAirdrop,
                    percentToAirdrop: (amountToAirdrop / balanceToDrop) * 100,
                    includeInDrop: true
                }));
            } else if (distMode === "proportionate") {
                airdropData = holders.map(holder => ({
                    address: holder.address,
                    balance: holder.balance,
                    percentageHeld: holder.percentageHeld,
                    amountToAirdrop: (Number(holder.percentageHeld) / 100) * supplyToAirdrop,
                    percentToAirdrop: Number(holder.percentageHeld),
                    includeInDrop: true
                }));
            }

            setAirdropDetails(airdropData)
            setLoading(false)
        }
        catch (e) {
            console.log(e)
        }

    }, [networkConfig, nftCollection, balanceToDrop, distMode])

    const getTokenHolders = useCallback(async () => {
        if (!airdropTokenAddress) return
        const module = new TokenUtils(networkConfig)

        console.log("GET TOKEN HOLDERS")
        setAirdropDetails([])
        setLoading(true)
        setError(null)

        try {
            if (
                airdropTokenAddress.value.includes("factory") ||
                airdropTokenAddress.value.includes("peggy") ||
                airdropTokenAddress.value.includes("ibc")
            ) {
                const r = await module.getDenomExtraMetadata(airdropTokenAddress.value)
                setAirdropTokenInfo(r);
            } else {
                const r = await module.getTokenInfo(airdropTokenAddress.value)
                setAirdropTokenInfo({
                    ...r,
                    denom: airdropTokenAddress.value
                });
            }
            let holders: Holder[] = []

            if (
                airdropTokenAddress.value.includes("factory") ||
                airdropTokenAddress.value.includes("peggy") ||
                airdropTokenAddress.value.includes("ibc")
            ) {
                const r = await module.getTokenFactoryTokenHolders(airdropTokenAddress.value, setProgress)
                if (r) holders = r
            }
            else {
                const r = await module.getCW20TokenHolders(airdropTokenAddress.value, setProgress)
                if (r) holders = r
            }

            const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.00001))

            let airdropData = [];
            if (distMode === "fair") {
                const amountToAirdrop = supplyToAirdrop / holders.length;
                airdropData = holders.map(holder => ({
                    address: holder.address,
                    balance: holder.balance,
                    amountToAirdrop,
                    percentToAirdrop: (amountToAirdrop / balanceToDrop) * 100,
                    includeInDrop: true
                }));
            } else if (distMode === "proportionate") {
                airdropData = holders.map(holder => ({
                    address: holder.address,
                    balance: holder.balance,
                    amountToAirdrop: (Number(holder.percentageHeld) / 100) * supplyToAirdrop,
                    percentToAirdrop: Number(holder.percentageHeld),
                    includeInDrop: true
                }));
            }
            setAirdropDetails(airdropData)
            console.log("set airdrop data")
            setLoading(false)
        }
        catch (e) {
            setError(e.message)
            setLoading(false)
        }
    }, [airdropTokenAddress, distMode, balanceToDrop, networkConfig]);

    const handleFileUpload = useCallback((event) => {
        const file = event.target.files[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                complete: (results) => {
                    console.log(results)
                    let totalToDrop = 0
                    results.data.filter(a => a.address && a.amount).map((holder) => {
                        totalToDrop += Number(holder.amount)
                    })
                    const airdropData = results.data.filter(a => a.address && a.amount).map(holder => {
                        return {
                            address: holder.address,
                            amountToAirdrop: holder.amount.trim(),
                            percentToAirdrop: (Number(holder.amount) / totalToDrop) * 100,
                            includeInDrop: true
                        }
                    });

                    setAirdropDetails(airdropData)
                },
            });
        }
    }, []);

    const getPropVoters = useCallback(async () => {
        console.log("GET PROP VOTERS")
        setAirdropDetails([])
        const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.00001))
        setLoading(true)
        if (attemptFindBlock) {
            setProgress(`Fetching closest block`)
            getProposalAndBlockHeight(proposalNumber).then(async (r) => {
                setBlockHeight(r)
                const module = new TokenUtils(networkConfig)
                const voters = await module.fetchProposalVoters(proposalNumber, r, setProgress)
                console.log(voters)
                setProposalVoters(voters)

                const amountToAirdrop = supplyToAirdrop / voters.length;
                if (voters.length > 0) {
                    setAirdropDetails(voters.map(holder => ({
                        address: holder.address,
                        balance: holder.weight,
                        vote_option: holder.vote_option,
                        amountToAirdrop: amountToAirdrop,
                        percentToAirdrop: (amountToAirdrop / balanceToDrop) * 100,
                        includeInDrop: true
                    })))
                }
                setLoading(false)
            }).catch(e => {
                console.log(e)
                setLoading(false)
            })
        }
        else {
            const module = new TokenUtils(networkConfig)
            const voters = await module.fetchProposalVoters(proposalNumber, blockHeight, setProgress)
            console.log(voters)

            const amountToAirdrop = supplyToAirdrop / voters.length;

            if (voters.length > 0) {
                setAirdropDetails(voters.map(holder => ({
                    address: holder.address,
                    balance: holder.weight,
                    vote_option: holder.vote_option,
                    amountToAirdrop: amountToAirdrop,
                    percentToAirdrop: (amountToAirdrop / balanceToDrop) * 100,
                    includeInDrop: true
                })))
            }
            setLoading(false)
        }

    }, [getProposalAndBlockHeight, proposalNumber, networkConfig, balanceToDrop, attemptFindBlock, blockHeight])


    return (
        <>
            {showConfirm && tokenInfo &&
                <AirdropConfirmModal
                    setShowModal={setShowConfirm}
                    tokenAddress={tokenAddress.value}
                    tokenDecimals={tokenInfo.decimals}
                    airdropDetails={airdropDetails}
                    shroomCost={shroomCost}
                    description={description}
                    criteria={criteria}
                />
            }
            <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                <div className="pt-24 flex-grow mx-2 pb-20">
                    {currentNetwork == "mainnet" && <div className=""><ShroomBalance /></div>}

                    <div className="flex justify-center items-center min-h-full ">
                        <div className="w-full max-w-screen-lg px-2 ">
                            {connectedAddress ?
                                <div>

                                    <div className="text-center text-white mb-2">
                                        <div className="text-3xl font-magic">
                                            New Airdrop
                                        </div>
                                        <div className="text-sm">on Injective {currentNetwork}</div>
                                    </div>
                                    <Link to="/airdrop-history" >
                                        <div className="mt-2 bg-slate-800 p-2 my-4 rounded text-center text-sm w-1/2 mx-auto">
                                            View airdrop history
                                        </div>
                                    </Link>
                                    <div className="border p-4 rounded-lg border-slate-700">
                                        <label
                                            className="font-bold text-base text-white mb-2"
                                        >
                                            1. Token to airdrop (contract address / denom)
                                        </label>
                                        <TokenSelect
                                            options={[
                                                {
                                                    label: "TOKENS",
                                                    options: TOKENS
                                                },
                                                {
                                                    label: "CW404",
                                                    options: CW404_TOKENS
                                                }
                                            ]}
                                            selectedOption={tokenAddress}
                                            setSelectedOption={setTokenAddress}
                                        />
                                        {tokenAddress &&
                                            <button
                                                disabled={loading}
                                                onClick={getTokenInfo}
                                                className="bg-gray-800 rounded-lg p-2 w-full text-white mt-4 shadow-lg"
                                            >
                                                Get token info
                                            </button>
                                        }

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
                                                            {tokenInfo.total_supply /
                                                                Math.pow(10, tokenInfo.decimals)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!pairMarketing && tokenInfo && tokenInfo.logo && (
                                                <div className="mt-5 text-sm text-white">
                                                    <IPFSImage
                                                        width={100}
                                                        className={'mb-2 rounded-lg'}
                                                        ipfsPath={tokenInfo.logo}
                                                    />
                                                    <a href={`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}explorer.injective.network/account/${tokenInfo.admin}`}>
                                                        admin: {tokenInfo.admin.slice(0, 5) + '...' + tokenInfo.admin.slice(-5)}
                                                        {
                                                            WALLET_LABELS[tokenInfo.admin] ? (
                                                                <span className={`${WALLET_LABELS[tokenInfo.admin].bgColor} ${WALLET_LABELS[tokenInfo.admin].textColor} ml-2`}>
                                                                    {WALLET_LABELS[tokenInfo.admin].label}
                                                                </span>
                                                            ) : null
                                                        }
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
                                                        {
                                                            WALLET_LABELS[pairMarketing.marketing] ? (
                                                                <span className={`${WALLET_LABELS[pairMarketing.marketing].bgColor} ${WALLET_LABELS[pairMarketing.marketing].textColor} ml-2`}>
                                                                    {WALLET_LABELS[pairMarketing.marketing].label}
                                                                </span>
                                                            ) : null
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {tokenInfo && (
                                            <div className="">
                                                <div className="my-2">
                                                    Your balance: {balance} {tokenInfo.symbol}
                                                </div>
                                                <div>
                                                    <label
                                                        className="text-base font-bold text-white mb-1"
                                                    >
                                                        Amount to airdrop
                                                    </label>
                                                    <input
                                                        type="number"
                                                        className="text-black w-full rounded p-1 text-sm"
                                                        onChange={(e) => {
                                                            setBalanceToDrop(e.target.value)
                                                            updateList(distMode, walletLimit, e.target.value)
                                                        }
                                                        }
                                                        value={balanceToDrop}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {tokenInfo &&
                                        <div className="mt-5 border p-4 rounded-lg border-slate-700">
                                            <div className="space-y-2 mb-5">
                                                <label
                                                    className="text-base font-bold text-white"
                                                >
                                                    2. Drop Mode
                                                </label>
                                                <Select
                                                    className="text-black"
                                                    value={dropMode}
                                                    onChange={setDropMode}
                                                    options={dropModeOptions}
                                                />
                                            </div>
                                            {dropMode.value == "NFT" && <div>
                                                <div className="space-y-2">
                                                    <label
                                                        className="text-base font-bold text-white "
                                                    >
                                                        NFT collection address
                                                    </label>
                                                    <TokenSelect
                                                        options={[
                                                            {
                                                                label: "CW404",
                                                                options: CW404_TOKENS
                                                            },
                                                            {
                                                                label: "NFT",
                                                                options: NFT_COLLECTIONS
                                                            }
                                                        ]}
                                                        selectedOption={nftCollection}
                                                        setSelectedOption={setNftCollection}
                                                    />
                                                </div>
                                                <div className="mt-4 mb-2">
                                                    <label
                                                        className="text-base font-bold text-white"
                                                    >
                                                        Distribution
                                                    </label>
                                                    <div className="flex flex-row w-full justify-between ">
                                                        <div className="flex flex-row" onClick={() => {
                                                            setDistMode("fair")
                                                            updateList("fair", walletLimit, balanceToDrop)
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                className="text-black w-full rounded p-1 text-sm"
                                                                onChange={() => {
                                                                    setDistMode("fair")
                                                                    updateList("fair", walletLimit, balanceToDrop)
                                                                }}
                                                                checked={distMode == "fair"}
                                                            />
                                                            <label
                                                                className="block text-white ml-5"
                                                            >
                                                                fair
                                                            </label>
                                                        </div>

                                                        <div className="flex flex-row" onClick={() => {
                                                            setDistMode("proportionate")
                                                            updateList("proportionate", walletLimit, balanceToDrop)
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                className="text-black w-full rounded p-1 text-sm"
                                                                onChange={() => {
                                                                    setDistMode("proportionate")
                                                                    updateList("proportionate", walletLimit, balanceToDrop)
                                                                }}
                                                                checked={distMode == "proportionate"}
                                                            />
                                                            <label
                                                                className="block text-white ml-5"
                                                            >
                                                                proportionate
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    disabled={loading}
                                                    onClick={getNftCollection}
                                                    className="bg-gray-800 rounded-lg p-2 w-full text-white mt-4 shadow-lg"
                                                >
                                                    Get collection holders
                                                </button>
                                                {nftCollectionInfo && <div className="text-sm mt-5">
                                                    Collection Name: {nftCollectionInfo.name}
                                                    <br />
                                                    Collection Symbol: {nftCollectionInfo.symbol}
                                                </div>}

                                                {airdropDetails.length > 0 &&
                                                    <div className="mt-5">
                                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                                            <div>Total participants: {airdropDetails.filter(x => x.includeInDrop).length}</div>
                                                            <div className="text-xs">You should exclude addresses such as burn addresses, the marketplace contract etc..</div>
                                                            <div className="my-1">
                                                                <div className="items-center mt-2">
                                                                    <label
                                                                        className="text-white"
                                                                    >
                                                                        Limit to top # wallets
                                                                    </label>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black rounded p-1 text-sm ml-2"
                                                                        onChange={() => {
                                                                            setLimitSwitch(limit => !limit)
                                                                        }}
                                                                        checked={limitSwitch}
                                                                    />
                                                                </div>
                                                                {limitSwitch &&
                                                                    <div className="mt-2 mb-1">
                                                                        <input
                                                                            type="number"
                                                                            className="text-black w-full rounded p-1 text-sm w-14"
                                                                            onChange={(e) => {
                                                                                setWalletLimit(e.target.value)
                                                                            }}
                                                                            value={walletLimit}
                                                                        />
                                                                        <button
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                updateAirdropAmounts(d, distMode, walletLimit, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                        >
                                                                            apply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                d.forEach((holder, index) => {
                                                                                    holder.includeInDrop = true
                                                                                });
                                                                                updateAirdropAmounts(d, distMode, null, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                        >
                                                                            reset
                                                                        </button>
                                                                    </div>
                                                                }
                                                            </div>
                                                            <div className="mt-2">
                                                                <table className="table-auto w-full">
                                                                    <thead className="text-white text-left">
                                                                        <tr>
                                                                            <th className="px-4 py-2">
                                                                                Position
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Include
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Address
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Balance
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Airdrop
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                %
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {airdropDetails.map((holder, index) => (
                                                                            <tr key={index} className="text-white border-b text-xs">
                                                                                <td className="px-6 py-1">
                                                                                    {index + 1}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={holder.includeInDrop || false}
                                                                                        onChange={() => handleCheckboxChange(index, distMode, balanceToDrop)}
                                                                                    />
                                                                                </td>
                                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                                    <a
                                                                                        className="hover:text-indigo-900"
                                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                                    >
                                                                                        {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)}
                                                                                        {
                                                                                            WALLET_LABELS[holder.address] ? (
                                                                                                <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                                    {WALLET_LABELS[holder.address].label}
                                                                                                </span>
                                                                                            ) : null
                                                                                        }
                                                                                    </a>
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.balance).toFixed(2)}{" "}
                                                                                </td>

                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.amountToAirdrop).toFixed(tokenInfo.decimals)} {tokenInfo.symbol}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                            }
                                            {dropMode.value == "TOKEN" && <div>
                                                <div>
                                                    <div className="mt-4 space-y-2">
                                                        <label
                                                            className="block text-white"
                                                        >
                                                            airdrop to holders of token
                                                        </label>
                                                        <TokenSelect
                                                            options={[
                                                                {
                                                                    label: "Tokens",
                                                                    options: TOKENS
                                                                },
                                                                {
                                                                    label: "LIQUIDITY tokens",
                                                                    options: LIQUIDITY_TOKENS
                                                                },

                                                            ]}
                                                            selectedOption={airdropTokenAddress}
                                                            setSelectedOption={setAirdropTokenAddress}
                                                        />
                                                    </div>
                                                    <div className="mt-4 mb-2">
                                                        <label
                                                            className="block font-bold text-white"
                                                        >
                                                            Distribution
                                                        </label>
                                                        <div className="flex flex-row w-full justify-between ">
                                                            <div className="flex flex-row" onClick={() => {
                                                                setDistMode("fair")
                                                                updateList("fair", walletLimit, balanceToDrop)
                                                            }}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="text-black w-full rounded p-1"
                                                                    onChange={() => {
                                                                        setDistMode("fair")
                                                                        updateList("fair", walletLimit, balanceToDrop)
                                                                    }}
                                                                    checked={distMode == "fair"}
                                                                />
                                                                <label
                                                                    className="block text-white ml-5"
                                                                >
                                                                    fair
                                                                </label>
                                                            </div>
                                                            <div className="flex flex-row" onClick={() => {
                                                                setDistMode("proportionate")
                                                                updateList("proportionate", walletLimit, balanceToDrop)
                                                            }}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="text-black w-full rounded p-1"
                                                                    onChange={() => {
                                                                        setDistMode("proportionate")
                                                                        updateList("proportionate", walletLimit, balanceToDrop)
                                                                    }}
                                                                    checked={distMode == "proportionate"}
                                                                />
                                                                <label
                                                                    className="block text-white ml-5"
                                                                >
                                                                    proportionate
                                                                </label>
                                                            </div>
                                                        </div>

                                                    </div>
                                                    <button
                                                        disabled={loading}
                                                        onClick={getTokenHolders}
                                                        className="bg-gray-800 rounded-lg p-2 w-full text-white mt-4 shadow-lg"
                                                    >
                                                        Generate airdrop list
                                                    </button>

                                                    {airdropDetails.length > 0 &&
                                                        <div className="mt-5">
                                                            <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                                                <div>Total participants: {airdropDetails.filter(x => x.includeInDrop).length}</div>
                                                                <div className="text-xs">You should exclude addresses such as burn addresses, astro generator, the pair contract etc..</div>
                                                                <div className="my-1">
                                                                    <div className="items-center mt-2">
                                                                        <label
                                                                            className="text-white"
                                                                        >
                                                                            Limit to top # wallets
                                                                        </label>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="text-black rounded p-1 text-sm ml-2"
                                                                            onChange={() => {
                                                                                setLimitSwitch(limit => !limit)
                                                                            }}
                                                                            checked={limitSwitch}
                                                                        />
                                                                    </div>
                                                                    {limitSwitch &&
                                                                        <div className="mt-2 mb-1">
                                                                            <input
                                                                                type="number"
                                                                                className="text-black w-full rounded p-1 text-sm w-14"
                                                                                onChange={(e) => {
                                                                                    setWalletLimit(e.target.value)
                                                                                }}
                                                                                value={walletLimit}
                                                                            />
                                                                            <button
                                                                                className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                                onClick={() => {
                                                                                    const d = [...airdropDetails]
                                                                                    updateAirdropAmounts(d, distMode, walletLimit, balanceToDrop)
                                                                                    setAirdropDetails(d)
                                                                                }}
                                                                            >
                                                                                apply
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const d = [...airdropDetails]
                                                                                    d.forEach((holder, index) => {
                                                                                        holder.includeInDrop = true
                                                                                    });
                                                                                    updateAirdropAmounts(d, distMode, null, balanceToDrop)
                                                                                    setAirdropDetails(d)
                                                                                }}
                                                                                className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                            >
                                                                                reset
                                                                            </button>
                                                                        </div>
                                                                    }
                                                                </div>
                                                                <div className="mt-2">
                                                                    <table className="table-auto w-full">
                                                                        <thead className="text-white text-left">
                                                                            <tr>
                                                                                <th className="px-4 py-2">
                                                                                    Position
                                                                                </th>
                                                                                <th className="px-4 py-2">
                                                                                    Include
                                                                                </th>
                                                                                <th className="px-4 py-2">
                                                                                    Address
                                                                                </th>
                                                                                <th className="px-4 py-2">
                                                                                    Balance
                                                                                </th>
                                                                                <th className="px-4 py-2">
                                                                                    Airdrop
                                                                                </th>
                                                                                <th className="px-4 py-2">
                                                                                    %
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {airdropDetails.map((holder, index) => (
                                                                                <tr key={index} className="text-white border-b text-xs">
                                                                                    <td className="px-6 py-1">
                                                                                        {index + 1}
                                                                                    </td>
                                                                                    <td className="px-6 py-1">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={holder.includeInDrop || false}
                                                                                            onChange={() => handleCheckboxChange(index, distMode, balanceToDrop)}

                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-6 py-1 whitespace-nowrap">
                                                                                        <a
                                                                                            className="hover:text-indigo-900"
                                                                                            href={`https://explorer.injective.network/account/${holder.address}`}
                                                                                        >
                                                                                            {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)}
                                                                                            {
                                                                                                WALLET_LABELS[holder.address] ? (
                                                                                                    <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                                        {WALLET_LABELS[holder.address].label}
                                                                                                    </span>
                                                                                                ) : null
                                                                                            }
                                                                                        </a>
                                                                                    </td>
                                                                                    {airdropTokenInfo ? <td className="px-6 py-1">
                                                                                        {Number(holder.balance).toFixed(airdropTokenInfo.decimals)}{" "} {airdropTokenInfo.symbol}
                                                                                    </td> : <></>
                                                                                    }
                                                                                    <td className="px-6 py-1">
                                                                                        {Number(holder.amountToAirdrop).toFixed(tokenInfo.decimals)}{" "} {tokenInfo.symbol}
                                                                                    </td>
                                                                                    <td className="px-6 py-1">
                                                                                        {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    }
                                                </div>

                                            </div>
                                            }
                                            {dropMode.value == "CSV" && <div>
                                                {airdropDetails.length == 0 && <div className="text-sm my-2">
                                                    CSV file like:
                                                    <br />
                                                    address,amount
                                                    <br />
                                                    inj...,10.1
                                                    <br />
                                                    inj...,20.2
                                                </div>}
                                                <input type="file" accept=".csv" onChange={handleFileUpload} />
                                                {airdropDetails.length > 0 &&
                                                    <div className="mt-5">
                                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                                            <div>Total participants: {airdropDetails.filter(x => x.includeInDrop).length}</div>
                                                            <div className="text-xs">You should exclude addresses such as burn addresses, astro generator, the pair contract etc..</div>
                                                            <div className="my-1">
                                                                <div className="items-center mt-2">
                                                                    <label
                                                                        className="text-white"
                                                                    >
                                                                        Limit to top # wallets
                                                                    </label>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black rounded p-1 text-sm ml-2"
                                                                        onChange={() => {
                                                                            setLimitSwitch(limit => !limit)
                                                                        }}
                                                                        checked={limitSwitch}
                                                                    />
                                                                </div>
                                                                {limitSwitch &&
                                                                    <div className="mt-2 mb-1">
                                                                        <input
                                                                            type="number"
                                                                            className="text-black w-full rounded p-1 text-sm w-14"
                                                                            onChange={(e) => {
                                                                                setWalletLimit(e.target.value)
                                                                            }}
                                                                            value={walletLimit}
                                                                        />
                                                                        <button
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                updateAirdropAmounts(d, distMode, walletLimit, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                        >
                                                                            apply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                d.forEach((holder, index) => {
                                                                                    holder.includeInDrop = true
                                                                                });
                                                                                updateAirdropAmounts(d, distMode, null, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                        >
                                                                            reset
                                                                        </button>
                                                                    </div>
                                                                }
                                                            </div>
                                                            <div className="mt-2">
                                                                <table className="table-auto w-full">
                                                                    <thead className="text-white text-left">
                                                                        <tr>
                                                                            <th className="px-4 py-2">
                                                                                Address
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Airdrop
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                %
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {airdropDetails.map((holder, index) => (
                                                                            <tr key={index} className="text-white border-b text-xs">
                                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                                    <a
                                                                                        className="hover:text-indigo-900"
                                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                                    >
                                                                                        {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)}
                                                                                        {
                                                                                            WALLET_LABELS[holder.address] ? (
                                                                                                <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                                    {WALLET_LABELS[holder.address].label}
                                                                                                </span>
                                                                                            ) : null
                                                                                        }
                                                                                    </a>
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.amountToAirdrop).toFixed(tokenInfo.decimals)}{" "} {tokenInfo.symbol}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                            }
                                            {dropMode.value == "GOV" && <div>
                                                <div className="space-y-2">
                                                    <label
                                                        className="text-base font-bold text-white mr-2"
                                                    >
                                                        Governance Proposal #
                                                    </label>
                                                    <input
                                                        className="text-black"
                                                        value={proposalNumber}
                                                        onChange={(e) => {
                                                            setProposalNumber(e.target.value)
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label
                                                        className="text-base font-bold text-white mr-2"
                                                    >
                                                        Block height
                                                    </label>
                                                    <input
                                                        disabled={attemptFindBlock == true}
                                                        className="text-black"
                                                        value={blockHeight}
                                                        onChange={(e) => {
                                                            setBlockHeight(e.target.value)
                                                        }}
                                                    />
                                                    <label
                                                        className="text-base font-bold text-white mx-2"
                                                    >
                                                        OR
                                                    </label>
                                                    <input
                                                        type="checkbox"
                                                        className="text-black"
                                                        value={attemptFindBlock == true}
                                                        checked={attemptFindBlock == true}
                                                        onChange={(e) => {
                                                            setAttemptFindBlock(!attemptFindBlock)
                                                        }}
                                                    />
                                                    <label
                                                        className="text-base font-bold text-white mx-2"
                                                    >
                                                        attempt to auto find block
                                                    </label>
                                                </div>
                                                <button
                                                    onClick={getPropVoters}
                                                    className="bg-gray-800 rounded-lg p-2 w-full text-white mt-6 shadow-lg">
                                                    Get voters
                                                </button>
                                                {airdropDetails.length > 0 &&
                                                    <div className="mt-5">
                                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                                            <div>Total participants: {airdropDetails.filter(x => x.includeInDrop).length}</div>
                                                            <div className="text-xs">You should exclude addresses such as burn addresses, astro generator, the pair contract etc..</div>
                                                            <div className="my-1">
                                                                <div className="items-center mt-2">
                                                                    <label
                                                                        className="text-white"
                                                                    >
                                                                        Filter vote options
                                                                    </label>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black rounded p-1 text-sm ml-2"
                                                                        onChange={() => {
                                                                            setFilterByVote(filter => !filter)
                                                                        }}
                                                                        checked={filterByVote}
                                                                    />
                                                                </div>
                                                                {filterByVote &&
                                                                    <div className="mt-2 mb-1">
                                                                        <div className="flex flex-row">
                                                                            <div>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="text-black"
                                                                                    checked={voteFilters['VOTE_OPTION_YES'] == true}
                                                                                    onChange={(e) => {
                                                                                        setVoteFilters((filters) => {
                                                                                            return {
                                                                                                ...filters,
                                                                                                'VOTE_OPTION_YES': !filters['VOTE_OPTION_YES']
                                                                                            }
                                                                                        })
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="text-base font-bold text-white mx-2"
                                                                                >
                                                                                    YES
                                                                                </label>
                                                                            </div>
                                                                            <div>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="text-black"
                                                                                    checked={voteFilters['VOTE_OPTION_ABSTAIN'] == true}
                                                                                    onChange={(e) => {
                                                                                        setVoteFilters((filters) => {
                                                                                            return {
                                                                                                ...filters,
                                                                                                'VOTE_OPTION_ABSTAIN': !filters['VOTE_OPTION_ABSTAIN']
                                                                                            }
                                                                                        })
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="text-base font-bold text-white mx-2"
                                                                                >
                                                                                    ABSTAIN
                                                                                </label>
                                                                            </div>
                                                                            <div>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="text-black"
                                                                                    checked={voteFilters['VOTE_OPTION_NO'] == true}
                                                                                    onChange={(e) => {
                                                                                        setVoteFilters((filters) => {
                                                                                            return {
                                                                                                ...filters,
                                                                                                'VOTE_OPTION_NO': !filters['VOTE_OPTION_NO']
                                                                                            }
                                                                                        })
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="text-base font-bold text-white mx-2"
                                                                                >
                                                                                    NO
                                                                                </label>
                                                                            </div>
                                                                            <div>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="text-black"
                                                                                    checked={voteFilters['VOTE_OPTION_NO_WITH_VETO'] == true}
                                                                                    onChange={(e) => {
                                                                                        setVoteFilters((filters) => {
                                                                                            return {
                                                                                                ...filters,
                                                                                                'VOTE_OPTION_NO_WITH_VETO': !filters['VOTE_OPTION_NO_WITH_VETO']
                                                                                            }
                                                                                        })
                                                                                    }}
                                                                                />
                                                                                <label
                                                                                    className="text-base font-bold text-white mx-2"
                                                                                >
                                                                                    NO WITH VETO
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                updateAirdropAmounts(d, distMode, walletLimit, balanceToDrop, voteFilters)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                        >
                                                                            apply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                d.forEach((holder, index) => {
                                                                                    holder.includeInDrop = true
                                                                                });
                                                                                setVoteFilters({
                                                                                    "VOTE_OPTION_YES": true,
                                                                                    "VOTE_OPTION_ABSTAIN": true,
                                                                                    "VOTE_OPTION_NO": true,
                                                                                    "VOTE_OPTION_NO_WITH_VETO": true,
                                                                                })
                                                                                updateAirdropAmounts(d, distMode, null, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                        >
                                                                            reset
                                                                        </button>
                                                                    </div>
                                                                }
                                                            </div>
                                                            <div className="mt-2">
                                                                <table className="table-auto w-full">
                                                                    <thead className="text-white text-left">
                                                                        <tr>
                                                                            <th className="px-4 py-2">
                                                                                Position
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Include
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Address
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Vote option
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Airdrop
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                %
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {airdropDetails.map((holder, index) => (
                                                                            <tr key={index} className="text-white border-b text-xs">
                                                                                <td className="px-6 py-1">
                                                                                    {index + 1}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={holder.includeInDrop || false}
                                                                                        onChange={() => handleCheckboxChange(index, distMode, balanceToDrop)}

                                                                                    />
                                                                                </td>
                                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                                    {holder.address &&
                                                                                        <a
                                                                                            className="hover:text-indigo-900"
                                                                                            href={`https://explorer.injective.network/account/${holder.address}`}
                                                                                        >
                                                                                            {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)}
                                                                                            {
                                                                                                WALLET_LABELS[holder.address] ? (
                                                                                                    <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                                        {WALLET_LABELS[holder.address].label}
                                                                                                    </span>
                                                                                                ) : null
                                                                                            }
                                                                                        </a>
                                                                                    }

                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {holder.vote_option && holder.vote_option.replace("VOTE_OPTION_", "")}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.amountToAirdrop).toFixed(tokenInfo.decimals)}{" "} {tokenInfo.symbol}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                            }
                                            {dropMode.value == "MITO" && <div>
                                                <button
                                                    disabled={loading}
                                                    onClick={getMitoMarketList}
                                                    className="bg-gray-800 rounded-lg p-2 w-full text-white shadow-lg"
                                                >
                                                    Get vault list
                                                </button>
                                                {mitoVaults.length > 0 &&
                                                    <div className="mt-2">
                                                        <label>Select Vault</label>
                                                        <Select
                                                            className="text-black"
                                                            value={selectedMitoVault}
                                                            options={mitoVaults}
                                                            onChange={setSelectedMitoVault}
                                                        />
                                                    </div>
                                                }
                                                {selectedMitoVault !== null &&
                                                    <div className="mt-4">

                                                        <div className="mt-4 mb-2">
                                                            <label
                                                                className="text-base font-bold text-white"
                                                            >
                                                                Distribution
                                                            </label>
                                                            <div className="flex flex-row w-full justify-around ">
                                                                <div className="flex flex-row" onClick={() => {
                                                                    setDistMode("fair")
                                                                    updateList("fair", walletLimit, balanceToDrop)
                                                                }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black w-full rounded p-1 text-sm"
                                                                        onChange={() => {
                                                                            setDistMode("fair")
                                                                            updateList("fair", walletLimit, balanceToDrop)
                                                                        }}
                                                                        checked={distMode == "fair"}
                                                                    />
                                                                    <label
                                                                        className="block text-white ml-5"
                                                                    >
                                                                        fair
                                                                    </label>
                                                                </div>

                                                                <div className="flex flex-row" onClick={() => {
                                                                    setDistMode("proportionate")
                                                                    updateList("proportionate", walletLimit, balanceToDrop)
                                                                }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black w-full rounded p-1 text-sm"
                                                                        onChange={() => {
                                                                            setDistMode("proportionate")
                                                                            updateList("proportionate", walletLimit, balanceToDrop)
                                                                        }}
                                                                        checked={distMode == "proportionate"}
                                                                    />
                                                                    <label
                                                                        className="block text-white ml-5"
                                                                    >
                                                                        proportionate
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 mb-2">
                                                            <label
                                                                className="text-base font-bold text-white"
                                                            >
                                                                Balance type
                                                            </label>
                                                            <div className="flex flex-row w-full justify-around ">
                                                                <div className="flex flex-row" onClick={() => {
                                                                    setMitoHolderType("non-stake")
                                                                    // updateList("fair", walletLimit, balanceToDrop)
                                                                }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black rounded p-1 text-sm"
                                                                        onChange={() => {
                                                                            setMitoHolderType("non-stake")
                                                                            // updateList("non-stake", walletLimit, balanceToDrop)
                                                                        }}
                                                                        checked={mitoHolderType == "non-stake"}
                                                                    />
                                                                    <label
                                                                        className="block text-white ml-5"
                                                                    >
                                                                        total balance
                                                                    </label>
                                                                </div>

                                                                <div className="flex  flex-row" onClick={() => {
                                                                    setMitoHolderType("stake")
                                                                    // updateList("stake", walletLimit, balanceToDrop)
                                                                }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black rounded p-1 text-sm"
                                                                        onChange={() => {
                                                                            setMitoHolderType("stake")
                                                                            // updateList("stake", walletLimit, balanceToDrop)
                                                                        }}
                                                                        checked={mitoHolderType == "stake"}
                                                                    />
                                                                    <label
                                                                        className="block text-white ml-5"
                                                                    >
                                                                        staked balance only
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => getMitoVaultHolders(selectedMitoVault.value.matchingVault.contractAddress)}
                                                            className="bg-gray-800 rounded-lg p-2 w-full text-white shadow-lg"
                                                        >
                                                            Generate airdrop list
                                                        </button>
                                                    </div>
                                                }
                                                {airdropDetails.length > 0 &&
                                                    <div className="mt-5">
                                                        <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                                            <div>Total participants: {airdropDetails.filter(x => x.includeInDrop).length}</div>
                                                            <div className="text-xs">You should exclude addresses such as burn addresses, astro generator, the pair contract etc..</div>
                                                            <div className="my-1">
                                                                <div className="items-center mt-2">
                                                                    <label
                                                                        className="text-white"
                                                                    >
                                                                        Limit to top # wallets
                                                                    </label>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="text-black rounded p-1 text-sm ml-2"
                                                                        onChange={() => {
                                                                            setLimitSwitch(limit => !limit)
                                                                        }}
                                                                        checked={limitSwitch}
                                                                    />
                                                                </div>
                                                                {limitSwitch &&
                                                                    <div className="mt-2 mb-1">
                                                                        <input
                                                                            type="number"
                                                                            className="text-black w-full rounded p-1 text-sm w-14"
                                                                            onChange={(e) => {
                                                                                setWalletLimit(e.target.value)
                                                                            }}
                                                                            value={walletLimit}
                                                                        />
                                                                        <button
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                updateAirdropAmounts(d, distMode, walletLimit, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                        >
                                                                            apply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                const d = [...airdropDetails]
                                                                                d.forEach((holder, index) => {
                                                                                    holder.includeInDrop = true
                                                                                });
                                                                                updateAirdropAmounts(d, distMode, null, balanceToDrop)
                                                                                setAirdropDetails(d)
                                                                            }}
                                                                            className="bg-slate-700 p-1 mt-2 rounded ml-2 text-sm"
                                                                        >
                                                                            reset
                                                                        </button>
                                                                    </div>
                                                                }
                                                            </div>
                                                            <div className="mt-2">
                                                                <table className="table-auto w-full">
                                                                    <thead className="text-white text-left">
                                                                        <tr>
                                                                            <th className="px-4 py-2">
                                                                                Position
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Include
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Address
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Balance
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                Airdrop
                                                                            </th>
                                                                            <th className="px-4 py-2">
                                                                                %
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {airdropDetails.map((holder, index) => (
                                                                            <tr key={index} className="text-white border-b text-xs">
                                                                                <td className="px-6 py-1">
                                                                                    {index + 1}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={holder.includeInDrop || false}
                                                                                        onChange={() => handleCheckboxChange(index, distMode, balanceToDrop)}

                                                                                    />
                                                                                </td>
                                                                                <td className="px-6 py-1 whitespace-nowrap">
                                                                                    <a
                                                                                        className="hover:text-indigo-900"
                                                                                        href={`https://explorer.injective.network/account/${holder.address}`}
                                                                                    >
                                                                                        {/* {holder.address.slice(0, 5) + '...' + holder.address.slice(-5)} */}
                                                                                        {holder.address}

                                                                                        {
                                                                                            WALLET_LABELS[holder.address] ? (
                                                                                                <span className={`${WALLET_LABELS[holder.address].bgColor} ${WALLET_LABELS[holder.address].textColor} ml-2`}>
                                                                                                    {WALLET_LABELS[holder.address].label}
                                                                                                </span>
                                                                                            ) : null
                                                                                        }
                                                                                    </a>
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.balance)}
                                                                                </td>

                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.amountToAirdrop).toFixed(tokenInfo.decimals)}{" "} {tokenInfo.symbol}
                                                                                </td>
                                                                                <td className="px-6 py-1">
                                                                                    {Number(holder.percentToAirdrop).toFixed(2)}%
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                            }
                                        </div>
                                    }
                                </div>
                                :
                                <div className="text-center">
                                    <div className="text-xl mb-5">Airdrop Tool</div>
                                    <img
                                        src={parachute}
                                        style={{ width: 140 }}
                                        className="m-auto rounded-xl mb-4"
                                        alt="airdrop"
                                    />
                                    <div className="mb-5">Please connect wallet to plan a new airdrop</div>
                                    <ConnectKeplr hideNetwork={true} button={true} />
                                    <Link to="/airdrop-history" ><div className=" bg-slate-800 p-2 mt-10 rounded  text-sm">View airdrop history</div></Link>
                                </div>
                            }
                            {error && <div className="text-red-500 mt-2">
                                {error}
                            </div>
                            }
                            {(airdropDetails.length > 0) && connectedAddress &&
                                <div className="mt-5 border p-4 rounded-lg border-slate-700">
                                    <div className="text-base font-bold text-white">3. Review and confirm</div>
                                    {currentNetwork == "mainnet" && (airdropDetails.length > 0) && <div className="mt-2">
                                        Fee: {humanReadableAmount(shroomCost)} shroom (${shroomPrice ? shroomPrice : '0'}) <br />
                                        <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                                    </div>
                                    }
                                    <button
                                        disabled={loading || (error && error.length > 0)}
                                        onClick={() => {
                                            updateDescription()
                                            setShowConfirm(true)
                                        }}
                                        className="bg-gray-800 rounded-lg p-2 w-full text-white mt-6 shadow-lg"
                                    >
                                        Review airdrop details
                                    </button>
                                </div>
                            }
                            {loading &&
                                <div className="flex flex-col items-center justify-center pt-5">
                                    <GridLoader color="#36d7b7" />
                                    {progress.length > 0 &&
                                        <div className="mt-2">
                                            {progress}
                                        </div>
                                    }
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

export default Airdrop;
