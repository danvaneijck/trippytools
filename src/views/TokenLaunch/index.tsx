/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, PairInfo, TokenInfo } from "../../types";
import parachute from "../../assets/parachute.webp"
import ConfirmModal from "./ConfirmModal";
import ConnectKeplr from "../../components/App/ConnectKeplr";


const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network",
};

interface AirdropData {
    address: string
    amountToAirdrop: string | number
    percentToAirdrop: string | number
}



const TokenLaunch = () => {

    const [module, setModule] = useState<TokenUtils | null>(null);

    const [tokenName, setTokenName] = useState("my new token");
    const [tokenSymbol, setTokenSymbol] = useState("NEW");
    const [tokenSupply, setTokenSupply] = useState(1000000000);
    const [tokenDecimals, setTokenDecimals] = useState(6);
    const [tokenImageUrl, setTokenImageUrl] = useState("ipfs url...");
    const [tokenDescription, setTokenDescription] = useState("example description");

    const [airdropPercent, setAirdropPercent] = useState(50);
    const [tokenAddress, setTokenAddress] = useState("factory/inj13y5nqf8mymy9tfxkg055th7hdm2uaahs9q6q5w/SNAPPY");
    const [distMode, setDistMode] = useState("fair");

    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [pairMarketing, setPairMarketing] = useState<MarketingInfo | null>(null);

    const [progress, setProgress] = useState("");

    const [airdropDetails, setAirdropDetails] = useState<AirdropData[]>([])

    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null)

    const [keplrSigner, setKeplrSigner] = useState(null);

    useEffect(() => {
        if (!module) {
            setModule(new TokenUtils(MAIN_NET))
        }
    }, [module])

    const getPreview = useCallback(async () => {
        if (!module) return
        if (!tokenAddress) return

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
    }, [module, tokenAddress, distMode, tokenSupply, airdropPercent])


    return (
        <>
            {showConfirm &&
                <ConfirmModal
                    wallet={keplrSigner}
                    setShowModal={setShowConfirm}
                    tokenName={tokenName}
                    tokenSymbol={tokenSymbol}
                    tokenSupply={tokenSupply}
                    tokenDecimals={tokenDecimals}
                    tokenImage={tokenImageUrl}
                    airdropPercent={airdropPercent}
                    tokenDescription={tokenDescription}
                    airdropDetails={airdropDetails}
                />
            }
            <div className="flex flex-col min-h-screen">
                <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                    <div className=" container mx-auto flex items-center p-2 text-sm md:text-base">
                        <Link to="/" className="font-bold hover:underline mr-5">
                            home
                        </Link>
                        <Link
                            to="/token-holders"
                            className="font-bold hover:underline  mr-5"
                        >
                            token holder tool
                        </Link>
                        <Link to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="font-bold hover:underline">
                            token liquidity tool
                        </Link>

                    </div>
                    {/* <div className="m-2">
                        <ConnectKeplr setWallet={setKeplrSigner} />
                    </div> */}
                </header>

                <div className="pt-5 flex-grow mx-2 pb-20">
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-screen-sm px-2 py-10">
                            <div className="flex flex-row justify-center items-center">
                                <div>
                                    <div className="text-center text-xl">Launch and airdrop new token</div>
                                    <div className="text-xs text-center">on Injective main net</div>
                                </div>
                                <img
                                    src={parachute}
                                    style={{ width: 100 }}
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
                                        className="text-black w-full"
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
                                        className="text-black w-full"
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
                                    className="text-black w-full"
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
                                        className="text-black w-full"
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
                                        className="text-black w-full"
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
                                <input
                                    type="text"
                                    className="text-black w-full"
                                    onChange={(e) =>
                                        setTokenImageUrl(e.target.value)
                                    }
                                    value={tokenImageUrl}
                                />
                            </div>

                            <div className="text-center mt-4">Airdrop Details</div>
                            <div className="mt-4 space-y-2">
                                <label
                                    className="block text-white"
                                >
                                    Airdrop percent
                                </label>
                                <input
                                    type="number"
                                    className="text-black w-full"
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
                                    className="text-black w-full"
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
                                            className="text-black w-full"
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
                                            className="text-black w-full"
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
                                onClick={getPreview}
                                className="bg-gray-800 rounded p-2 w-full text-white border border-white"
                            >
                                Get airdrop preview
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

                            <button
                                disabled={loading}
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                onClick={() => setShowConfirm(true)}
                                className="bg-gray-800 rounded p-2 w-full text-white border border-white mt-4"
                            >
                                Continue
                            </button>
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
