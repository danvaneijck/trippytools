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
import { Holder, MarketingInfo } from "../../types";
import { CW404_TOKENS, LIQUIDITY_TOKENS, NFT_COLLECTIONS, TOKENS } from "../../constants/contractAddresses";
import TokenSelect from "../../components/Inputs/TokenSelect";

const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"

const Airdrop = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [tokenAddress, setTokenAddress] = useState(TOKENS[0]);
    const [tokenInfo, setTokenInfo] = useState(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [balance, setBalance] = useState(0)
    const [balanceToDrop, setBalanceToDrop] = useState(0)

    const [limitSwitch, setLimitSwitch] = useState(false)
    const [walletLimit, setWalletLimit] = useState(0)

    const [shroomCost] = useState(100000)
    const [shroomPrice, setShroomPrice] = useState(null)

    const [dropMode, setDropMode] = useState("TOKEN");
    const [nftCollection, setNftCollection] = useState(NFT_COLLECTIONS[0]);
    const [nftCollectionInfo, setNftCollectionInfo] = useState(null);
    const [airdropTokenAddress, setAirdropTokenAddress] = useState(LIQUIDITY_TOKENS[0]);
    const [airdropTokenInfo, setAirdropTokenInfo] = useState(null);

    const [airdropDetails, setAirdropDetails] = useState([]);

    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null)
    const [distMode, setDistMode] = useState("fair");
    const [progress, setProgress] = useState("")

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
                    module.updateBaseAssetPrice(),
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
                .getDenomMetadata(tokenAddress.value)
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
                    setError(e.message)
                }
            })
        }
    }, [networkConfig, tokenAddress, connectedAddress])


    const updateAirdropAmounts = (details: any[], dist: string, walletLimit = null, balanceToDrop: number) => {
        const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.001))
        let includedHolders = details.filter(holder => holder.includeInDrop);

        if (walletLimit && walletLimit > 0) {
            includedHolders.sort((a, b) => b.balance - a.balance);

            includedHolders.forEach((holder, index) => {
                holder.includeInDrop = index < walletLimit;
            });
            includedHolders = includedHolders.filter(holder => holder.includeInDrop);
        }
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
        } else if (dist === "proportionate") {
            const includedHolders = details.filter((holder: { includeInDrop: any; }) => holder.includeInDrop);
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
        const is404 = CW404_TOKENS.find(x => x.value == nftCollection.value) !== undefined
        console.log(is404)
        if (is404) {
            setLoading(true)
            const module = new TokenUtils(networkConfig);
            await module.getCW404Holders(nftCollection.value, setProgress)
            return
        }
        try {
            setAirdropDetails([])
            setLoading(true)
            setNftCollectionInfo(null)
            const module = new TokenUtils(networkConfig);
            const info = await module.getNFTCollectionInfo(nftCollection.value)
            const holders = await module.getNFTHolders(nftCollection.value, setProgress)
            console.log(info, holders)
            setNftCollectionInfo(info)

            const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.001))

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

        console.log("get airdrop preview")
        setAirdropDetails([])
        setLoading(true)
        setError(null)

        try {
            if (
                airdropTokenAddress.value.includes("factory") ||
                airdropTokenAddress.value.includes("peggy") ||
                airdropTokenAddress.value.includes("ibc")
            ) {
                const r = await module.getDenomMetadata(airdropTokenAddress.value)
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

            const supplyToAirdrop = (balanceToDrop - (balanceToDrop * 0.001))

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
            console.log(e)
            setError(e.message)
            setLoading(false)
        }
    }, [airdropTokenAddress, distMode, balanceToDrop, networkConfig]);


    return (
        <>
            {showConfirm && tokenInfo &&
                <AirdropConfirmModal
                    setShowModal={setShowConfirm}
                    tokenAddress={tokenAddress.value}
                    tokenDecimals={tokenInfo.decimals}
                    airdropDetails={airdropDetails}
                    shroomCost={shroomCost}
                />
            }
            <div className="flex flex-col min-h-screen pb-10">
                <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                    <div className="container mx-auto flex items-center p-2 text-sm md:text-sm">
                        <Link to="/" className="ml-5 font-bold hover:underline mr-5">
                            home
                        </Link>
                        <Link
                            to="/token-holders"
                            className="font-bold hover:underline mr-5"
                        >
                            holder tool
                        </Link>
                        <Link
                            to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                            className="font-bold hover:underline mr-5"
                        >
                            liquidity tool
                        </Link>
                        <Link to="/manage-tokens" className="font-bold hover:underline">
                            manage tokens
                        </Link>

                        <Link to="/sushi-tool" className="font-bold hover:underline mx-5">
                            sushi tool
                        </Link>
                    </div>
                    <div className="m-2">
                        <ConnectKeplr />
                    </div>
                </header>

                <div className="pt-14 flex-grow mx-2 pb-20">
                    {currentNetwork == "mainnet" && <div className=""><ShroomBalance /></div>}

                    <div className="flex justify-center items-center min-h-full ">
                        <div className="w-full max-w-screen-md px-2 max-w-screen-md">
                            {connectedAddress ?
                                <div>

                                    <div className="text-center text-white mb-2">
                                        <div className="text-base font-bold">
                                            New Airdrop
                                        </div>
                                        <div className="text-xs">on Injective {currentNetwork}</div>
                                    </div>
                                    <div className="">

                                        <label
                                            className="font-bold text-sm text-white mb-1"
                                        >
                                            Token to airdrop
                                        </label>
                                        <TokenSelect
                                            options={TOKENS}
                                            selectedOption={tokenAddress}
                                            setSelectedOption={setTokenAddress}
                                        />

                                        <button
                                            disabled={loading}
                                            onClick={getTokenInfo}
                                            className="bg-gray-800 rounded-lg p-2 w-full text-white mt-6 shadow-lg"
                                        >
                                            Get token info
                                        </button>
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
                                                        className="mb-2"
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
                                                <div className="my-5">
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
                                        <div className="mt-5">
                                            <div className="mt-4 space-y-2 mb-5">
                                                <label
                                                    className="text-base font-bold text-white"
                                                >
                                                    Drop Mode
                                                </label>
                                                <div className="flex flex-row  justify-around ">
                                                    <div className="flex flex-row" onClick={() => {
                                                        setDropMode("NFT")
                                                        setAirdropDetails([])
                                                        setNftCollectionInfo(null)
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            className="text-black w-full rounded p-1 text-sm"
                                                            onChange={() => {
                                                                setDropMode("NFT")
                                                                setAirdropDetails([])
                                                                setNftCollectionInfo(null)
                                                            }}
                                                            checked={dropMode == "NFT"}
                                                        />
                                                        <label
                                                            className="text-white ml-5"
                                                        >
                                                            NFT community
                                                        </label>
                                                    </div>
                                                    <div className="flex flex-row" onClick={() => {
                                                        setDropMode("TOKEN")
                                                        setAirdropDetails([])
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            className="text-black w-full rounded p-1 text-sm"
                                                            onChange={() => {
                                                                setDropMode("TOKEN")
                                                                setAirdropDetails([])
                                                            }}
                                                            checked={dropMode == "TOKEN"}
                                                        />
                                                        <label
                                                            className="block text-white ml-5"
                                                        >
                                                            Token Holders
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            {dropMode == "NFT" && <div>
                                                <div className="space-y-2">
                                                    <label
                                                        className="text-base font-bold text-white "
                                                    >
                                                        NFT collection address
                                                    </label>
                                                    <TokenSelect
                                                        options={[
                                                            {
                                                                label: "CW404 (SOON)",
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
                                                                                    {Number(holder.balance).toFixed(0)}{" "}
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
                                            {dropMode == "TOKEN" && <div>
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
                                                                    label: "LIQUIDITY tokens",
                                                                    options: LIQUIDITY_TOKENS
                                                                },
                                                                {
                                                                    label: "Tokens",
                                                                    options: TOKENS
                                                                }
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
                                                                                    <td className="px-6 py-1">
                                                                                        {Number(holder.balance).toFixed(airdropTokenInfo.decimals)}{" "} {airdropTokenInfo.symbol}
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

                                            </div>

                                            }
                                        </div>
                                    }

                                </div>
                                :
                                <div className="text-center">
                                    Please connect wallet to plan a new airdrop
                                </div>
                            }
                            {error && <div className="text-red-500 mt-2">
                                {error}
                            </div>
                            }
                            {(airdropDetails.length > 0) && connectedAddress &&
                                <div className="my-10">
                                    {currentNetwork == "mainnet" && (airdropDetails.length > 0) && <div className="mt-2">
                                        Fee: {shroomCost} shroom (${shroomPrice ? shroomPrice : '0'}) <br />
                                        <a href="https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="underline text-sm">buy here</a>
                                    </div>
                                    }
                                    <button
                                        disabled={loading || (error && error.length > 0)}
                                        onClick={() => setShowConfirm(true)}
                                        className="bg-gray-800 rounded-lg p-2 w-full text-white mt-6 shadow-lg"
                                    >
                                        Confirm details
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

                <footer className="bg-gray-800 text-white text-xs p-4 fixed bottom-0 left-0 right-0">
                    buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
                </footer>
            </div>
        </>

    );
};

export default Airdrop;
