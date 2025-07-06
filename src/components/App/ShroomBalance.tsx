import { useCallback, useEffect, useState } from "react"
import TokenUtils from "../../modules/tokenUtils";
import shroom from "../../assets/shroom.jpg"
import { humanReadableAmount } from "../../utils/helpers";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";

const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"

const ShroomBalance = () => {
    const { connectedWallet } = useWalletStore()
    const { networkKey, network } = useNetworkStore()

    const [loading, setLoading] = useState(false)
    const [lastLoadedAddress, setLastLoadedAddress] = useState(null)

    const [balance, setBalance] = useState(null)
    const [usd, setUsd] = useState(null)

    const getBalance = useCallback(async () => {
        if (!connectedWallet) return
        const module = new TokenUtils(network);
        try {
            const [baseAssetPrice, tokenBalance, pairInfo] = await Promise.all([
                module.getINJPrice(),
                module.queryTokenForBalance(SHROOM_TOKEN_ADDRESS, connectedWallet),
                module.getPairInfo(SHROOM_PAIR_ADDRESS)
            ]);
            const normalizedBalance = (tokenBalance.balance / Math.pow(10, 18)).toFixed(2);
            setBalance(normalizedBalance);
            const quote = await module.getSellQuoteRouter(pairInfo, tokenBalance.balance);
            const returnAmount = Number(quote.amount) / Math.pow(10, 18);
            const totalUsdValue = (returnAmount * baseAssetPrice).toFixed(2);
            setUsd(totalUsdValue);
            setLastLoadedAddress(connectedWallet)
            return normalizedBalance
        } catch (error) {
            console.error('Failed to update balance and USD value:', error);
        }
    }, [connectedWallet, network]);

    useEffect(() => {
        if (!connectedWallet) return
        if (loading) return
        if (!balance || !usd || (!lastLoadedAddress || lastLoadedAddress !== connectedWallet)) {
            setLoading(true)
            getBalance().then(r => {

            }).catch(e => {
                console.log(e)
            }).finally(() => {
                setLoading(false)
            })
        }
    }, [balance, getBalance, usd, loading, connectedWallet, lastLoadedAddress])

    useEffect(() => {
        setLastLoadedAddress(null)
        if (!connectedWallet) {
            setBalance(null)
            setUsd(null)
        }
    }, [connectedWallet])

    return (
        <div className="flex self-end items-center text-sm w-full hover:cursor-pointer max-w-screen-sm" onClick={getBalance}>
            <div>
                <img src={shroom} style={{ borderRadius: '50%', width: 32 }} className="mr-2" alt="Spinning Image" />
            </div>
            {balance ? humanReadableAmount(balance) : "0"}
            <br />
            ${usd ? usd : "0"}
        </div>
    )
}

export default ShroomBalance