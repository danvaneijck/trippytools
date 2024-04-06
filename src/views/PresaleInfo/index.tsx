import { useRef, useEffect, useState } from 'react';
// @ts-ignore
import CELLS from 'vanta/dist/vanta.cells.min'
import { Link } from 'react-router-dom';

const PreSaleInfo = () => {

    const [vantaEffect, setVantaEffect] = useState(null)
    const myRef = useRef(null)

    useEffect(() => {
        if (!vantaEffect) {
            setVantaEffect(CELLS({
                el: myRef.current,
                scale: 1.00,
                color1: 0x10af,
                color2: 0xa0034c,
                size: 5.00,
                speed: 0.40
            }))
        }

    }, [vantaEffect])

    const divStyle = {
        position: 'relative',
        width: '100%',
        paddingBottom: '25%',
    };

    const iframeStyle = {
        width: 1000,
        height: 480,
        border: 0,
    };

    return <div ref={myRef} className=''>
        <div>
            <div className='text-center pt-8 text-5xl font-bold '>
                $TRIPPY Pre Sale
            </div>
            <div className='text-center text-3xl '>
                on injective
            </div>
            <div className='mt-2 text-center py-2 text-4xl w-1/5 m-auto rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-white'>
                date to be announced
            </div>
            <div className='text-center  text-3xl font-bold'>
                supply: 1,000,000,000
                <br />
                max cap 2500 $INJ
                <br />
                max per wallet: 50 $INJ
                <br />
                min per wallet: 0.1 $INJ
            </div>
            <div className='text-center pt-5 text-3xl font-bold'>
                50 % LP (500,000,000)
                <br />
                49.5 % pre sale airdrop (495,000,000)
                <br />
                0.5 % dev fund / giveaways (5,000,000)
                <br />
            </div>

            <div className='mt-2 text-center py-5 text-5xl w-1/3 m-auto rounded-xl p-2 mb-2 bg-gradient-to-br from-transparent to-black'>
                <a
                    className='hover:cursor-pointer hover:text-6xl'
                    href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl'
                >
                    $SHROOM
                </a> multiplier 🔥
                <div className='text-xl'>
                    the more shrooms you eat, the more trippy you get
                </div>
                <div className='text-3xl'>
                    send up to <span className='font-bold text-4xl'>10,000,000 $SHROOM</span> tokens <br /> with your $INJ to get a <span className='font-bold text-5xl'>1.25x</span> multiplier on your allocation
                </div>
                <div className='text-lg'>all shrooms sent in will be burned</div>
                <div className='flex flex-row justify-center'>
                    <Link
                        to="/token-holders"
                        className='text-lg hover:cursor-pointer hover:text-xl mr-10'
                    >
                        view $SHROOM holder distribution
                    </Link>
                    <a
                        className=' text-lg hover:cursor-pointer hover:text-xl'
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
                className='flex justify-center flex-row'
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
