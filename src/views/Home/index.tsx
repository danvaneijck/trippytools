import { useRef, useEffect, useState } from 'react';
import WAVES from 'vanta/dist/vanta.waves.min'
import { Link } from 'react-router-dom';
import ConnectKeplr from '../../components/App/ConnectKeplr';
import shroom from "../../assets/shroom.jpg"
import { FaDiscord, FaTelegram } from 'react-icons/fa';
import { GiFarmer } from 'react-icons/gi';
import myceliumLogo from "../../assets/mycelium.jpeg"
import spore from "../../assets/spore.webp"

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

    return <div ref={myRef} className='overflow-hidden min-h-screen pb-20'>
        <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
            <div className="container mx-auto flex items-center p-2 text-sm md:text-sm">
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
        <div className=''>
            <div className='text-center pt-20 text-2xl md:text-3xl font-bold '>
                TRIPPY token tools
            </div>
            <div className='text-center text-base md:text-xl '>
                on injective
            </div>

            <div className='flex-grow'>
                <div className='flex justify-center'>
                    <div className='mt-2 text-center py-4  md:w-1/2 rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black mx-2'>
                        <div className='text-xl md:text-2xl'>Building tools for the community</div>

                        <a href='https://discord.gg/Nnz34jzA5T' >
                            <div className='flex flex-row mt-2 text-sm items-center justify-center  w-auto rounded-lg hover:font-bold'>
                                <FaDiscord className='mr-2 text-3xl' />
                                Join the discord
                            </div>
                        </a>
                        <a href='https://t.me/trippinj' >
                            <div className='flex flex-row mt-2 text-sm items-center justify-center  w-auto rounded-lg hover:font-bold'>
                                <FaTelegram className='mr-2 text-3xl' />
                                Join the telegram
                            </div>
                        </a>
                        <Link to="/token-holders">
                            <div className='mt-5 text-sm hover:font-bold'>
                                Query token holders
                            </div>
                        </Link>
                        <Link to="/token-liquidity">
                            <div className='mt-2 text-sm hover:font-bold'>
                                Query Astroport and DojoSwap liquidity holders
                            </div>
                        </Link>
                        <Link to="/manage-tokens">
                            <div className='mt-2 text-sm hover:font-bold'>
                                Create and airdrop token factory tokens
                            </div>
                        </Link>
                        <Link to="/mycelium-farm" className='flex flex-row justify-center items-center mt-5'>
                            <GiFarmer className='text-2xl' />
                            <div className='mt-2 text-sm hover:font-bold ml-2'>
                                Farm mycelium with spore / SHROOM LP
                            </div>
                            <img src={myceliumLogo} style={{ borderRadius: '50%', width: 30 }} className="animate-3dspin ml-2" alt="Spinning Image" />

                        </Link>
                        <a href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl' >
                            <div className='flex flex-row mt-5 text-sm items-center justify-center p-2 w-auto rounded-lg hover:font-bold'>
                                <img src={shroom} style={{ borderRadius: '50%', width: 40, height: 40 }} className="animate-3dspin mr-2" alt="Spinning Image" />
                                Trade shroom on Coinhall
                            </div>
                        </a>
                        <a href='https://coinhall.org/injective/inj1rusfnzgtcvkn8z92h9hyvzuna60tc0x0yy74tf' >
                            <div className='flex flex-row text-sm items-center justify-center p-2 w-auto rounded-lg  hover:font-bold'>
                                <img src={spore} style={{ borderRadius: '50%', width: 40, height: 40 }} className="animate-3dspin mr-2" alt="Spinning Image" />
                                Trade spore on Coinhall
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
        <footer className="bg-gray-800 text-white text-xs p-4 fixed bottom-0 left-0 right-0 z-10">
            buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
        </footer>
    </div>
};

export default Home;
