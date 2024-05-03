import { useCallback, useState } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { switchNetwork } from '../../store/features/network';

const ConnectKeplr = () => {

    const [address, setAddress] = useState(null);
    const dispatch = useDispatch();
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const getKeplr = () => {
        if (!window.keplr) {
            throw new Error('Keplr extension not installed')
        }
        return window.keplr
    }

    const loadKeplr = useCallback(async () => {
        console.log(networkConfig)
        const keplr = getKeplr();
        const chainId = networkConfig.chainId;
        await keplr.enable(chainId);
        const injectiveAddresses = await keplr.getOfflineSigner(chainId).getAccounts();
        setAddress(injectiveAddresses[0].address);
    }, [networkConfig])

    const disconnect = async () => {
        console.log("disconnect");
        const keplr = getKeplr();
        await keplr.disable();
        setAddress(null);
    }

    return (
        <div className=''>
            {address ? (
                <div className="text-xs flex flex-row">
                    <button onClick={() => {
                        dispatch(switchNetwork())
                        loadKeplr()
                    }}>
                        {currentNetwork}
                    </button>
                    <div className='ml-5'>
                        <div>{address}</div>
                        <div onClick={disconnect}>Disconnect</div>
                    </div>
                </div>
            ) : (
                <div className="text-xs flex flex-row">
                    <button onClick={() => dispatch(switchNetwork())}>
                        {currentNetwork}
                    </button>
                    <button className="ml-5" onClick={loadKeplr}>
                        Connect Wallet
                    </button>
                </div>
            )}
        </div>
    );
}

export default ConnectKeplr