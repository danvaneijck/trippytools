/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Button from "./Button";
import { useWalletStore } from "../../store/wallet";


const WalletConnect = () => {
  const { injectiveAddress, connectWallet } = useWalletStore();

  const formattedAddress = `${injectiveAddress.slice(
    0,
    5
  )}...${injectiveAddress.slice(-5)}`;

  function handleConnectWallet() {
    connectWallet().catch(() => alert("Error"));
  }
  return (
    <Button onClick={handleConnectWallet}>
      {injectiveAddress ? formattedAddress : "Connect Wallet"}
    </Button>
  );
};

export default WalletConnect;
