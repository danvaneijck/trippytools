import { Network, getNetworkEndpoints } from "@injectivelabs/networks";
// import { MsgBroadcaster } from "@injectivelabs/wallet-ts";
// import { walletStrategy } from "./services/wallet";

export const NETWORK = Network.Mainnet;
export const ENDPOINTS = getNetworkEndpoints(NETWORK);
