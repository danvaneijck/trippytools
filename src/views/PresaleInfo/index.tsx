import { useRef, useEffect, useState, useCallback } from 'react';


import { Link } from 'react-router-dom';
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

    const wallet = "inj1yegzy0u8z8k0mzcq6532nzk8eg2z9yyuppqxgk"
    const shroomAddress = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"

    const [balance, setBalance] = useState(0)
    const [goal] = useState(1000)
    const [injPrice, setInjPrice] = useState(0);

    const [shroomBalance, setShroomBalance] = useState(0)


    const getBalance = useCallback(() => {
        const module = new TokenUtils(MAIN_NET);

        module.getINJPrice().then(r => {
            console.log(r)
            if (r) setInjPrice(r)
        }).catch(e => {
            console.log(e)
        })

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


    }, [wallet]);

    useEffect(() => {
        getBalance();

        const interval = setInterval(() => {
            getBalance();
        }, 10000);

        return () => clearInterval(interval);
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


    return <div className='overflow-hidden'>
        <header className="bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
            <div className="container mx-auto flex items-center p-2 text-sm md:text-base">
                {/* <Link to="/trippy-distribution" className="font-bold hover:underline mr-5">
                    $TRIPPY distribution
                </Link> */}
                <Link to="/token-holders" className="font-bold hover:underline mr-5">
                    holders tool
                </Link>
                <Link to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="font-bold hover:underline ">
                    liquidity tool
                </Link>
            </div>
        </header>
        <div>
            <div className='text-center pt-14 text-4xl md:text-5xl font-bold '>
                TRIPPY
            </div>
            <div className='text-center text-xl md:text-3xl '>
                on injective
            </div>
            <div className='flex-grow'>
                <div className='flex justify-center'>
                    <div className='mt-2 text-center py-4 text-2xl md:text-4xl md:w-1/2 rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black mx-2'>
                        <div className='flex flex-row items-center justify-center mb-2 '>
                            <div className='text-base md:text-xl flex flex-col'>
                                <div className=''>
                                    pre sale wallet:
                                </div>
                                <div className='text-sm md:text-lg font-bold hover:underline'>
                                    <a href={`https://explorer.injective.network/account/${wallet}`}>
                                        {wallet}
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div className='text-center text-lg md:text-2xl mb-2'>
                            ${(balance * injPrice).toFixed(2)} USD
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


                        <div className='text-center w-full text-2xl'>
                            <Countdown targetUtcTime='2024-04-19T20:00:00Z' />
                        </div>
                        <div className='text-center  text-base mt-2 mx-5'>
                            If max cap is not hit OR unique wallets are not over 100, all INJ and SHROOM will be refunded.
                            Otherwise, all airdrops will be completed and liquidity added on 4:20pm April 20th UTC 😎
                        </div>
                        <div className='flex flex-row items-center justify-center mt-2'>
                            <Link
                                to="/trippy-distribution"
                                className='text-sm md:text-lg hover:cursor-pointer hover:underline hover:text-xl mr-10'
                            >
                                view $TRIPPY distribution
                            </Link>
                            {/* <img
                                src={logo}
                                style={{ borderRadius: "50%", width: 20, height: 20 }}
                                className=""
                                alt="Spinning Image"
                            /> */}
                        </div>
                        <div className='text-center mt-5 text-xl md:text-3xl font-bold flex flex-row justify-center items-center'>
                            <FaDiscord className='mr-5 text-5xl' /> <a className='hover:underline' href='https://discord.gg/Nnz34jzA5T'>https://discord.gg/Nnz34jzA5T</a>
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
            </div>
            <div className='flex flex-row justify-center'>
                <div className='mt-3 text-center py-5 text-2xl md:text-4xl md:w-1/2  m-auto rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black mx-2'>
                    <div className='flex flex-row items-center justify-between'>
                        <img src={shroom} style={{ borderRadius: '50%', width: 40, height: 40 }} className="animate-3dspin" alt="Spinning Image" />
                        <a
                            className='hover:cursor-pointer hover:text-4xl'
                            href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl'
                        >
                            SHROOM multiplier
                        </a>

                        <img src={shroom} style={{ borderRadius: '50%', width: 40, height: 40 }} className="animate-3dspin" alt="Spinning Image" />
                    </div>

                    <div className='text-xs md:text-sm mx-2 mt-2 mb-2'>
                        shroom was the test launch token. to reward early supporters, a multiplier is available when sending in shroom with your inj for trippy. the more shrooms you eat, the more trippy you get !
                    </div>

                    <div className='text-xl md: text-3xl'>
                        send up to <span className='font-bold text-2xl md:text-3xl'>10,000,000 SHROOM</span> tokens <br /> with your $INJ to get a <span className='font-bold text-3xl md:text-4xl'>1.25x</span> multiplier on your allocation
                    </div>
                    <div className='text-sm my-5'>🍄🔥 all shrooms sent in will be burned🔥 🍄</div>
                    <div className='flex flex-row justify-center'>
                        <Link
                            to="/token-holders?address=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
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
