// Helpers for Injective's native-EVM (MultiVM) integration.
//
// A tokenfactory denom can be paired with an auto-deployed ERC-20 via the
// erc20 module's MsgCreateTokenPair. Submitting it with an empty erc20_address
// asks the chain to deploy a `MintBurnBankERC20` mirroring the bank denom and
// register the pair (proven in choice's chain-capability harness + used by the
// SHROOM keeper). The auto-deploy is an inner MsgEthereumTx, so the outer tx
// needs a generous explicit gas limit — auto-simulation under-provisions it.

import { getEthereumAddress } from "@injectivelabs/sdk-ts";
import { MsgCreateTokenPair } from "./msgCreateTokenPair";

// Matches a checksummed-or-not 0x EVM address.
export const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Gas limit for any tx that auto-deploys a paired ERC-20. EVM contract
// creation is the dominant cost; this is well above what the deploy needs and
// is cheap on Injective. Tune here if the chain ever rejects it.
export const PAIR_ERC20_GAS = 8_000_000;

export type NetworkKey = "mainnet" | "testnet";

/** Base URL for the Injective EVM (Blockscout) explorer. */
export const evmExplorerBase = (network: NetworkKey): string =>
    network === "testnet"
        ? "https://testnet.blockscout.injective.network"
        : "https://blockscout.injective.network";

/** Explorer link for an ERC-20 / EVM address. */
export const evmAddressUrl = (network: NetworkKey, address: string): string =>
    `${evmExplorerBase(network)}/address/${address}`;

/**
 * The EVM (0x) form of an Injective bech32 account. On Injective an `inj1…`
 * address and its `0x…` form are the SAME account, so this lets the holder
 * tools show/link a holder on the EVM explorer. Returns null for inputs that
 * aren't convertible (e.g. an NFT token id rather than a wallet).
 */
export const injToEvm = (injAddress: string): string | null => {
    try {
        return getEthereumAddress(injAddress);
    } catch {
        return null;
    }
};

/**
 * Build the MsgCreateTokenPair that pairs `denom` with a freshly auto-deployed
 * ERC-20. Leaving `erc20Address` empty is what triggers the chain-side deploy.
 */
export const buildCreateTokenPairMsg = (sender: string, denom: string) =>
    MsgCreateTokenPair.fromJSON({
        injectiveAddress: sender,
        bankDenom: denom,
        erc20Address: "",
    });
