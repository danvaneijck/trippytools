import { Link } from 'react-router-dom';
import shroom from "../../assets/shroom.jpg"
import { FaDiscord, FaTelegram, FaTwitter } from 'react-icons/fa';
import Footer from '../../components/App/Footer';
import { FaArrowRight } from "react-icons/fa";

const Home = () => {

    const divStyle = {
        position: 'relative',
        width: '100%',
        paddingBottom: '5%',
    };

    const iframeStyle = {
        width: 1000,
        height: 500,
        border: 0,
    };

    return <div className='overflow-hidden min-h-screen text-stone-100 bg-customGray font-magic'>
        <div className='flex-grow'>
            <div className='flex justify-center'>
                <div className="pt-20 md:pt-44 pb-20 flex flex-col justify-center items-start text-left py-4 lg:w-3/4 mx-3 text-white">
                    <div className='flex flex-col md:flex-row items-center'>
                        <img src={shroom} className='rounded-full w-[150px] md:w-[300px] lg:w-[400px]' />
                        <div className='md:ml-5 lg:ml-20'>
                            <div
                                className='mt-5 md:mt-0 text-xl md:text-3xl text-left'
                            >
                                Get trippy with
                            </div>
                            <div
                                className='font-magic text-5xl md:text-8xl text-left'
                            >
                                $SHROOM
                            </div>
                            <div className='flex flex-row justify-start space-x-5 mb-2 text-2xl'>
                                <a
                                    className='hover:text-trippyYellow'
                                    href='https://x.com/trippy_inj'
                                >
                                    <FaTwitter />
                                </a>
                                <a
                                    className='hover:text-trippyYellow'
                                    href='https://discord.gg/Nnz34jzA5T'
                                >
                                    <FaDiscord />
                                </a>
                                <a
                                    className='hover:text-trippyYellow'
                                    href='https://t.me/trippinj'
                                >
                                    <FaTelegram />
                                </a>
                            </div>
                            <div
                                className='text-base font-sans text-sm'
                            >
                                SHROOM is a meme coin on the Injective blockchain with two liquidity pools on Mito Finance and DojoSwap. It's designed for more than just fun - SHROOM allows users to pay for completing airdrops to communities such as token holders, NFT collectors, proposal voters, Mito vault stakers, and custom CSV airdrop uploads.
                                <br />
                                <br />
                                The accompanying web tool offers insights into token holders and liquidity providers on DojoSwap and Stroport, highlighting whether liquidity is burned. With its strong integration into Injective’s DeFi ecosystem, SHROOM is a practical tool for managing airdrops and liquidity in a transparent and efficient way.
                            </div>
                            <div
                                className='flex flex-row mt-5'
                            >
                                <a
                                    href='https://coinhall.org/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl'
                                    className='flex items-center justify-center border-2 border-white px-3 py-2 rounded-lg w-full text-center text-lg hover:cursor-pointer hover:font-semibold'
                                >
                                    Trade on Coinhall
                                </a>
                                <a
                                    href='https://helixapp.com/spot/?marketId=0xc6b6d6627aeed8b9c29810163bed47d25c695d51a2aa8599fc5e39b2d88ef934'
                                    className='flex items-center justify-center border-2 border-white px-3 py-2 rounded-lg  ml-5 w-full text-center text-lg hover:cursor-pointer hover:font-semibold'
                                >
                                    Trade on Helix
                                </a>
                            </div>
                            <a
                                href='https://mito.fi/vault/inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp/'
                                className='mt-5 text-center flex flex-row justify-center items-center w-full text-lg hover:cursor-pointer hover:font-semibold'
                            >
                                <div>View Mito finance vault</div>
                                <FaArrowRight className='ml-5' />
                            </a>
                        </div>
                    </div>
                    <div
                        className='flex flex-row justify-center w-full mt-5 space-x-5'
                    >
                        <Link
                            to={'/airdrop'}
                            className='flex items-center justify-center border-2 border-white px-3 py-2 rounded-lg w-full text-center text-lg hover:cursor-pointer hover:font-semibold '
                        >
                            <div
                            >
                                Plan Airdrops
                            </div>
                        </Link>

                        <Link
                            to={'/pre-sale-tool'}
                            className='flex items-center justify-center border-2 border-white px-3 py-2 rounded-lg w-full text-center text-lg hover:cursor-pointer hover:font-semibold'
                        >
                            <div
                            >
                                Plan Presale
                            </div>
                        </Link>
                        <Link
                            to={'/manage-tokens'}
                            className='flex items-center justify-center border-2 border-white px-3 py-2 rounded-lg w-full text-center text-lg hover:cursor-pointer hover:font-semibold'
                        >
                            <div
                            >
                                Manage native tokens
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>

        <div
            id="dexscreener-embed"
            style={divStyle}
            className='mt-2 flex justify-center flex-row bg-black pt-10'
        >
            <iframe
                src="https://dexscreener.com/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl?embed=1&theme=dark&trades=0"
                style={iframeStyle}
                title="dexscreener-embed"
            ></iframe>
        </div>
        <Footer />
    </div>
};

export default Home;
