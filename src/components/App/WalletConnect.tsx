import useWalletStore from "../../store/useWalletStore";
import Button from "./Button";


const WalletConnect = () => {
  const { connectedWallet, setShowWallets, showWallets } = useWalletStore();

  const formattedAddress = `${connectedWallet.slice(
    0,
    5
  )}...${connectedWallet.slice(-5)}`;

  function handleConnectWallet() {
    setShowWallets(!showWallets)
  }

  return (
    <Button onClick={handleConnectWallet}>
      {connectedWallet ? formattedAddress : "Connect Wallet"}
    </Button>
  );
};

export default WalletConnect;
