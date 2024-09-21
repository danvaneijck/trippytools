import { LIQUIDITY_POOLS } from "./contractAddresses";

const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";
const trippykiwiAddress = "inj1lq9wn94d49tt7gc834cxkm0j5kwlwu4gm65lhe"
const rugLord = "inj1nsqdlh065qveeqkeh64lhap3hm40ptrt8t2unw"
const shroomMarketingWallet = "inj1pr5lyuez8ak94tpuz9fs7dkpst7pkc9uuhfhvm"
const talisMarketPlace = "inj1l9nh9wv24fktjvclc4zgrgyzees7rwdtx45f54"
const stakedSporeLP = "inj164pyppndppdmazfjrvecajnwcs3hmq06agn4ka"
const benanceDev = "inj12j0xu6yxufrphl3av5ksjygtpg204h534yxc70"
const injCw20Adapter = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
const mirza = "inj1pem9tjvql4zjy32hlp30epz77x5sjuy6qcrck2"
const eric = "inj1mf54qzss29pyk450lkdpa2rqpn38hzcexfpyac"
const mito = "inj14vnmw2wee3xtrsqfvpcqg35jg9v7j2vdpzx0kk"

export const WALLET_LABELS = {
    ...LIQUIDITY_POOLS.reduce((acc, pool) => {
        acc[pool.value] = {
            label: pool.label + " LP",
            bgColor: "",
            textColor: "text-blue-500" 
        };
        return acc;
    }, {}),
    [rugLord]: {
        label: "rugger",
        bgColor: "",
        textColor: "text-red-500"
    },
    [dojoBurnAddress]: {
        label: "DOJO BURN ADDY 🔥",
        bgColor: "",
        textColor: "text-red-500"
    },
    [injBurnAddress]: {
        label: "INJ BURN ADDY 🔥",
        bgColor: "",
        textColor: "text-red-500"
    },
    [trippykiwiAddress]: {
        label: "trippykiwi 🥷",
        bgColor: "",
        textColor: "text-green-500"
    },
    [shroomMarketingWallet]: {
        label: "shroom admin",
        bgColor: "",
        textColor: "text-green-500"
    },
    [talisMarketPlace]: {
        label: "Talis Marketplace",
        bgColor: "",
        textColor: "text-green-500"
    },
    [stakedSporeLP]: {
        label: "astroport generator 🧑‍🌾",
        bgColor: "",
        textColor: "text-yellow-500"
    },
    [benanceDev]: {
        label: "BENANCE dev",
        bgColor: "",
        textColor: "text-yellow-500"
    },
    [injCw20Adapter]: {
        label: "INJ cw20 adapter",
        bgColor: "",
        textColor: "text-green-500"
    },
    [mirza]: {
        label: "@TheMirza",
        bgColor: "",
        textColor: "text-green-500"
    },
    [eric]: {
        label: "@ericinjective",
        bgColor: "",
        textColor: "text-green-500"
    },
    [mito]: {
        label: "Mito Finance",
        bgColor: "",
        textColor: "text-green-500"
    }
}