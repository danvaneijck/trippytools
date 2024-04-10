import { useRef, useEffect, useState, useCallback } from 'react';
// @ts-ignore
import CELLS from 'vanta/dist/vanta.cells.min'
import { Link } from 'react-router-dom';
// import logo from '../../assets/trippy-coin2.jpg';
import shroom from '../../assets/shroom.jpg';
import TokenUtils from '../../modules/tokenUtils';
import { FaDiscord } from "react-icons/fa";
import Countdown from '../../components/App/CountDown';

const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network"
}

interface ShroomBalanceResponse {
    balance: number | string; // Use string if the balance might exceed JavaScript's safe integer limit
}

const PreSaleInfo = () => {

    const [vantaEffect, setVantaEffect] = useState(null)
    const myRef = useRef(null)

    const wallet = "inj1yegzy0u8z8k0mzcq6532nzk8eg2z9yyuppqxgk"
    const shroomAddress = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"

    const [balance, setBalance] = useState(0)
    const [goal] = useState(2800)

    const [shroomBalance, setShroomBalance] = useState(0)


    useEffect(() => {
        if (!vantaEffect) {
            setVantaEffect(CELLS({
                el: myRef.current,
                scale: 1.00,
                color1: 0x2a400,
                color2: 0xa7800,
                size: 1.10,
                speed: 1.40
            }))
        }

    }, [vantaEffect])

    const getBalance = useCallback(() => {
        const module = new TokenUtils(MAIN_NET);

        module.getBalanceOfToken('inj', wallet).then(r => {
            console.log(r)
            setBalance(Number(r.amount) / Math.pow(10, 18));
        }).catch((e: unknown) => {
            console.log(e);
        });

        module.queryTokenForBalance(shroomAddress, wallet).then((r: ShroomBalanceResponse) => {
            if (r.balance) {
                setShroomBalance((Number(r.balance)) / Math.pow(10, 18))
            }
        }).catch(e => {
            console.log(e);
        });


    }, [wallet]); // Include wallet here if it's expected to change

    useEffect(() => {
        getBalance(); // Initial call

        const interval = setInterval(() => {
            getBalance(); // This will be called every 10 seconds
        }, 10000);

        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, [getBalance]);

    const divStyle = {
        position: 'relative',
        width: '100%',
        paddingBottom: '5%',
    };

    const iframeStyle = {
        width: 1000,
        height: 480,
        border: 0,
    };


    return <div ref={myRef} className='overflow-hidden'>
        <div>
            <div className='text-center pt-8 text-4xl md:text-5xl font-bold '>
                TRIPPY
            </div>
            <div className='text-center text-xl md:text-3xl '>
                on injective
            </div>
            <div className='flex flex-row justify-center'>
                <div className='mt-2 text-center py-2 text-2xl md:text-4xl md:w-1/2 rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black mx-2'>
                    <div className='flex flex-row items-center justify-center mb-5 '>
                        <div className='text-base md:text-xl flex flex-col'>
                            <div className=''>
                                pre sale wallet:
                            </div>
                            <div className='font-bold hover:underline'>
                                <a href={`https://explorer.injective.network/account/${wallet}`}>
                                    {wallet}
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full dark:bg-gray-700 mb-1">
                        <div
                            className="bg-blue-500 text-base font-bold text-blue-100 text-center p-0.5 leading-none rounded-l-full rainbow-background"
                            style={{ width: `${(balance / goal) * 100}%` }} // Dynamically update this value based on your progress state
                        > {((balance / goal) * 100).toFixed(0)}%
                        </div>
                    </div>
                    <div className='text-center font-bold text-base'>
                        {balance.toFixed(2)} INJ / {goal} INJ raised
                    </div>
                    <div className='text-center font-bold text-base'>
                        <a href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl'>
                            {shroomBalance.toFixed(0)} shroooms eaten 🍄
                        </a>
                    </div>
                    <div className='text-center w-full text-lg'>
                        <Countdown targetUtcTime='2024-04-15T20:00:00Z' />
                    </div>
                    <div>
                        <Link
                            to="/trippy-distribution"
                            className='text-sm md:text-lg hover:cursor-pointer hover:underline hover:text-xl mr-10'
                        >
                            view $TRIPPY distribution
                        </Link>
                    </div>
                    <div className='text-center mt-5 text-xl md:text-3xl font-bold flex flex-row justify-center items-center'>
                        <FaDiscord className='mr-5 text-5xl' /> <a className='hover:underline' href='https://discord.gg/zH2xDWDy'>https://discord.gg/zH2xDWDy</a>
                    </div>
                    <div className='text-center text-sm'>join the discord community and get trippy to access inj-sniper and sei-sniper bots that log new pairs and liquidity</div>
                    <div className='text-center mt-5 text-2xl md:text-3xl font-bold'>
                        supply: 1,000,000,000
                        <br />
                        max cap 2800 $INJ
                        <br />
                        max per wallet: 50 $INJ
                        <br />
                        min per wallet: 0.1 $INJ
                    </div>
                    <div className='text-center pt-5 text-xl md:text-3xl font-bold'>
                        50 % LP (500,000,000)
                        <br />
                        49.5 % pre sale airdrop (495,000,000)
                        <br />
                        0.5 % dev fund / giveaways (5,000,000)
                        <br />
                    </div>
                </div>
            </div>
            <div className='flex flex-row justify-center'>
                <div className='mt-3 text-center py-5 text-2xl md:text-5xl md:w-1/2  m-auto rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black mx-2'>
                    <div className='flex flex-row items-center justify-between'>
                        <img src={shroom} style={{ borderRadius: '50%', width: 60, height: 60 }} className="animate-3dspin" alt="Spinning Image" />
                        <a
                            className='hover:cursor-pointer hover:text-6xl'
                            href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl'
                        >
                            SHROOM multiplier
                        </a>

                        <img src={shroom} style={{ borderRadius: '50%', width: 60, height: 60 }} className="animate-3dspin" alt="Spinning Image" />
                    </div>

                    <div className='text-xs md:text-sm mx-10 mb-2'>
                        shroom was the test launch token. to reward early supporters, a multiplier is available when sending in shroom with your inj for trippy. the more shrooms you eat, the more trippy you get !
                    </div>

                    <div className='text-xl md: text-3xl'>
                        send up to <span className='font-bold text-2xl md:text-3xl'>10,000,000 SHROOM</span> tokens <br /> with your $INJ to get a <span className='font-bold text-3xl md:text-4xl'>1.25x</span> multiplier on your allocation
                    </div>
                    <div className='text-lg my-5'>🍄🔥 all shrooms sent in will be burned🔥 🍄</div>
                    <div className='flex flex-row justify-center'>
                        <Link
                            to="/token-holders"
                            className='text-sm md:text-lg hover:cursor-pointer hover:text-xl mr-10'
                        >
                            view $SHROOM holder distribution
                        </Link>
                        <a
                            className='text-sm md:text-lg hover:cursor-pointer hover:text-xl'
                            href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl'
                        >
                            buy $SHROOM
                        </a>
                    </div>

                </div>
            </div>


            <div
                id="dexscreener-embed"
                // @ts-ignore
                style={divStyle}
                className='mt-2 flex justify-center flex-row mx-2'
            >
                <iframe
                    src="https://dexscreener.com/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl?embed=1&theme=dark&trades=0"
                    style={iframeStyle}
                    title="dexscreener-embed"
                ></iframe>
            </div>
        </div>

    </div>
};

export default PreSaleInfo;
