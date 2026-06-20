// Vendored `MsgCreateTokenPair` message.
//
// `@injectivelabs/sdk-ts@1.20.17` (the latest published) ships the erc20 query
// API (ChainGrpcErc20Api) and the proto, but does NOT export the high-level
// `MsgCreateTokenPair` *class* at runtime — only a `type Erc20Msgs` alias. So
// we reconstruct it here on top of the proto from `core-proto-ts-v2`, mirroring
// the exact method surface every SDK `MsgBase` subclass provides so it works
// with the wallet `MsgBroadcaster` across Keplr/Leap (direct sign) and
// MetaMask/Phantom (EIP712 v1 + v2).
//
// Drop this file if a future SDK exports the class.

import { MsgCreateTokenPair as MsgCreateTokenPairProto } from "@injectivelabs/core-proto-ts-v2/generated/injective/erc20/v1beta1/tx_pb";
import { TokenPair as TokenPairProto } from "@injectivelabs/core-proto-ts-v2/generated/injective/erc20/v1beta1/erc20_pb";

const TYPE_URL = "/injective.erc20.v1beta1.MsgCreateTokenPair";
const AMINO_TYPE = "erc20/MsgCreateTokenPair";

export interface MsgCreateTokenPairParams {
    injectiveAddress: string;
    bankDenom: string;
    // Empty string → the chain auto-deploys a MintBurnBankERC20 and registers
    // the pair. Provide an address to pair with an existing ERC-20 instead.
    erc20Address?: string;
}

export class MsgCreateTokenPair {
    params: MsgCreateTokenPairParams;

    constructor(params: MsgCreateTokenPairParams) {
        this.params = params;
    }

    static fromJSON(params: MsgCreateTokenPairParams): MsgCreateTokenPair {
        return new MsgCreateTokenPair(params);
    }

    toProto() {
        const { injectiveAddress, bankDenom, erc20Address } = this.params;
        return MsgCreateTokenPairProto.create({
            sender: injectiveAddress,
            tokenPair: TokenPairProto.create({
                bankDenom,
                erc20Address: erc20Address ?? "",
            }),
        });
    }

    toData() {
        return { "@type": TYPE_URL, ...this.toProto() };
    }

    toAmino() {
        const { injectiveAddress, bankDenom, erc20Address } = this.params;
        return {
            type: AMINO_TYPE,
            value: {
                sender: injectiveAddress,
                token_pair: {
                    bank_denom: bankDenom,
                    erc20_address: erc20Address ?? "",
                },
            },
        };
    }

    toWeb3Gw() {
        const { value } = this.toAmino();
        return { "@type": TYPE_URL, ...value };
    }

    // Deprecated alias kept for parity with MsgBase.
    toWeb3() {
        return this.toWeb3Gw();
    }

    // EIP712 v1 values + types. The type map is what the SDK's generic
    // `objectKeysToEip712Types` produces for this message: `token_pair`
    // (snakeToPascal "TokenPair", parent "MsgValue") resolves to "TypeTokenPair".
    toEip712() {
        return this.toAmino();
    }

    toEip712Types(): Map<string, { name: string; type: string }[]> {
        // Insertion order mirrors the SDK exactly: nested types are set before
        // the primary `MsgValue` (verified byte-identical against the SDK's
        // objectKeysToEip712Types).
        return new Map([
            ["TypeTokenPair", [
                { name: "bank_denom", type: "string" },
                { name: "erc20_address", type: "string" },
            ]],
            ["MsgValue", [
                { name: "sender", type: "string" },
                { name: "token_pair", type: "TypeTokenPair" },
            ]],
        ]);
    }

    // EIP712 v2 values (the SDK derives types itself from this).
    toEip712V2() {
        return this.toWeb3Gw();
    }

    toDirectSign() {
        return { type: TYPE_URL, message: this.toProto() };
    }

    toDirectSignJSON() {
        return JSON.stringify(this.toDirectSign());
    }

    toJSON() {
        return JSON.stringify(this.toData());
    }

    toBinary(): Uint8Array {
        return MsgCreateTokenPairProto.toBinary(this.toProto());
    }
}
