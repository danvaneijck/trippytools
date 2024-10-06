import { useRef, useEffect, useState } from 'react';
import WAVES from 'vanta/dist/vanta.waves.min'
import { Link } from 'react-router-dom';
import ConnectKeplr from '../../components/App/ConnectKeplr';
import shroom from "../../assets/shroom.jpg"
import { FaDiscord, FaTelegram } from 'react-icons/fa';
import { FaVault } from "react-icons/fa6";
import { PiParachute } from 'react-icons/pi';
import Footer from '../../components/App/Footer';
import { GiPayMoney } from "react-icons/gi";
import { FaArrowRight } from "react-icons/fa";

const Home = () => {

    const [vantaEffect, setVantaEffect] = useState(null)
    const myRef = useRef(null)

    useEffect(() => {
        if (!vantaEffect) {
            setVantaEffect(WAVES({
                el: myRef.current,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0xf14,
                shininess: 25.00,
                waveHeight: 19.50,
                waveSpeed: 0.55,
                zoom: 0.65
            }))
        }

    }, [vantaEffect])

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

    return <div ref={myRef} className='overflow-hidden min-h-screen pb-20 text-stone-100'>
        <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
            <div className="container mx-auto flex items-center p-2 text-xs md:text-sm">
                <Link to="/token-holders" className="font-bold hover:underline mx-5">
                    holder tool
                </Link>
                <Link to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl" className="font-bold hover:underline mr-5">
                    liquidity tool
                </Link>
                <Link to="/manage-tokens" className="font-bold hover:underline ">
                    manage tokens
                </Link>
            </div>
            <div className="m-2">
                <ConnectKeplr />
            </div>
        </header>
        <div className='font-magic'>
            <div className='text-center pt-16 text-3xl md:text-4xl font-magic'>
                TRIPPY token tools
            </div>
            <div className='text-center text-base md:text-2xl '>
                on Injective
            </div>

            <div className='flex-grow'>
                <div className='flex justify-center'>
                    <div className='mt-2 text-center py-4  md:w-1/2 rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black mx-2'>
                        {/* <div className='text-xl md:text-2xl'>built for the community</div> */}

                        <a href='https://discord.gg/Nnz34jzA5T' >
                            <div className='flex flex-row mt-2 text-xl items-center justify-center  w-auto rounded-lg hover:font-bold'>
                                <FaDiscord className='mr-2 text-3xl' />
                                Join the discord
                            </div>
                        </a>
                        <a href='https://t.me/trippinj' >
                            <div className='flex flex-row mt-2 text-xl items-center justify-center  w-auto rounded-lg hover:font-bold'>
                                <FaTelegram className='mr-2 text-3xl' />
                                Join the telegram
                            </div>
                        </a>
                        <Link to="/token-holders">
                            <div className='mt-5 text-xl hover:font-bold flex flex-row justify-center items-center'>
                                Query token holders
                                <FaArrowRight className='ml-2 text-xl' />
                            </div>
                        </Link>
                        <Link to="/token-liquidity">
                            <div className='mt-2 text-xl hover:font-bold flex flex-row justify-center items-center'>
                                Query Astroport and DojoSwap liquidity holders
                                <FaArrowRight className='ml-2 text-xl' />
                            </div>
                        </Link>
                        <Link to="/manage-tokens">
                            <div className='mt-2 text-xl hover:font-bold flex flex-row justify-center items-center'>
                                Create and manage token factory tokens
                                <FaArrowRight className='ml-2 text-xl' />
                            </div>
                        </Link>
                        <Link to="/airdrop">
                            <div className='mt-4 text-xl hover:font-bold bg-slate-800 p-2 md:w-1/2 mx-auto rounded-lg flex flex-row items-center justify-center'>
                                <PiParachute className="mr-2 text-2xl" />  Plan Airdrop <PiParachute className="ml-2 text-2xl" />
                            </div>
                        </Link>
                        <Link to="/pre-sale-tool">
                            <div className='mt-4 text-xl hover:font-bold bg-slate-800 p-2 md:w-1/2 mx-auto rounded-lg flex flex-row items-center justify-center'>
                                <GiPayMoney className="mr-2 text-2xl" />  Plan Pre Sale <GiPayMoney className="ml-2 text-2xl" />
                            </div>
                        </Link>
                        <a href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl' >
                            <div className='flex flex-row mt-5 text-lg items-center justify-center px-2 w-auto rounded-lg hover:font-bold'>
                                <img src={shroom} style={{ borderRadius: '50%', width: 40, height: 40 }} className="animate-3dspin mr-2" alt="Spinning Image" />
                                Trade SHROOM on Coinhall
                            </div>
                        </a>
                        <a href='https://helixapp.com/spot/?marketId=0xc6b6d6627aeed8b9c29810163bed47d25c695d51a2aa8599fc5e39b2d88ef934' >
                            <div className='flex flex-row mt-5 text-lg items-center justify-center px-2 w-auto rounded-lg hover:font-bold'>
                                <img src={shroom} style={{ borderRadius: '50%', width: 40, height: 40 }} className="animate-3dspin mr-2" alt="Spinning Image" />
                                Trade SHROOM on Helix
                            </div>
                        </a>
                        <a href='https://mito.fi/vault/inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp/' >
                            <div className='flex flex-row mt-5 text-lg items-center justify-center px-2 w-auto rounded-lg hover:font-bold'>
                                <FaVault className='mr-2' />
                                View SHROOM Mito finance vault
                            </div>
                        </a>
                    </div>
                </div>
            </div>

            <div
                id="dexscreener-embed"
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
        <Footer />
    </div>
};

export default Home;
