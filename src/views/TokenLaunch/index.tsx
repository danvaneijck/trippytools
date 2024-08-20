import { useState } from "react";
import { Link } from "react-router-dom";
import parachute from "../../assets/parachute.webp"
import TokenConfirmModal from "./TokenConfirmModal";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";
import ShroomBalance from "../../components/App/ShroomBalance";
import Footer from "../../components/App/Footer";


const TokenLaunch = () => {

    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);

    const [tokenName, setTokenName] = useState("token-name");
    const [tokenSymbol, setTokenSymbol] = useState("token-symbol");
    const [tokenSupply, setTokenSupply] = useState(1000000);
    const [tokenDecimals, setTokenDecimals] = useState(6);
    const [tokenImageUrl, setTokenImageUrl] = useState("");
    const [tokenDescription, setTokenDescription] = useState("token description");

    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);


    return (
        <>
            {showConfirm &&
                <TokenConfirmModal
                    setShowModal={setShowConfirm}
                    tokenName={tokenName}
                    tokenSymbol={tokenSymbol}
                    tokenSupply={tokenSupply}
                    tokenDecimals={tokenDecimals}
                    tokenImage={tokenImageUrl}
                    tokenDescription={tokenDescription}
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

                <div className="mt-14 flex-grow mx-2">
                    {currentNetwork == "mainnet" && <div className="flex "><ShroomBalance /></div>}
                    <div className="flex justify-center items-center min-h-full">
                        <div className="w-full max-w-screen-sm px-2 pb-10">
                            <div className="flex flex-row justify-center items-center">
                                <div>
                                    <div className="text-center text-xl">Launch new token</div>
                                    <div className="text-xs text-center">on Injective {currentNetwork}</div>
                                </div>
                                <img
                                    src={parachute}
                                    style={{ width: 140 }}
                                    className="ml-5 rounded-xl"
                                    alt="airdrop"
                                />
                            </div>

                            <div className="text-center mt-4 mb-1">New Token Details</div>

                            <div className="flex flex-col md:flex-row justify-between">
                                <div className="mb-1">
                                    <label
                                        className="block text-base font-bold  text-white"
                                    >
                                        Token name
                                    </label>
                                    <input
                                        type="text"
                                        className="text-black w-full rounded p-1 text-sm"
                                        onChange={(e) =>
                                            setTokenName(e.target.value)
                                        }
                                        value={tokenName}
                                    />
                                </div>
                                <div className="ml-0 md:ml-2">
                                    <label
                                        className="block text-base font-bold text-white"
                                    >
                                        Token symbol
                                    </label>

                                    <input
                                        type="text"
                                        className="text-black w-full rounded p-1 text-sm"
                                        onChange={(e) =>
                                            setTokenSymbol(e.target.value)
                                        }
                                        value={tokenSymbol}
                                    />
                                    <span className="text-xs">all capitals if you want to launch LP on DojoSwap</span>

                                </div>
                            </div>

                            <div className="mt-2 ">
                                <label
                                    className="text-base font-bold text-white "
                                >
                                    Token description
                                </label>
                                <input
                                    type="text"
                                    className="text-black w-full rounded p-1 text-sm"
                                    onChange={(e) =>
                                        setTokenDescription(e.target.value)
                                    }
                                    value={tokenDescription}
                                />
                            </div>
                            <div className="flex flex-col md:flex-row justify-between mt-4">
                                <div className="mb-1">
                                    <label
                                        className="block text-base font-bold text-white"
                                    >
                                        Token supply
                                    </label>
                                    <input
                                        type="number"
                                        className="text-black w-full rounded p-1 text-sm"
                                        onChange={(e) =>
                                            setTokenSupply(Number(e.target.value))
                                        }
                                        value={tokenSupply}
                                    />
                                </div>
                                <div className="">
                                    <label
                                        className="block text-base font-bold text-white"
                                    >
                                        Token decimals
                                    </label>
                                    <input
                                        type="number"
                                        className="text-black w-full rounded p-1 text-sm"
                                        onChange={(e) =>
                                            setTokenDecimals(Number(e.target.value))
                                        }
                                        value={tokenDecimals}
                                    />
                                </div>
                            </div>

                            <div className="mt-2">
                                <label
                                    className="block font-bold text-white"
                                >
                                    Token image URL
                                </label>
                                <span className="text-xs">the logo of your token, should be hosted on IPFS and should be a small webp image and accessible via https://</span>
                                <input
                                    type="text"
                                    className="text-black w-full rounded p-1 text-sm"
                                    onChange={(e) =>
                                        setTokenImageUrl(e.target.value)
                                    }
                                    value={tokenImageUrl}
                                />
                            </div>

                            {error && error.length > 0 &&
                                <div className="my-2 text-red-500">
                                    Error: {error}
                                </div>
                            }
                            {connectedAddress &&
                                <div className="my-10">
                                    <button
                                        disabled={loading}
                                        onClick={() => setShowConfirm(true)}
                                        className="bg-gray-800 rounded-lg p-2 w-full text-white mt-6 shadow-lg"
                                    >
                                        Confirm details
                                    </button>
                                </div>
                            }
                            {!connectedAddress && <div className="text-center mt-5 bg-gray-800 rounded-lg p-2 mt-6">
                                Please connect your wallet to continue
                            </div>}
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        </>

    );
};

export default TokenLaunch;
