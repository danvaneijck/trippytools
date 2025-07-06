import { Link } from "react-router-dom";
import leapLogo from '../../assets/leap-dark.svg';
import keplrLogo from '../../assets/keplr.png'
import metamask from '../../assets/metamask.svg'
import phantom from '../../assets/phantom.svg'

import useWalletStore from "../../store/useWalletStore";
import { useWalletConnect } from "../WalletConnect";

export default function WalletSelectModal() {
  const { showWallets, setShowWallets } = useWalletStore()
  const { handleKeplrClick, handleLeapClick, handleMetamaskClick, handlePhantomClick } = useWalletConnect()

  const handleToggleWallets = () => {
    setShowWallets(!showWallets)
  }

  if (!showWallets) return null
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={handleToggleWallets}
      />
      <div className="bg-[#0F0F0F] rounded-lg shadow-lg  p-6  -translate-x-1/2 z-20 slide-in text-white w-[500px]">
        <div className='flex  justify-between mb-2'>
          <div>
            <h3 className=' font-montserrat text-xl font-semibold mb-2'>Connect Wallet</h3>
          </div>

          <button onClick={
            handleToggleWallets
          } className="bg-[#191919] w-8 h-8 flex items-center justify-center rounded-full shadow-md hover:shadow-[0_0_8px_3px_#f9d73f] 
               transition duration-300  ">
            <i className="fa-solid fa-x"></i>
          </button>
        </div>


        <div className='flex flex-col text-white gap-2 mb-10'>
          <div onClick={handleKeplrClick} className='flex border border-gray-600 rounded-md w-full p-4 gap-3 items-center cursor-pointer hover:border-trippyYellow'>
            <img src={keplrLogo} className='h-8 ' alt="" /><span>Keplr Wallet</span>
          </div>
          <div onClick={handleLeapClick} className='flex border border-gray-600 rounded-md w-full p-4 gap-3 items-center cursor-pointer hover:border-trippyYellow'>
            <img src={leapLogo} className='h-8 rounded' alt="" /><span>Leap Wallet</span>
          </div>
          <div onClick={handleMetamaskClick} className='flex border border-gray-600 rounded-md w-full p-4 gap-3 items-center cursor-pointer hover:border-trippyYellow'>
            <img src={metamask} className='h-8' alt="" /><span>Metamask Wallet</span>
          </div>
          <div onClick={handlePhantomClick} className='flex border border-gray-600 rounded-md w-full p-4 gap-3 items-center cursor-pointer hover:border-trippyYellow'>
            <img src={phantom} className='h-8 rounded' alt="" /><span>Phantom Wallet</span>
          </div>
        </div>


        <div className="w-100 text-center">
          <Link
            to={"https://medium.com/@ChoiceExchange/set-up-an-injective-wallet-3ef43f359f76"}
            // onClick={handleToggleWallets}
            className='text-white font-montserrat underline hover:opacity-80'>
            How to create an Injective wallet?
          </Link>
        </div>
      </div>
    </div>
  )
}
