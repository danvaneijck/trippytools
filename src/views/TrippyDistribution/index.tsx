import { useEffect, useState, useCallback } from "react";
import logo from "../../assets/trippy-coin2.jpg";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import Countdown from "../../components/App/CountDown";

const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network",
};

interface PresaleAmount {
    address?: string | undefined;
    timeSent?: string | undefined;
    amountSent?: number | undefined;
    contribution?: number | undefined;
    toRefund?: number | undefined;
    amountSentFormatted?: number | undefined;
    totalContributionFormatted?: number | undefined;
    toRefundFormatted?: number | undefined;
    amountRefundedFormatted?: number | undefined;
    multiplierTokensSent?: number | undefined;
    multiplier?: number | undefined;
    adjustedContribution?: number | undefined;
    tokensToSend?: string | undefined;
    amountRefunded?: number | undefined;
    tokensSent?: string | undefined;
}

const TrippyDistribution = () => {
    const wallet = "inj1yegzy0u8z8k0mzcq6532nzk8eg2z9yyuppqxgk";
    const shroomAddress = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8";

    const [amounts, setAmounts] = useState<Map<string, PresaleAmount> | null>(
        null
    );
    const [loading, setLoading] = useState(false);

    const [totalRaised, setTotalRaised] = useState(0);
    const [injPrice, setInjPrice] = useState(0);
    const [lpStartingPrice, setLpStartingPrice] = useState(0);

    const tokenSupply = 1000000000;
    const tokenDecimals = 18;
    const lpPercent = 0.5;
    const preSaleAirdropPercent = 1 - lpPercent;
    const devAllocation = 0.005;

    const getAmounts = useCallback(async () => {
        const module = new TokenUtils(MAIN_NET);

        module.updateBaseAssetPrice().then(r => {
            console.log(r)
            if (r) setInjPrice(r)
        }).catch(e => {
            console.log(e)
        })

        const allTransactions = await module.getAccountTx(wallet);
        const maxCap = Number(2800); // INJ
        const minPerWallet = Number(0.1); // INJ
        const maxPerWallet = Number(50); // INJ

        if (allTransactions) {
            const totalRaised = module.getPreSaleAmounts(
                wallet,
                allTransactions,
                maxCap,
                minPerWallet,
                maxPerWallet
            );

            setTotalRaised(totalRaised);

            const totalAdjustedContribution = await module.getMultiplier(
                wallet,
                shroomAddress
            );

            let amountToDrop =
                tokenSupply * Math.pow(10, tokenDecimals) * preSaleAirdropPercent;
            const forDev = tokenSupply * Math.pow(10, tokenDecimals) * devAllocation;
            amountToDrop -= forDev;

            console.log(`dev allocated tokens: ${forDev / Math.pow(10, 18)}`);
            console.log(
                `number of tokens to airdrop: ${amountToDrop / Math.pow(10, tokenDecimals)
                }`
            );
            console.log(`total raised INJ: ${totalRaised}`);

            console.log(
                `LP starting price: ${(
                    (totalRaised * Math.pow(10, 18)) /
                    amountToDrop
                ).toFixed(8)} INJ`
            );

            setLpStartingPrice((
                (totalRaised * Math.pow(10, 18)) /
                amountToDrop
            ))

            const preSaleAmounts = module.generateAirdropCSV(
                totalRaised,
                totalAdjustedContribution,
                tokenSupply,
                tokenDecimals,
                preSaleAirdropPercent,
                devAllocation
            );

            return preSaleAmounts;
        }
    }, [preSaleAirdropPercent]);

    useEffect(() => {
        if (!amounts && !loading) {
            setLoading(true);
            getAmounts()
                .then((r) => {
                    if (r) {
                        setAmounts(r);
                    }
                    setLoading(false);
                })
                .catch((e) => {
                    console.log(e);
                });
        }
    }, [amounts, getAmounts, loading]);

    return (
        <div className="overflow-hidden">
            <header className="bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-base">
                    <Link to="/" className="font-bold hover:underline mr-5">
                        pre sale
                    </Link>
                    <Link
                        to="/token-holders"
                        className="font-bold hover:underline mr-5"
                    >
                        holders tool
                    </Link>
                    <Link
                        to="/token-liquidity"
                        className="font-bold hover:underline "
                    >
                        liquidity tool
                    </Link>
                </div>
            </header>
            <div>
                <div className="pt-14 text-center text-xl md:text-4xl font-bold flex flex-row justify-center items-center">
                    TRIPPY distribution
                    <img
                        src={logo}
                        style={{ borderRadius: "50%", width: 50, height: 50 }}
                        className="animate-3dspin ml-4"
                        alt="Spinning Image"
                    />
                </div>
                <div className="text-center mt-2 mb-1 hover:underline">
                    <Link to={"/"}>{"<-"} back to presale homepage</Link>
                </div>
                <div className="text-center w-full text-xl">
                    <Countdown targetUtcTime="2024-04-19T20:00:00Z" />
                </div>
                <div className="text-center w-full">
                    total raised: {totalRaised != 0 && totalRaised.toFixed(2)}{" "}
                    INJ / ${(totalRaised * injPrice).toFixed(2)}
                </div>
                <div className="text-center w-full">
                    INJ price on DojoSwap: ${injPrice.toFixed(2)}
                </div>
                <div className="text-center w-full">
                    LP starting price: {lpStartingPrice.toFixed(10)} INJ
                </div>
                <div className="text-center w-full">
                    starting liquidity: ${((totalRaised * injPrice) * 2).toFixed(2)}
                </div>
                <div className="text-center w-full">
                    starting market cap: ${((lpStartingPrice * 1000000000) * injPrice).toFixed(2)}
                </div>
                <div className="text-center w-full pt-2">
                    unique wallets {amounts && Array.from(amounts.values()).filter(amount => amount.address).length}
                </div>
                {loading && (
                    <div className="items-center justify-center flex flex-col pt-5">
                        <GridLoader color="#36d7b7" /> <br />
                    </div>
                )}
                <div className="mt-2 overflow-x-scroll md:overflow-x-none w-full pb-10 pl-5 pr-10">
                    <div className="mx-auto max-w-screen-xl">
                        <table className="w-full ">
                            <thead>
                                <tr className="text-left">
                                    <th className="pr-10">Address</th>
                                    <th className="pr-10">Contribution</th>
                                    <th className="pr-10">SHROOM</th>
                                    <th className="pr-10">Multiplier</th>
                                    <th className="pr-10">TRIPPY</th>
                                    <th className="pr-10">USD value</th>
                                    <th className="">% of supply</th>
                                </tr>
                            </thead>
                            <tbody>
                                {amounts &&
                                    Array.from(amounts.values())
                                        .sort(
                                            (a, b) =>
                                                Number(b.tokensToSend) -
                                                Number(a.tokensToSend)
                                        )
                                        .map((amount, index) => {
                                            if (!amount.address) {
                                                return null;
                                            }
                                            return <tr key={index}>
                                                <td className="pr-10 hover:underline flex flex-row items-center">
                                                    <a
                                                        href={`https://explorer.injective.network/account/${amount.address}`}
                                                    >
                                                        {amount.address}
                                                    </a>
                                                    {amount.address ==
                                                        "inj1lq9wn94d49tt7gc834cxkm0j5kwlwu4gm65lhe" && (
                                                            <div className="rounded bg-red-500 p-1 ml-2 text-xs">
                                                                trippykiwi
                                                            </div>
                                                        )}
                                                </td>
                                                <td className="pr-10">
                                                    {amount.contribution &&
                                                        (
                                                            amount.contribution /
                                                            Math.pow(10, 18)
                                                        ).toFixed(2)}{" "}
                                                    INJ
                                                </td>
                                                <td className="pr-10">
                                                    {amount.multiplierTokensSent &&
                                                        Math.min(amount.multiplierTokensSent, 10000000).toFixed(
                                                            0
                                                        )}{" "}
                                                    {amount.multiplierTokensSent !==
                                                        0 && "🍄"}
                                                </td>
                                                <td className="pr-10">
                                                    {amount.multiplier &&
                                                        `${amount.multiplier.toFixed(
                                                            2
                                                        )}x ${amount.multiplier.toFixed(
                                                            2
                                                        ) === "0.25"
                                                            ? "🔥"
                                                            : ""
                                                        }`}
                                                </td>
                                                <td className="pr-10 flex flex-row">
                                                    {amount.tokensToSend &&
                                                        (
                                                            Number(
                                                                amount.tokensToSend
                                                            ) / Math.pow(10, 18)
                                                        ).toFixed(0)}
                                                    <img
                                                        src={logo}
                                                        style={{
                                                            borderRadius: "50%",
                                                            width: 20,
                                                            height: 20,
                                                        }}
                                                        className="ml-2"
                                                        alt="Spinning Image"
                                                    />
                                                </td>
                                                <td className="pr-10 ">
                                                    ${amount.tokensToSend && lpStartingPrice && injPrice &&
                                                        (
                                                            (Number(
                                                                amount.tokensToSend
                                                            ) / Math.pow(10, 18)) * lpStartingPrice * injPrice
                                                        ).toFixed(2)}

                                                </td>
                                                <td className="">
                                                    {amount.tokensToSend &&
                                                        (() => {
                                                            const percentage =
                                                                (Number(
                                                                    amount.tokensToSend
                                                                ) /
                                                                    Math.pow(
                                                                        10,
                                                                        18
                                                                    ) /
                                                                    tokenSupply) *
                                                                100;
                                                            let emoji = "🦐";
                                                            if (
                                                                percentage > 4
                                                            ) {
                                                                emoji = "🐋";
                                                            } else if (
                                                                percentage > 2
                                                            ) {
                                                                emoji = "🦈";
                                                            } else if (
                                                                percentage > 0.5
                                                            ) {
                                                                emoji = "🐟";
                                                            }
                                                            return `${percentage.toFixed(
                                                                2
                                                            )}% ${emoji}`;
                                                        })()}
                                                </td>
                                            </tr>
                                        })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrippyDistribution;
