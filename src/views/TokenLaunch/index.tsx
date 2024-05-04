/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, PairInfo, TokenInfo } from "../../types";
import parachute from "../../assets/parachute.webp"
import ConfirmModal from "./ConfirmModal";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";

interface AirdropData {
    address: string
    amountToAirdrop: string | number
    percentToAirdrop: string | number
}


const TokenLaunch = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [tokenName, setTokenName] = useState("token-name");
    const [tokenSymbol, setTokenSymbol] = useState("token-symbol");
    const [tokenSupply, setTokenSupply] = useState(1000000);
    const [tokenDecimals, setTokenDecimals] = useState(6);
    const [tokenImageUrl, setTokenImageUrl] = useState("");
    const [tokenDescription, setTokenDescription] = useState("token description");

    const [airdropPercent, setAirdropPercent] = useState(50);
    const [tokenAddress, setTokenAddress] = useState("factory/inj1lq9wn94d49tt7gc834cxkm0j5kwlwu4gm65lhe/shroom2");
    const [distMode, setDistMode] = useState("fair");

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [progress, setProgress] = useState("");

    const [showAirdrop, setShowAirdrop] = useState(false);

    const [airdropDetails, setAirdropDetails] = useState<AirdropData[]>([])

    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null)


    const getAirdropPreview = useCallback(async () => {
        if (!tokenAddress) return
        const module = new TokenUtils(networkConfig)

        console.log("get airdrop preview")
        setAirdropDetails([])
        setLoading(true)

        if (
            tokenAddress.includes("factory") ||
            tokenAddress.includes("peggy") ||
            tokenAddress.includes("ibc")
        ) {
            const r = await module.getDenomMetadata(tokenAddress)
            setTokenInfo(r);
        } else {
            const info = await module.getTokenInfo(tokenAddress)
            setTokenInfo(info);
            const marketing = await module.getTokenMarketing(tokenAddress)
            setPairMarketing(marketing)
        }

        let holders: Holder[] = []
        if (
            tokenAddress.includes("factory") ||
            tokenAddress.includes("peggy") ||
            tokenAddress.includes("ibc")
        ) {
            const r = await module.getTokenFactoryTokenHolders(tokenAddress, setProgress)
            if (r) holders = r
        }
        else {
            const r = await module.getCW20TokenHolders(tokenAddress, setProgress)
            if (r) holders = r
        }

        const supplyToAirdrop = tokenSupply * (airdropPercent / 100)

        let airdropData: AirdropData[] = [];
        if (distMode === "fair") {
            const amountToAirdrop = supplyToAirdrop / holders.length;
            airdropData = holders.map(holder => ({
                address: holder.address,
                amountToAirdrop,
                percentToAirdrop: (amountToAirdrop / tokenSupply) * 100
            }));
        } else if (distMode === "proportionate") {
            airdropData = holders.map(holder => ({
                address: holder.address,
                amountToAirdrop: (Number(holder.percentageHeld) / 100) * supplyToAirdrop,
                percentToAirdrop: Number(holder.percentageHeld)
            }));
        }

        setAirdropDetails(airdropData)
        console.log("set airdrop data")
        setLoading(false)
    }, [tokenAddress, distMode, tokenSupply, airdropPercent, networkConfig])


    return (
        <>
            {showConfirm &&
                <ConfirmModal
                    setShowModal={setShowConfirm}
                    tokenName={tokenName}
                    tokenSymbol={tokenSymbol}
                    tokenSupply={tokenSupply}
                    tokenDecimals={tokenDecimals}
                    tokenImage={tokenImageUrl}
                    airdropPercent={showAirdrop ? airdropPercent : 0}
                    tokenDescription={tokenDescription}
                    airdropDetails={showAirdrop ? airdropDetails : []}
                />
            }
            <div className="flex flex-col min-h-screen">
                <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                    <div className=" container mx-auto flex items-center p-2 text-sm md:text-sm">
                        <Link to="/" className="font-bold hover:underline mx-5">
                            home
                        </Link>
                        <Link
                            to="/token-holders"
                            className="font-bold hover:underline  mr-5"
                        >
                            token holders
                        </Link>
                        <Link to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="font-bold hover:underline mr-5">
                            token liquidity
                        </Link>
                        <Link to="/manage-tokens" className="font-bold hover:underline">
                            manage tokens
                        </Link>
                    </div>
                    <div className="m-2">
                        <ConnectKeplr />
                    </div>
                </header>

                <div className="pt-5 flex-grow mx-2 pb-20">
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-screen-sm px-2 py-10">
                            <div className="flex flex-row justify-center items-center">
                                <div>
                                    <div className="text-center text-xl">Launch and airdrop new token</div>
                                    <div className="text-xs text-center">on Injective {currentNetwork}</div>
                                </div>
                                <img
                                    src={parachute}
                                    style={{ width: 140 }}
                                    className="ml-5 rounded-xl"
                                    alt="airdrop"
                                />
                            </div>

                            <div className="text-center mt-4">New Token Details</div>

                            <div className="flex flex-col md:flex-row justify-between">
                                <div className="">
                                    <label
                                        className="block text-white"
                                    >
                                        Token name
                                    </label>
                                    <input
                                        type="text"
                                        className="text-black w-full rounded p-1"
                                        onChange={(e) =>
                                            setTokenName(e.target.value)
                                        }
                                        value={tokenName}
                                    />
                                </div>
                                <div className="">
                                    <label
                                        className="block text-white"
                                    >
                                        Token symbol
                                    </label>
                                    <input
                                        type="text"
                                        className="text-black w-full rounded p-1"
                                        onChange={(e) =>
                                            setTokenSymbol(e.target.value)
                                        }
                                        value={tokenSymbol}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                <label
                                    className="block text-white"
                                >
                                    Token description
                                </label>
                                <input
                                    type="text"
                                    className="text-black w-full rounded p-1"
                                    onChange={(e) =>
                                        setTokenDescription(e.target.value)
                                    }
                                    value={tokenDescription}
                                />
                            </div>
                            <div className="flex flex-col md:flex-row justify-between mt-4">
                                <div className="space-y-2">
                                    <label
                                        className="block text-white"
                                    >
                                        Token supply
                                    </label>
                                    <input
                                        type="number"
                                        className="text-black w-full rounded p-1"
                                        onChange={(e) =>
                                            setTokenSupply(Number(e.target.value))
                                        }
                                        value={tokenSupply}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label
                                        className="block text-white"
                                    >
                                        Token decimals
                                    </label>
                                    <input
                                        type="number"
                                        className="text-black w-full rounded p-1"
                                        onChange={(e) =>
                                            setTokenDecimals(Number(e.target.value))
                                        }
                                        value={tokenDecimals}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                <label
                                    className="block text-white"
                                >
                                    Token image URL
                                </label>
                                <span className="text-xs">the logo of your token, should be hosted on IPFS and should be a small webp image</span>
                                <input
                                    type="text"
                                    className="text-black w-full rounded p-1"
                                    onChange={(e) =>
                                        setTokenImageUrl(e.target.value)
                                    }
                                    value={tokenImageUrl}
                                />
                            </div>

                            <div className="flex flex-row mt-4" >
                                <label
                                    onClick={() => setShowAirdrop(airdrop => !airdrop)}
                                    className="w-full text-white"
                                >
                                    I want to airdrop my token
                                </label>
                                <input
                                    type="checkbox"
                                    className="text-black w-full rounded p-1"
                                    onChange={() => setShowAirdrop(airdrop => !airdrop)}
                                    checked={showAirdrop}
                                />
                            </div>
                            {showAirdrop &&

                                <div>
                                    <div className="text-center mt-4">Airdrop Details</div>
                                    <div className="mt-4 space-y-2">
                                        <label
                                            className="block text-white"
                                        >
                                            Airdrop percent
                                        </label>
                                        <input
                                            type="number"
                                            className="text-black w-full rounded p-1"
                                            onChange={(e) =>
                                                setAirdropPercent(Number(e.target.value))
                                            }
                                            value={airdropPercent}
                                        />
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <label
                                            className="block text-white"
                                        >
                                            airdrop to holders of token
                                        </label>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded p-1"
                                            onChange={(e) =>
                                                setTokenAddress(e.target.value)
                                            }
                                            value={tokenAddress}
                                        />
                                    </div>
                                    <div className="mt-4 space-y-2 mb-5">
                                        <label
                                            className="block text-white"
                                        >
                                            Distribution
                                        </label>
                                        <div className="flex flex-row w-full justify-between ">
                                            <div className="flex flex-row" onClick={() => setDistMode("fair")}>
                                                <input
                                                    type="checkbox"
                                                    className="text-black w-full rounded p-1"
                                                    onChange={() => { setDistMode("fair") }}
                                                    checked={distMode == "fair"}
                                                />
                                                <label
                                                    className="block text-white ml-5"
                                                >
                                                    fair
                                                </label>
                                            </div>
                                            <div className="flex flex-row" onClick={() => setDistMode("proportionate")}>
                                                <input
                                                    type="checkbox"
                                                    className="text-black w-full rounded p-1"
                                                    onChange={() => { setDistMode("proportionate") }}
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
                                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                        onClick={getAirdropPreview}
                                        className="bg-gray-800 rounded p-2 w-full text-white border border-white"
                                    >
                                        Generate airdrop list
                                    </button>
                                    {airdropDetails.length > 0 &&
                                        <div className="mt-5">
                                            <div className="max-h-80 overflow-y-scroll overflow-x-auto">
                                                <div>Total participants: {airdropDetails.length}</div>
                                                <div className=" mt-2">
                                                    <table className="table-auto w-full">
                                                        <thead className="text-white">
                                                            <tr>
                                                                <th className="px-4 py-2">
                                                                    Address
                                                                </th>
                                                                <th className="px-4 py-2">
                                                                    Airdrop
                                                                </th>
                                                                <th className="px-4 py-2">
                                                                    Percentage
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {airdropDetails
                                                                .map((holder, index) => (
                                                                    <tr
                                                                        key={index}
                                                                        className="text-white border-b text-xs"
                                                                    >
                                                                        <td className="px-6 py-1 whitespace-nowrap">
                                                                            <a
                                                                                className="hover:text-indigo-900"
                                                                                href={`https://explorer.injective.network/account/${holder.address}`}
                                                                            >
                                                                                {holder.address}
                                                                            </a>


                                                                        </td>
                                                                        <td className="px-6 py-1">
                                                                            {Number(holder.amountToAirdrop).toFixed(4)}{" "}
                                                                        </td>
                                                                        <td className="px-6 py-1">
                                                                            {
                                                                                Number(holder.percentToAirdrop).toFixed(2)
                                                                            }
                                                                            %
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
                            {(!showAirdrop || (showAirdrop && airdropDetails.length > 0)) && connectedAddress &&
                                <button
                                    disabled={loading}
                                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                    onClick={() => setShowConfirm(true)}
                                    className="bg-gray-800 rounded p-2 w-full text-white border border-white mt-6"
                                >
                                    Confirm details
                                </button>
                            }
                            {!connectedAddress && <div className="text-center mt-5 bg-gray-800 rounded-lg p-2 mt-6">
                                Please connect your wallet to continue
                            </div>}
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

export default TokenLaunch;
