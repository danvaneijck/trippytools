import { useCallback, useEffect, useState } from "react"
import { BigNumber } from "@injectivelabs/utils";
import shroom from "../../assets/shroom.jpg"
import { humanReadableAmount } from "../../utils/helpers";
import useWalletStore from "../../store/useWalletStore";
import { getSwapApi } from "../../utils/swap/SwapApi";
import {
    SHROOM_BANK_DENOM,
    SHROOM_TOKEN_ADDRESS,
    quoteShroomSellUsd,
} from "../../utils/shroomFee";

const ShroomBalance = () => {
    const { connectedWallet } = useWalletStore()

    const [loading, setLoading] = useState(false)
    const [lastLoadedAddress, setLastLoadedAddress] = useState<string | null>(null)

    const [balance, setBalance] = useState<string | null>(null)
    const [usd, setUsd] = useState<string | null>(null)

    const getBalance = useCallback(async () => {
        if (!connectedWallet) return
        // Mark the address as attempted up-front so a failed load doesn't spin
        // the polling effect; the user can still force a refresh by clicking.
        setLastLoadedAddress(connectedWallet)
        const api = getSwapApi();
        try {
            // SHROOM is sellable whether held as CW20 or as its bank
            // (factory-wrapped) denom — the fee flow auto-converts bank → CW20 —
            // so count both toward the balance and the sell quote.
            const [cw20, bank] = await Promise.all([
                api.queryTokenForBalance(SHROOM_TOKEN_ADDRESS, connectedWallet).catch(() => ({ balance: '0' })),
                api.getBalanceOfToken(SHROOM_BANK_DENOM, connectedWallet).catch(() => ({ amount: '0' })),
            ]);
            const totalShroom = new BigNumber(cw20?.balance ?? 0)
                .plus(bank?.amount ?? 0)
                .shiftedBy(-18);
            setBalance(totalShroom.toFixed(2));

            const sellUsd = await quoteShroomSellUsd(totalShroom.toNumber());
            setUsd(sellUsd === null ? null : sellUsd.toFixed(2));
            return totalShroom.toFixed(2)
        } catch (error) {
            console.error('Failed to update balance and USD value:', error);
        }
    }, [connectedWallet]);

    useEffect(() => {
        if (!connectedWallet) return
        if (loading) return
        if (lastLoadedAddress === connectedWallet) return
        setLoading(true)
        getBalance().catch(e => {
            console.log(e)
        }).finally(() => {
            setLoading(false)
        })
    }, [loading, connectedWallet, lastLoadedAddress, getBalance])

    useEffect(() => {
        setLastLoadedAddress(null)
        if (!connectedWallet) {
            setBalance(null)
            setUsd(null)
        }
    }, [connectedWallet])

    return (
        <div className="flex self-end items-center text-sm w-full hover:cursor-pointer max-w-(--breakpoint-sm)" onClick={() => { void getBalance(); }}>
            <div>
                <img src={shroom} style={{ borderRadius: '50%', width: 32 }} className="mr-2" alt="Spinning Image" />
            </div>
            {balance ? humanReadableAmount(Number(balance)) : "0"}
            <br />
            ${usd ? usd : "0"}
        </div>
    )
}

export default ShroomBalance
