import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts";
import { Buffer } from "buffer";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";


const QuntUnwrap = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [quntWrappedContract] = useState("inj1u8a7878lnk469s9jel84fvd67jrtj3rj5cv8kx")
    const [tokenInfo, setTokenInfo] = useState(null)
    const [balance, setBalance] = useState(null)

    const [amountToUnwrap, setAmountToUnwrap] = useState(0)
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const getTokenInfo = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        const info = await module.getTokenInfo(quntWrappedContract)
        setTokenInfo(info)
        const balance = await module.queryTokenForBalance(quntWrappedContract, connectedAddress)
        setBalance(balance.balance)
    }, [networkConfig, quntWrappedContract, connectedAddress])

    useEffect(() => {
        if (connectedAddress && !balance) {
            getTokenInfo()
        }
    }, [connectedAddress, balance, getTokenInfo])

    const sendUnwrap = useCallback(async () => {
        if (!quntWrappedContract || !tokenInfo || !amountToUnwrap) {
            return
        }

        const injectiveAddress = connectedAddress;

        setError(null)

        const unwrap = Buffer.from(
            JSON.stringify({ unwrap_token: { denom: "factory/inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64/qunt" } })
        ).toString("base64");

        const unwrapMsg = MsgExecuteContractCompat.fromJSON({
            contractAddress: quntWrappedContract,
            sender: injectiveAddress,
            msg: {
                send: {
                    contract: "inj182hvp064stesu55clqnzhm68vj84qgt0jxf0ln",
                    amount: (amountToUnwrap * Math.pow(10, tokenInfo.decimals)).toLocaleString('fullwide', { useGrouping: false }),
                    msg: unwrap
                }
            },
            funds: []
        })

        console.log(unwrapMsg)

        const result = await performTransaction(
            injectiveAddress,
            [
                unwrapMsg
            ]
        )

        if (result) {
            setSuccess(true)
            void getTokenInfo()
        }
    }, [quntWrappedContract, connectedAddress, amountToUnwrap, tokenInfo, getTokenInfo])

    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">
            <div className="pt-14 md:pt-24 mx-2 pb-20">
                <div className="min-h-full mt-2 md:mt-0 ">
                    <div className="text-white text-center text-3xl font-magic">
                        Unwrap QUNT wormhole tokens
                    </div>

                    {tokenInfo !== null && balance &&
                        <div className="text-center mt-10">
                            Your wrapped balance: {balance / Math.pow(10, tokenInfo.decimals)} QUNT
                        </div>

                    }

                    <div className="flex flex-col justify-center mt-5">
                        <label className="text-center">Amount to unwrap</label>
                        <input
                            className="text-black m-auto p-1 rounded"
                            value={amountToUnwrap}
                            onChange={(e) => setAmountToUnwrap(e.target.value)}
                        />
                    </div>

                    {tokenInfo !== null &&
                        <div
                            className="bg-slate-800 w-40 m-auto mt-5 p-2 text-center rounded shadow-lg hover:cursor-pointer"
                            onClick={sendUnwrap}
                        >
                            Unwrap token
                        </div>
                    }

                    {error !== null &&
                        <div className="text-rose-600 text-lg mt-5 text-center">
                            {error}
                        </div>
                    }
                    {success &&
                        <div className="text-emerald-600 text-lg mt-5 text-center">
                            Token successfully unwrapped
                        </div>
                    }
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default QuntUnwrap