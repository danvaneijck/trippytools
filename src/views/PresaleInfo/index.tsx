import { useRef, useEffect, useState } from 'react';
// @ts-ignore
import CELLS from 'vanta/dist/vanta.cells.min'
import { Link } from 'react-router-dom';
import logo from '../../assets/trippy-coin2.jpg';
import shroom from '../../assets/shroom.jpg';

import Countdown from '../../components/App/CountDown';

const PreSaleInfo = () => {

    const [vantaEffect, setVantaEffect] = useState(null)
    const myRef = useRef(null)

    useEffect(() => {
        if (!vantaEffect) {
            setVantaEffect(CELLS({
                el: myRef.current,
                scale: 1.00,
                color1: 0x1c6ad9,
                color2: 0x4ddc00,
                size: 3.00,
                speed: 0.40
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


    return <div ref={myRef} className='overflow-hidden'>
        <div>
            <div className='text-center pt-8 text-4xl md:text-5xl font-bold '>
                TRIPPY
            </div>
            <div className='text-center text-xl md:text-3xl '>
                on injective
            </div>
            <div className='mt-2 text-center py-2 text-2xl md:text-4xl md:w-1/3 m-auto rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black flex flex-row items-center justify-between'>
                <img src={logo} style={{ borderRadius: '50%', width: 100, height: 100 }} className="animate-3dspin" alt="Spinning Image" />
                <div className='mx-5'><Countdown targetUtcTime={'2024-04-08T20:00:00Z'} /></div>
                <img src={logo} style={{ borderRadius: '50%', width: 100, height: 100 }} className="animate-3dspin" alt="Spinning Image" />
            </div>
            <div className='text-center  text-2xl md:text-3xl font-bold'>
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

            <div className='mt-2 text-center py-5 text-2xl md:text-5xl md:w-1/2  m-auto rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black'>
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
            <div
                id="dexscreener-embed"
                // @ts-ignore
                style={divStyle}
                className='flex justify-center flex-row mx-2'
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
