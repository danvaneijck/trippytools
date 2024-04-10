import { useEffect, useState, useCallback } from 'react';
import logo from '../../assets/trippy-coin2.jpg';
import TokenUtils from '../../modules/tokenUtils';
import { GridLoader } from 'react-spinners';

const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network"
}

const TrippyDistribution = () => {

    const wallet = "inj1yegzy0u8z8k0mzcq6532nzk8eg2z9yyuppqxgk"
    const shroomAddress = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"

    const [amounts, setAmounts] = useState(null)
    const [loading, setLoading] = useState(false)

    const getAmounts = useCallback(async () => {
        const module = new TokenUtils(MAIN_NET);

        const allTransactions = await module.getAccountTx(wallet);
        const maxCap = Number(2800);       // INJ
        const minPerWallet = Number(0.1);  // INJ
        const maxPerWallet = Number(50);   // INJ

        if (allTransactions) {
            const totalRaised = module.getPreSaleAmounts(
                wallet,
                allTransactions,
                maxCap,
                minPerWallet,
                maxPerWallet,
            );

            const totalAdjustedContribution = await module.getMultiplier(wallet, shroomAddress)
            const tokenSupply = 1000000000;
            const tokenDecimals = 18;
            const lpPercent = 0.5
            const preSaleAirdropPercent = 1 - lpPercent;
            const devAllocation = 0.005;

            const preSaleAmounts = module.generateAirdropCSV(
                totalRaised,
                totalAdjustedContribution,
                tokenSupply,
                tokenDecimals,
                preSaleAirdropPercent,
                devAllocation,
            );

            console.log(preSaleAmounts)

            return preSaleAmounts

        }

    }, [wallet]);

    useEffect(() => {
        if (!amounts && !loading) {
            setLoading(true)
            getAmounts().then(r => {
                console.log(r)
                setAmounts(r)
                setLoading(false)
            }).catch(e => {
                console.log(e)
            })
        }

    }, [getAmounts, amounts, loading])

    return <div className='overflow-hidden'>
        <div>
            <div className='text-center pt-8 text-4xl md:text-5xl font-bold flex flex-row justify-center items-center'>
                TRIPPY distribution
                <img
                    src={logo}
                    style={{ borderRadius: '50%', width: 60, height: 60 }}
                    className="animate-3dspin ml-5"
                    alt="Spinning Image"
                />
            </div>
            {loading && <div className="items-center justify-center flex flex-col pt-5">
                <GridLoader color="#36d7b7" /> <br />
            </div>}
            <div className='m-auto mt-5 overflow-x-scroll w-full md:w-2/3 pb-10'>
                <table>
                    <thead>
                        <tr className='text-left'>
                            <th className='pr-5'>Address</th>
                            <th className='pr-5'>Contribution</th>
                            <th className='pr-5'>SHROOM Sent</th>
                            <th className='pr-5'>Multiplier</th>
                            <th className=''>TRIPPY allocation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {amounts && Array.from(amounts.values()).sort((a, b) => b.tokensToSend - a.tokensToSend).map((amount, index) => (
                            <tr key={index}>
                                <td className='pr-5'>{amount.address}</td>
                                <td className='pr-5'>{(amount.contribution / Math.pow(10, 18)).toFixed(2)} INJ</td>
                                <td className='pr-5'>{amount.multiplierTokensSent.toFixed(0)} SHROOM</td>
                                <td className='pr-5'>{amount.multiplier.toFixed(2)}x</td>
                                <td className=''>{(amount.tokensToSend / Math.pow(10, 18)).toFixed(0)} TRIPPY</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
};

export default TrippyDistribution;
