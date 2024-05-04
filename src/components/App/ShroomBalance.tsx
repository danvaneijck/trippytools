import { useCallback, useEffect, useState } from "react"
import TokenUtils from "../../modules/tokenUtils";
import { useSelector } from "react-redux";

const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"

const ShroomBalance = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);
    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const [balance, setBalance] = useState(null)
    const [usd, setUsd] = useState(null)
    const getBalance = useCallback(async () => {
        const module = new TokenUtils(networkConfig);
        try {
            const [baseAssetPrice, tokenBalance, pairInfo] = await Promise.all([
                module.updateBaseAssetPrice(),
                module.queryTokenForBalance(SHROOM_TOKEN_ADDRESS, connectedAddress),
                module.getPairInfo(SHROOM_PAIR_ADDRESS)
            ]);
            const normalizedBalance = (tokenBalance.balance / Math.pow(10, 18)).toFixed(2);
            setBalance(normalizedBalance);
            const quote = await module.getSellQuoteRouter(pairInfo, tokenBalance.balance);
            const returnAmount = Number(quote.amount) / Math.pow(10, 18);
            const totalUsdValue = (returnAmount * baseAssetPrice).toFixed(2);
            setUsd(totalUsdValue);
        } catch (error) {
            console.error('Failed to update balance and USD value:', error);
        }
    }, [connectedAddress, networkConfig]);


    useEffect(() => {
        if (!balance) {
            getBalance().then(r => {
                console.log("got balance", r)
            }).catch(e => {
                console.log(e)
            })
        }
    }, [balance, getBalance])

    return (
        <div className="flex items-center text-sm w-full hover:cursor-pointer" onClick={getBalance}>
            shroom balance: {balance && balance}
            <br />
            ${usd && usd}
        </div>
    )
}

export default ShroomBalance