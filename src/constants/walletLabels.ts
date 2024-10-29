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

const drugsPurge = "inj1rcrw7gt2sv342p49zzqq7p68cwhjsxc90emh5y"
const galactic = "inj1xzvnt0j22mlzngvgr7vq8ku9mxk4qy30pgjhnf"
const galacticMining = "inj1q044fvkkglqqm6wz0sxut2dfn0srqjzw0kulm5"
const drugsDAO = "inj1q2f3dxy064vyqnvvzszwpgkv8aglzgz36jazu7"


const quntTreasury1 = "inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64"
const quntTreasury2 = "inj1dcgukyg6hj4zqerm02a4vfsgl0h8nd3ywmzce3"
const quntTreasury3 = "inj1rlyp66l2macpfqer2tg57a6alvgv7ydvrlfwrh"

const illu = "inj1q82fmsgee627wh2w2rthy6eqt2jst9wc3tytz4"


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
    },
    [drugsPurge]: {
        label: "DRUGS Purge Wallet",
        bgColor: "",
        textColor: "text-green-500"
    },
    [galactic]: {
        label: "Galactic Syndicate",
        bgColor: "",
        textColor: "text-green-500"
    },
    [galacticMining]: {
        label: "Galactic Mining Club",
        bgColor: "",
        textColor: "text-green-500"
    },
    [drugsDAO]: {
        label: "DRUGS on INJ DAO",
        bgColor: "",
        textColor: "text-green-500"
    },
    [quntTreasury1]: {
        label: "PRMR treasury 1",
        bgColor: "",
        textColor: "text-green-500",
        treasury: true
    },
    [quntTreasury2]: {
        label: "PRMR treasury 2",
        bgColor: "",
        textColor: "text-green-500",
        treasury: true
    },
    [quntTreasury3]: {
        label: "PRMR treasury 3",
        bgColor: "",
        textColor: "text-green-500",
        treasury: true
    },
    [illu]: {
        label: "@illustriousPRMR",
        bgColor: "",
        textColor: "text-green-500"
    }
}