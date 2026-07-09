// Bank-module *blocked* addresses on Injective mainnet — the x/auth module
// accounts. The bank keeper refuses to credit any of these ("… is not allowed
// to receive funds"), and that refusal fires during gas *simulation*, so a
// MsgMultiSend / CW20-transfer batch that contains one of them reverts before
// it's ever broadcast — silently stranding the other ~499 recipients in the
// same chunk.
//
// These addresses are derived deterministically from the module name
// (authtypes.NewModuleAddress) and never change, so hard-coding them is safe.
// The airdrop send loop *also* bisects any chunk that still fails, so an
// address missing from this list (a future module, an EVM precompile, …) only
// ever strands itself — this list just spares the common case the extra txs.
//
// Source: GET /cosmos/auth/v1beta1/module_accounts (mainnet), 2026-07-09.
export const BLOCKED_RECIPIENTS: ReadonlySet<string> = new Set([
    "inj1j4yzhgjm00ch3h0p9kel7g8sp6g045qf32pzlj", // auction
    "inj1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3lj7tt0", // bonded_tokens_pool
    "inj1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8dkncm8", // distribution
    "inj1glht96kr2rseywuvhhay894qw7ekuc4qqdy7m7", // erc20
    "inj1vqu8rska6swzdmnhf90zuv0xmelej4lq8mjsxs", // evm
    "inj14vnmw2wee3xtrsqfvpcqg35jg9v7j2vdpzx0kk", // exchange
    "inj17xpfvakm2amg962yls6f84z3kell8c5l6s5ye9", // fee_collector
    "inj176rcyfn5k9d0wcxel3kmwvxh0hy3xcwen9585u", // feeibc
    "inj10d07y265gmmuvt4z0w9aw880jnsr700jstypyt", // gov
    "inj1vn5fx74ud4cu7tf0pls9u5krxengsdzrg9ap2d", // insurance
    "inj1vlthgax23ca9syk7xgaz347xmf4nunefdppn7g", // interchainaccounts
    "inj1m3h30wlvsf8llruxtpukdvsy0km2kum8zcsu4c", // mint
    "inj1tygms3xhhs3yv487phx3dw4a95jn7t7ltjz6am", // not_bonded_tokens_pool
    "inj1979qcq0kdz72w0k9rsxcmfmagx2cydrs40q2xg", // peggy
    "inj1fl3um4qyagpfpwked5lpenvjj7wn8trr93jdku", // permissions
    "inj19ejy8n9qsectrf4semdp9cpknflld0j6hf2fle", // tokenfactory
    "inj1yl6hdjhmkf37639730gffanpzndzdpmhykpd9m", // transfer
    "inj1h3j5kq3efj96ga8gre6pxmp2qmfvs994clv2su", // txfees
    "inj1xds4f0m87ajl3a6az6s2enhxrd0wta4860twp8", // wasm
    "inj1z5ewmnfpa3at4j54pq6dh66rthrpkvhnxqadkf", // xwasm
]);

export function isBlockedRecipient(address: string): boolean {
    return BLOCKED_RECIPIENTS.has((address || "").trim());
}
