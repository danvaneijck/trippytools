import { getAddresses, walletStrategy } from "../utils/walletStrategy";
import { toast } from "react-toastify";
import { getInjectiveAddress } from '@injectivelabs/sdk-ts'
import useWalletStore from "../store/useWalletStore";

const getEthereum = () => {
  if (!window.ethereum) {
    throw new Error('Metamask extension not installed')
  }

  return window.ethereum
}

export function useWalletConnect() {
  const {
    connectedWallet,
    setConnectedWallet,
    showWallets,
    setShowWallets,
    setSelectedWalletType
  } = useWalletStore();

  async function connect(wallet: "keplr" | "leap" | "metamask" | "phantom"): Promise<void> {
    console.log("Connecting to wallet:", wallet);
    walletStrategy.setWallet(wallet);
    setSelectedWalletType(wallet);
    walletStrategy.setWallet(wallet);
    try {
      let addresses: string[] = await getAddresses();
      console.log("Fetched addresses:", addresses);
      if (addresses && addresses.length > 0) {
        if (wallet == "metamask" || wallet == "phantom") {
          const ethereum = getEthereum()
          addresses = await ethereum.request({
            method: 'eth_requestAccounts',
          })
          addresses = addresses.map(getInjectiveAddress)
        }
        setConnectedWallet(addresses[0]);
        console.log("Wallet set to:", addresses[0]);
      } else {
        console.error("No addresses found for wallet:", wallet);
      }
    } catch (error) {
      toast.error(error.message, {
        autoClose: 5000,
        theme: "dark"
      });
      setShowWallets(!showWallets);
      console.error("Failed to connect to wallet:", error);
    }
  }

  function disconnect() {
    setConnectedWallet(null);
    setSelectedWalletType(null);
  }

  async function handleKeplrClick(): Promise<void> {
    if (connectedWallet) {
      disconnect();
    } else {
      await connect("keplr");
      setShowWallets(!showWallets);
    }
  }

  async function handleLeapClick(): Promise<void> {
    if (connectedWallet) {
      disconnect();
    } else {
      await connect("leap");
      setShowWallets(!showWallets);
    }
  }

  async function handleMetamaskClick(): Promise<void> {
    if (connectedWallet) {
      disconnect();
    } else {
      await connect("metamask");
      setShowWallets(!showWallets);
    }
  }

  async function handlePhantomClick(): Promise<void> {
    if (connectedWallet) {
      disconnect();
    } else {
      await connect("phantom");
      setShowWallets(!showWallets);
    }
  }

  return { connectedWallet, handleKeplrClick, handleLeapClick, handleMetamaskClick, handlePhantomClick, disconnect };
}

