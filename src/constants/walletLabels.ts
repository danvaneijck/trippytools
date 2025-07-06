import useLiquidityPoolStore from "../store/usePoolStore";

const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";
const trippykiwiAddress = "inj1lq9wn94d49tt7gc834cxkm0j5kwlwu4gm65lhe";
const rugLord = "inj1nsqdlh065qveeqkeh64lhap3hm40ptrt8t2unw";
const shroomMarketingWallet = "inj1pr5lyuez8ak94tpuz9fs7dkpst7pkc9uuhfhvm";
const talisMarketPlace = "inj1l9nh9wv24fktjvclc4zgrgyzees7rwdtx45f54";
const stakedSporeLP = "inj164pyppndppdmazfjrvecajnwcs3hmq06agn4ka";
const benanceDev = "inj12j0xu6yxufrphl3av5ksjygtpg204h534yxc70";
const injCw20Adapter = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk";
const mirza = "inj1pem9tjvql4zjy32hlp30epz77x5sjuy6qcrck2";
const eric = "inj1mf54qzss29pyk450lkdpa2rqpn38hzcexfpyac";
const mito = "inj14vnmw2wee3xtrsqfvpcqg35jg9v7j2vdpzx0kk";

const drugsPurge = "inj1rcrw7gt2sv342p49zzqq7p68cwhjsxc90emh5y";
const galactic = "inj1xzvnt0j22mlzngvgr7vq8ku9mxk4qy30pgjhnf";
const galacticMining = "inj1q044fvkkglqqm6wz0sxut2dfn0srqjzw0kulm5";
const drugsDAO = "inj1q2f3dxy064vyqnvvzszwpgkv8aglzgz36jazu7";

const quntTreasury1 = "inj127l5a2wmkyvucxdlupqyac3y0v6wqfhq03ka64";
const quntTreasury2 = "inj1rlyp66l2macpfqer2tg57a6alvgv7ydvrlfwrh";
const quntTreasury3 = "inj14lt3ksa9kzy3zadxej8xtf2apwp0w33v5g7vcu";

const quntMarketing = "inj1dcgukyg6hj4zqerm02a4vfsgl0h8nd3ywmzce3";
const quntBuybacks = "inj1fj6syxy0wmvqhr3n57hwrljxwsng3k55t3yxgj";

const illu = "inj1q82fmsgee627wh2w2rthy6eqt2jst9wc3tytz4";

const pedroMain = "inj1x6u08aa3plhk3utjk7wpyjkurtwnwp6dhudh0j";
const pedroVault = "inj1y43urcm8w0vzj74ys6pwl422qtd0a278hqchw8";

const shroomiAgent = "inj1ne0h7cz6zh0743xfx93g9qpzmm3ylyy5rsduka";

const dojoDerf = "inj18xg2xfhv36v4z7dr3ldqnm43fzukqgsafyyg63";
const smellyDonation = "inj1ld69wuvevtfyc6dd9hy4l9a70rp6z0vpqevv83";

const LIQUIDITY_POOLS = useLiquidityPoolStore.getState().pools.map((p) => {
    return {
        value: p.contract_addr,
        label: `${p.asset_1.symbol}/${p.asset_2.symbol} (${p.dex.name})`,
        img: p.asset_1.icon,
    };
});

export const WALLET_LABELS = {
    ...LIQUIDITY_POOLS.reduce((acc, pool) => {
        acc[pool.value] = {
            label: pool.label + " pool",
            bgColor: "",
            textColor: "text-blue-500",
        };
        return acc;
    }, {}),
    [rugLord]: {
        label: "rugger",
        bgColor: "",
        textColor: "text-red-500",
    },
    [dojoBurnAddress]: {
        label: "DOJO BURN ADDY 🔥",
        bgColor: "",
        textColor: "text-red-500",
    },
    [injBurnAddress]: {
        label: "INJ BURN ADDY 🔥",
        bgColor: "",
        textColor: "text-red-500",
    },
    [trippykiwiAddress]: {
        label: "trippykiwi 🥷",
        bgColor: "",
        textColor: "text-green-500",
    },
    [shroomMarketingWallet]: {
        label: "shroom admin",
        bgColor: "",
        textColor: "text-green-500",
    },
    [talisMarketPlace]: {
        label: "Talis Marketplace",
        bgColor: "",
        textColor: "text-green-500",
    },
    [stakedSporeLP]: {
        label: "astroport generator 🧑‍🌾",
        bgColor: "",
        textColor: "text-yellow-500",
    },
    [benanceDev]: {
        label: "BENANCE dev",
        bgColor: "",
        textColor: "text-yellow-500",
    },
    [injCw20Adapter]: {
        label: "INJ cw20 adapter",
        bgColor: "",
        textColor: "text-green-500",
    },
    [mirza]: {
        label: "@TheMirza",
        bgColor: "",
        textColor: "text-green-500",
    },
    [eric]: {
        label: "@ericinjective",
        bgColor: "",
        textColor: "text-green-500",
    },
    [mito]: {
        label: "Mito Finance",
        bgColor: "",
        textColor: "text-green-500",
    },
    [drugsPurge]: {
        label: "DRUGS Purge Wallet",
        bgColor: "",
        textColor: "text-green-500",
    },
    [galactic]: {
        label: "Galactic Syndicate",
        bgColor: "",
        textColor: "text-green-500",
    },
    [galacticMining]: {
        label: "Galactic Mining Club",
        bgColor: "",
        textColor: "text-green-500",
    },
    [drugsDAO]: {
        label: "DRUGS on INJ DAO",
        bgColor: "",
        textColor: "text-green-500",
    },
    [quntTreasury1]: {
        label: "PRMR treasury 1",
        bgColor: "",
        textColor: "text-green-500",
        treasury: true,
    },
    [quntTreasury2]: {
        label: "PRMR treasury 2",
        bgColor: "",
        textColor: "text-green-500",
        treasury: true,
    },
    [quntTreasury3]: {
        label: "PRMR treasury 3",
        bgColor: "",
        textColor: "text-green-500",
        treasury: true,
    },
    [quntMarketing]: {
        label: "PRMR marketing",
        bgColor: "",
        textColor: "text-green-500",
    },
    [quntBuybacks]: {
        label: "QUNT buybacks",
        bgColor: "",
        textColor: "text-green-500",
    },
    [illu]: {
        label: "@illustriousPRMR",
        bgColor: "",
        textColor: "text-green-500",
    },
    [pedroMain]: {
        label: "Pedro Main",
        bgColor: "",
        textColor: "text-yellow-500",
    },
    [pedroVault]: {
        label: "Pedro Vault",
        bgColor: "",
        textColor: "text-yellow-500",
    },
    [shroomiAgent]: {
        label: "Shroomi AI Agent 👻",
        bgColor: "",
        textColor: "text-green-500",
    },
    [dojoDerf]: {
        label: "Dojo DERF",
        bgColor: "",
        textColor: "text-yellow-500",
    },
    [smellyDonation]: {
        label: "Smelly Donations",
        bgColor: "",
        textColor: "text-yellow-500",
    },
};
