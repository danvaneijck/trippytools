import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import leapLogo from '../../assets/leap-dark.svg';
import keplrLogo from '../../assets/keplr.png'
import metamask from '../../assets/metamask.svg'
import phantom from '../../assets/phantom.svg'

import useWalletStore from "../../store/useWalletStore";
import { useWalletConnect } from "../WalletConnect";

// Styled after the SHROOM launchpad wallet picker: portal + blur backdrop, a
// scale-in card centered with top/left 50% + translate(-50%,-50%) (the old
// modal mixed flex-centering with a stray -translate-x-1/2, which shoved it
// off-screen left on mobile), responsive width, and the trippyYellow accent.
export default function WalletSelectModal() {
  const { showWallets, setShowWallets } = useWalletStore()
  const { handleKeplrClick, handleLeapClick, handleMetamaskClick, handlePhantomClick } = useWalletConnect()

  // ESC to close + lock body scroll while the modal is open.
  useEffect(() => {
    if (!showWallets) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowWallets(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showWallets, setShowWallets]);

  if (!showWallets) return null

  const wallets = [
    { key: "keplr", label: "Keplr Wallet", sub: "Cosmos", logo: keplrLogo, onClick: () => { void handleKeplrClick(); } },
    { key: "leap", label: "Leap Wallet", sub: "Cosmos", logo: leapLogo, onClick: () => { void handleLeapClick(); } },
    { key: "metamask", label: "Metamask", sub: "EVM", logo: metamask, onClick: () => { void handleMetamaskClick(); } },
    { key: "phantom", label: "Phantom", sub: "EVM", logo: phantom, onClick: () => { void handlePhantomClick(); } },
  ]

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
      <div
        onClick={() => setShowWallets(false)}
        className="fixed inset-0 z-100 bg-[rgba(8,6,12,0.65)] backdrop-blur-md modal-backdrop-fade"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transform: "translate(-50%, -50%)" }}
        className="fixed left-1/2 top-1/2 z-101 modal-pop w-[min(460px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0F0F0F] p-5 sm:p-6 text-white shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
      >
        <button
          type="button"
          onClick={() => setShowWallets(false)}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[#191919] text-gray-400 transition duration-200 hover:border-trippyYellow hover:bg-trippyYellow hover:text-black"
        >
          ✕
        </button>

        <h2 id="wallet-modal-title" className="font-magic text-xl font-bold tracking-tight">
          Connect Wallet
        </h2>
        <p className="mt-1.5 mb-5 text-xs text-gray-400">
          Choose a wallet to connect to Injective.
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {wallets.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={w.onClick}
              className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/2 p-3 text-left transition duration-150 hover:border-trippyYellow hover:bg-trippyYellow/10"
            >
              <img src={w.logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{w.label}</div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-gray-500">{w.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-3 text-center text-[11px] text-gray-500">
          <Link
            to="https://medium.com/@ChoiceExchange/set-up-an-injective-wallet-3ef43f359f76"
            className="text-trippyYellow underline underline-offset-2 hover:opacity-80"
          >
            How to create an Injective wallet?
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}
