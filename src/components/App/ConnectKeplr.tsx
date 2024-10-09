import { useCallback } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { switchNetwork, setConnectedAddress, clearConnectedAddress } from '../../store/features/network';
import { getKeplrFromWindow } from "../../utils/keplr";

const ConnectKeplr = (props: { hideNetwork?: boolean, button?: boolean }) => {

    const dispatch = useDispatch();
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const loadKeplr = useCallback(async () => {
        const keplr = getKeplrFromWindow();
        const chainId = networkConfig.chainId;
        await keplr.enable(chainId);
        console.log("loaded keplr on chain id", networkConfig.chainId)
        const injectiveAddresses = await keplr.getOfflineSigner(chainId).getAccounts();
        dispatch(setConnectedAddress(injectiveAddresses[0].address));
    }, [dispatch, networkConfig])

    const disconnect = async () => {
        console.log("disconnect");
        const keplr = getKeplrFromWindow();
        await keplr.disable();
        dispatch(clearConnectedAddress());
    }

    return (
        <div className=''>
            {connectedAddress ? (
                <div className="text-xs flex flex-row">
                    <button onClick={() => {
                        dispatch(switchNetwork())
                        loadKeplr()
                    }}>
                        {currentNetwork}
                    </button>
                    <div className='ml-5 '>
                        <div>{connectedAddress}</div>
                        <div className="hover:cursor-pointer" onClick={disconnect}>Disconnect</div>
                    </div>
                </div>
            ) : (
                <div className="text-xs flex flex-row">
                    {!props.hideNetwork &&
                        <button onClick={() => dispatch(switchNetwork())}>
                            {currentNetwork}
                        </button>
                    }

                    <button className={props.button ? "bg-slate-800 items-center justify-center flex p-2 rounded-lg w-full text-base" : "ml-5"} onClick={loadKeplr}>
                        Connect Wallet
                    </button>
                </div>
            )}
        </div>
    );
}

export default ConnectKeplr