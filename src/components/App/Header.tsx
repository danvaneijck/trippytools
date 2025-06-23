import { useState } from 'react';
import { Link, useLocation } from "react-router-dom";
import ConnectKeplr from "./ConnectKeplr";
import logo from '../../assets/trippy_blue_yellow.svg';
import { FiMenu, FiX } from 'react-icons/fi'; // Import icons for burger and close

const Header = () => {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const getLinkStyle = (path) => {
        return location.pathname === path
            ? 'font-bold mx-5 pb-1 border-b-2 border-rose-400 text-trippyYellow'
            : 'font-bold mx-5 pb-1 hover:underline';
    };

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    return (
        <>
            {/* Full Header: hidden on small screens */}
            <header className="hidden lg:flex flex-row bg-customGray text-white shadow-lg fixed top-0 left-0 right-0 z-10 h-16 items-center">
                <div className="flex items-center p-2 text-xs md:text-sm">
                    <Link to="/" className={getLinkStyle('/')}>
                        $SHROOM
                    </Link>
                    <Link to="/shroom-hub" className={getLinkStyle('/shroom-hub')}>
                        Info
                    </Link>
                    <Link to="/token-holders" className={getLinkStyle('/token-holders')}>
                        Holders
                    </Link>
                    <Link to="/token-liquidity?address=inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5" className={getLinkStyle('/token-liquidity')}>
                        Liquidity
                    </Link>
                    <Link to="/manage-tokens" className={getLinkStyle('/manage-tokens')}>
                        Tokens
                    </Link>
                    <Link to="/airdrop" className={getLinkStyle('/airdrop')}>
                        Airdrops
                    </Link>
                    <Link to="/pre-sale-tool" className={getLinkStyle('/pre-sale-tool')}>
                        Presale
                    </Link>
                </div>

                <div className="hidden xl:flex flex-col absolute left-1/2 transform -translate-x-1/2 text-center">
                    <img src={logo} alt="My SVG" width={95} className='pt-1' />
                    <div className='text-base text-trippyYellow font-magic'>
                        TOKEN TOOLS
                    </div>
                </div>

                <div className="m-2 ml-auto flex items-center">
                    <ConnectKeplr />
                </div>
            </header>

            {/* Burger Menu for smaller screens */}
            <header className="flex flex-row bg-customGray text-white shadow-lg fixed top-0 left-0 right-0 z-10 h-16 items-center ">
                <div className="flex items-center p-2">
                    {/* Burger Icon */}
                    <button onClick={toggleMenu} className="text-white focus:outline-none">
                        {menuOpen ? <FiX size={24} /> : <FiMenu size={24} className='' />}
                    </button>
                </div>

                <div className='hidden md:inline-block'>
                    <Link to="/" className={getLinkStyle('/')}>
                        $SHROOM
                    </Link>
                    <Link to="/shroom-hub" className={getLinkStyle('/shroom-hub')}>
                        Info
                    </Link>
                </div>

                <div className="hidden sm:flex flex-col absolute left-1/2 transform -translate-x-1/2 text-center">
                    <img src={logo} alt="My SVG" width={80} />
                    <div className='text-sm text-trippyYellow font-magic'>
                        TOKEN TOOLS
                    </div>
                </div>
                <div className="m-2 ml-auto flex items-center">
                    <ConnectKeplr />
                </div>
            </header>

            {/* Slide-out Side Menu */}
            <div
                className={`fixed top-0 left-0 w-64 h-full bg-customGray text-white shadow-lg z-20 transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}
            >
                <div className="flex flex-col p-4 space-y-4">
                    <div className='m-auto mb-5'>
                        <img src={logo} alt="My SVG" width={100} className='' />
                        <div className='text-sm text-trippyYellow font-magic text-center'>
                            TOKEN TOOLS
                        </div>
                    </div>

                    <Link to="/" className={getLinkStyle('/')} onClick={toggleMenu}>
                        $SHROOM
                    </Link>
                    <Link to="/shroom-hub" className={getLinkStyle('/shroom-hub')} onClick={toggleMenu}>
                        Info
                    </Link>
                    <Link to="/token-holders" className={getLinkStyle('/token-holders')} onClick={toggleMenu}>
                        Holder tool
                    </Link>
                    <Link to="/token-liquidity?address=inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5" className={getLinkStyle('/token-liquidity')} onClick={toggleMenu}>
                        Liquidity tool
                    </Link>
                    <Link to="/token-launch" className={getLinkStyle('/token-launch')} onClick={toggleMenu}>
                        Create token
                    </Link>
                    <Link to="/manage-tokens" className={getLinkStyle('/manage-tokens')} onClick={toggleMenu}>
                        Mange tokens
                    </Link>
                    <Link to="/airdrop" className={getLinkStyle('/airdrop')} onClick={toggleMenu}>
                        Perform Airdrops
                    </Link>
                    <Link to="/pre-sale-tool" className={getLinkStyle('/pre-sale-tool')} onClick={toggleMenu}>
                        Plan Presale
                    </Link>
                    <Link to="/market-make" className={getLinkStyle('/market-make')} onClick={toggleMenu}>
                        Mito Market Make
                    </Link>
                    <Link to="/dojo-whitelist" className={getLinkStyle('/dojo-whitelist')} onClick={toggleMenu}>
                        Dojo Whitelist
                    </Link>
                    <Link to="/wallet-export" className={getLinkStyle('/wallet-export')} onClick={toggleMenu}>
                        Wallet Export (beta)
                    </Link>
                    <Link to="/qunt-unwrap" className={getLinkStyle('/qunt-unwrap')} onClick={toggleMenu}>
                        QUNT unwrap
                    </Link>
                </div>
            </div>

            {/* Overlay for closing menu */}
            {menuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-10"
                    onClick={toggleMenu}
                />
            )}
        </>
    );
};

export default Header;
