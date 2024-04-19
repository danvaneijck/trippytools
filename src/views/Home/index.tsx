import { useRef, useEffect, useState } from 'react';
// @ts-ignore
// import CELLS from 'vanta/dist/vanta.cells.min'
import WAVES from 'vanta/dist/vanta.waves.min'
import { Link } from 'react-router-dom';

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

    return <div ref={myRef} className='overflow-hidden h-screen'>
        <header className="bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
            <div className="container mx-auto flex items-center p-2 text-sm md:text-base">
                <Link to="/trippy-distribution" className="font-bold hover:underline mr-5">
                    $TRIPPY distribution
                </Link>
                <Link to="/token-holders" className="font-bold hover:underline mr-5">
                    holders tool
                </Link>
                <Link to="/token-liquidity" className="font-bold hover:underline ">
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
                    Building tools for the community 
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

export default Home;
