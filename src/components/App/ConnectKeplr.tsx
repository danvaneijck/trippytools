import { ChainId } from '@injectivelabs/ts-types'
import { useState } from "react";

const ConnectKeplr = (props: { setWallet: (arg0: any) => void; }) => {

    const [address, setAddress] = useState(null)

    const getKeplr = () => {
        if (!window.keplr) {
            throw new Error('Keplr extension not installed')
        }
        return window.keplr
    }

    const loadKeplr = async () => {
        const keplr = getKeplr()
        const chainId = ChainId.Mainnet
        await keplr.enable(chainId)
        const injectiveAddresses = await keplr.getOfflineSigner(chainId).getAccounts()
        props.setWallet(injectiveAddresses[0])
        setAddress(injectiveAddresses[0].address)
    }

    const disconnect = async () => {
        console.log("disconnect")
        const keplr = getKeplr()
        await keplr.disable()
        setAddress(null)
    }

    return (
        <div>
            {address ?
                <div className="text-xs">
                    <div>
                        {address}
                    </div>
                    <div onClick={disconnect}>
                        disconnect
                    </div>
                </div> :
                <button onClick={loadKeplr}>
                    Connect Wallet
                </button>
            }

        </div>
    )
}

export default ConnectKeplr