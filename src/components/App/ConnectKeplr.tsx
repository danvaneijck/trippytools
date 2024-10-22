import { useCallback } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { switchNetwork, setConnectedAddress, clearConnectedAddress } from '../../store/features/network';
import { getKeplrFromWindow } from "../../utils/keplr";

const ConnectKeplr = (props: { hideNetwork?: boolean, button?: boolean }) => {

    const dispatch = useDispatch();
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const loadKeplr = useCallback(async (chainId) => {
        const keplr = getKeplrFromWindow();
        await keplr.enable(chainId);
        const injectiveAddresses = await keplr.getOfflineSigner(chainId).getAccounts();
        dispatch(setConnectedAddress(injectiveAddresses[0].address));
    }, [dispatch])

    const disconnect = async () => {
        console.log("disconnect");
        const keplr = getKeplrFromWindow();
        await keplr.disable();
        dispatch(clearConnectedAddress());
    }

    // useEffect(() => {
    //     loadKeplr(networkConfig.chainId)
    // }, [loadKeplr, networkConfig])

    return (
        <div className=''>
            {connectedAddress ? (
                <div
                    onClick={disconnect}
                    className="text-xs flex flex-row hover:cursor-pointer"
                >
                    <button
                        className="flex items-center space-x-2"
                        onClick={() => {
                            dispatch(switchNetwork())
                        }}>
                        <span className="h-3 w-3 bg-green-500 rounded-full"></span>
                        <span className="capitalize">{currentNetwork}</span>
                    </button>
                    <div className='ml-5 border-2 border-white px-3 py-2 rounded-lg w-28 flex flex-col justify-center'>
                        <div className="self-center">{connectedAddress.slice(0, 5)}...{connectedAddress.slice(-5)}</div>
                        <div className="self-center" >Disconnect</div>
                    </div>
                </div>
            ) : (
                <div className="text-xs flex flex-row">
                    {!props.hideNetwork &&
                        <button
                            onClick={() => dispatch(switchNetwork())}
                            className="flex items-center space-x-2"
                        >
                            <span className="h-3 w-3 bg-green-500 rounded-full"></span>
                            <span className="capitalize">{currentNetwork}</span>
                        </button>
                    }
                    <button
                        className={props.button ?
                            "bg-slate-800 items-center justify-center flex p-2 rounded-lg w-full text-base " :
                            "ml-5 border-2 border-white p-3 rounded-lg font-bold"
                        }
                        onClick={() => loadKeplr(networkConfig.chainId)}
                    >
                        Connect Wallet
                    </button>
                </div>
            )}
        </div>
    );
}

export default ConnectKeplr