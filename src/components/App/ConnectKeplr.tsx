import { useWalletConnect } from "../WalletConnect";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { useCallback } from "react";

const ConnectKeplr = (props: { hideNetwork?: boolean, button?: boolean }) => {

    const { disconnect } = useWalletConnect()

    const { showWallets, setShowWallets, connectedWallet } = useWalletStore();
    const { networkKey, setNetwork } = useNetworkStore();

    const switchNetwork = useCallback(() => {
        if (networkKey == "mainnet") {
            setNetwork("testnet")
        }
        else {
            setNetwork("mainnet")
        }
    }, [networkKey, setNetwork])

    return (
        <div className=''>
            {connectedWallet ? (
                <div
                    onClick={disconnect}
                    className="text-xs flex flex-row hover:cursor-pointer"
                >
                    <button
                        className="flex items-center space-x-2"
                        onClick={switchNetwork}>
                        <span className="h-3 w-3 bg-green-500 rounded-full"></span>
                        <span className="capitalize">{networkKey}</span>
                    </button>
                    <div className='ml-5 border-2 border-white px-3 py-2 rounded-lg w-28 flex flex-col justify-center'>
                        <div className="self-center">{connectedWallet.slice(0, 5)}...{connectedWallet.slice(-5)}</div>
                        <div className="self-center" >Disconnect</div>
                    </div>
                </div>
            ) : (
                <div className="text-xs flex flex-row">
                    {!props.hideNetwork &&
                        <button
                            onClick={switchNetwork}
                            className="flex items-center space-x-2"
                        >
                            <span className="h-3 w-3 bg-green-500 rounded-full"></span>
                            <span className="capitalize">{networkKey}</span>
                        </button>
                    }
                    <button
                        className={props.button ?
                            "bg-slate-800 items-center justify-center flex p-2 rounded-lg w-full text-base " :
                            "ml-5 border-2 border-white p-3 rounded-lg font-bold"
                        }
                        onClick={() => setShowWallets(!showWallets)}
                    >
                        Connect Wallet
                    </button>
                </div>
            )}
        </div>
    );
}

export default ConnectKeplr