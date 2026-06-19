import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import Footer from "../../components/App/Footer";
import { humanReadableAmount } from "../../utils/helpers";
import { SiConvertio } from "react-icons/si";
import ConvertModal from "./ConvertModal";
import { MsgExecuteContractCompat } from "@injectivelabs/sdk-ts";
import { INJ_DENOM } from "@injectivelabs/utils";
import { gql, useQuery } from "@apollo/client";
import { toast, ToastContainer } from "react-toastify";
import { Link } from "react-router-dom";
import choice from "../../assets/choice.svg"
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";

const HOLDER_QUERY = gql`
query getTokenHolders($address: String!, $addresses: [String!], $balanceMin: float8) {
  token_info:token_tracker_token_by_pk(address: $address){
    address
    name
    symbol
    total_supply
    circulating_supply
    decimals
    holders_last_updated
    holders_query_progress
    holders_save_progress
  }
  holders: wallet_tracker_balance(where: {token_id: {_in: $addresses}, balance: { _gt: $balanceMin }}, order_by: {balance:desc}) {
    wallet_id
    balance
    percentage_held
    token_id
    id
  }
  holder_aggregate: wallet_tracker_balance_aggregate(
    where: {
      token_id: { _in: $addresses }
      balance: { _gt: 0 } 
    }
  ) {
    aggregate {
      count
    }
  }
}
`

const SHROOM_TOKEN_ADDRESS = "inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
const CW20_ADAPTER = "inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk"
const SHROOM_BANK_DENOM = `factory/${CW20_ADAPTER}/${SHROOM_TOKEN_ADDRESS}`
const SHROOM_PAIR_ADDRESS = "inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
const SHROOM_CHOICE_PAIR_ADDRESS = "inj1uyjjnykz0slq0w4n6k2xgleykqk9k5qkfctmw5"

const MITO_VAULT_ADDRESS = "inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp"

const ShroomHub = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [shroomPrice, setShroomPrice] = useState(0)
    const [cw20Balance, setCw20Balance] = useState(0)
    const [bankBalance, setBankBalance] = useState(0)

    const [totalSupply, setTotalSupply] = useState(0)
    const [marketCap, setMarketCap] = useState(0)
    const [mitoLiquidity, setMitoLiquidity] = useState(0)
    const [dojoLiquidity, setDojoLiquidity] = useState(0)
    const [choiceLiquidity, setChoiceLiquidity] = useState(0)

    const [numHolders, setNumHolders] = useState(0)
    const [burnedAmount, setBurnedAmount] = useState(0)

    const [convertModal, setConvertModal] = useState(false)


    const { data } = useQuery(HOLDER_QUERY, {
        fetchPolicy: "network-only",
        pollInterval: 60000,
        variables: {
            address: SHROOM_TOKEN_ADDRESS,
            addresses: [
                SHROOM_TOKEN_ADDRESS,
                SHROOM_BANK_DENOM
            ],
            balanceMin: 0,
        }
    });

    useEffect(() => {
        if (!data) return;

        const dojoBurnAddress = "inj1wu0cs0zl38pfss54df6t7hq82k3lgmcdex2uwn";
        const injBurnAddress = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49";

        const BURN_ADDRESSES = [
            dojoBurnAddress,
            injBurnAddress,
            SHROOM_TOKEN_ADDRESS
        ]

        const balances = data.holders;

        const groupedByWallet = balances.reduce((acc, holder) => {
            if (!acc[holder.wallet_id]) {
                acc[holder.wallet_id] = {
                    cw20Balance: 0,
                    bankBalance: 0,
                    totalBalance: 0,
                    hasBothTokens: false,
                    wallet_id: holder.wallet_id
                };
            }
            const isFactoryToken = holder.token_id.includes("factory");
            const balanceValue = parseFloat(holder.balance);
            if (isFactoryToken) {
                acc[holder.wallet_id].bankBalance += balanceValue; // Accumulate bankBalance
            } else {
                acc[holder.wallet_id].cw20Balance += balanceValue; // Accumulate cw20Balance
            }
            if (acc[holder.wallet_id].cw20Balance > 0 && acc[holder.wallet_id].bankBalance > 0) {
                acc[holder.wallet_id].hasBothTokens = true;
            }
            return acc;
        }, {});

        let totalSupply = Object.values(groupedByWallet).reduce((sum, holder) => {
            if (holder.wallet_id === CW20_ADAPTER) {
                return sum + 0;
            }
            return sum + (holder.cw20Balance + holder.bankBalance);

        }, 0);

        totalSupply = Math.round(totalSupply)

        setTotalSupply(totalSupply)

        const finalHolderList = Object.entries(groupedByWallet).map(([wallet_id, holder]) => {
            return {
                address: wallet_id,
                balance: holder.cw20Balance + holder.bankBalance,
                percentageHeld: (holder.cw20Balance + holder.bankBalance) / totalSupply * 100,
                cw20Balance: holder.cw20Balance ? holder.cw20Balance : 0,
                bankBalance: holder.bankBalance ? holder.bankBalance : 0,
            };
        }).filter(x => x.balance !== 0).sort((a, b) => b.balance - a.balance)

        setNumHolders(finalHolderList.length);

        const totalBurnedBalance = finalHolderList
            .filter(addressObj => BURN_ADDRESSES.includes(addressObj.address))
            .reduce((total, addressObj) => {
                return total + addressObj.balance;
            }, 0);

        setBurnedAmount(totalBurnedBalance)
    }, [data]);

    useEffect(() => {
        if (shroomPrice && totalSupply) {
            setMarketCap(shroomPrice * (totalSupply - burnedAmount))
        }
    }, [shroomPrice, totalSupply, burnedAmount])

    const loadLiquidity = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        const mitoVault = await module.fetchMitoVault(MITO_VAULT_ADDRESS)

        if (mitoVault) {
            setMitoLiquidity(mitoVault.currentTvl)
        }

        const [baseAssetPrice, pairInfo, poolAmountsDojo, poolAmountsChoice] = await Promise.all([
            module.getINJPrice(),
            module.getPairInfo(SHROOM_PAIR_ADDRESS),
            module.getPoolAmounts(SHROOM_PAIR_ADDRESS),
            module.getPoolAmounts(SHROOM_CHOICE_PAIR_ADDRESS)
        ]);

        const baseAssetAmountDojo = poolAmountsDojo.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === INJ_DENOM;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === INJ_DENOM;
            }
            return false;
        })?.amount || 0;

        const baseAssetAmountChoice = poolAmountsChoice.assets.find(asset => {
            if (asset.info.native_token) {
                return asset.info.native_token.denom === INJ_DENOM;
            } else if (asset.info.token) {
                return asset.info.token.contract_addr === INJ_DENOM;
            }
            return false;
        })?.amount || 0;

        const injAmountDojo = baseAssetAmountDojo / Math.pow(10, 18)
        const dojoLiquidity = injAmountDojo * baseAssetPrice
        setDojoLiquidity(dojoLiquidity * 2)

        const injAmountChoice = baseAssetAmountChoice / Math.pow(10, 18)
        const choiceLiquidity = injAmountChoice * baseAssetPrice
        setChoiceLiquidity(choiceLiquidity * 2)

        const quote = await module.getSellQuoteRouter(pairInfo, 1 + "0".repeat(18));
        const returnAmount = Number(quote.amount) / Math.pow(10, 18);
        const totalUsdValue = (returnAmount * baseAssetPrice);
        setShroomPrice(totalUsdValue);

    }, [networkConfig])

    const loadBalance = useCallback(async () => {
        const module = new TokenUtils(networkConfig)
        try {
            const [cw20Balance, bankBalance] = await Promise.all([
                module.queryTokenForBalance(SHROOM_TOKEN_ADDRESS, connectedAddress),
                module.getBalanceOfToken(SHROOM_BANK_DENOM, connectedAddress),
            ]);
            setCw20Balance(Number(cw20Balance.balance) / Math.pow(10, 18))
            setBankBalance(Number(bankBalance.amount) / Math.pow(10, 18))
            return
        } catch (error) {
            console.error('Failed to update balance and USD value:', error);
        }
    }, [connectedAddress, networkConfig])

    useEffect(() => {
        if (currentNetwork == "mainnet" && connectedAddress) {
            loadBalance().catch(e => console.error(e))
        }
        loadLiquidity().catch(e => console.error(e))
    }, [currentNetwork, networkConfig, connectedAddress, loadBalance, loadLiquidity])

    const convertToBank = useCallback(async (amount) => {
        const injectiveAddress = connectedAddress

        const module = new TokenUtils(networkConfig)
        const msg = module.constructCW20ToBankMsg(
            SHROOM_TOKEN_ADDRESS,
            amount,
            18,
            injectiveAddress
        )

        const result = await performTransaction(
            injectiveAddress,
            [msg]
        )

        const content = (
            <div>
                Converted {humanReadableAmount(amount)} CW20 SHROOM to bank
                <br />
                <a
                    href={`https://injscan.com/transaction/${result['txHash']}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 text-sm"
                >
                    View transaction on explorer
                </a>
            </div>
        );

        toast.success(content, {
            autoClose: 5000,
            theme: "dark"
        });

        setConvertModal(false)
        await loadBalance()
    }, [networkConfig, loadBalance, connectedAddress])

    const convertToCw20 = useCallback(async (amount) => {
        const injectiveAddress = connectedAddress

        const module = new TokenUtils(networkConfig)
        const msg = module.constructBankToCW20Msg(
            SHROOM_TOKEN_ADDRESS,
            amount,
            18,
            injectiveAddress
        )

        const result = await performTransaction(
            injectiveAddress,
            [msg]
        )

        const content = (
            <div>
                Converted {humanReadableAmount(amount)} bank SHROOM to CW20
                <br />
                <a
                    href={`https://injscan.com/transaction/${result['txHash']}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 text-sm"
                >
                    View transaction on explorer
                </a>
            </div>
        );

        toast.success(content, {
            autoClose: 5000,
            theme: "dark"
        });

        setConvertModal(false)
        await loadBalance()
    }, [connectedAddress, loadBalance, networkConfig])

    const sendMarketMake = useCallback(async () => {

        const injectiveAddress = connectedAddress

        const msgMarketMake = MsgExecuteContractCompat.fromJSON({
            sender: injectiveAddress,
            contractAddress: "inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp",
            msg: {
                market_make: {}
            },
        });

        const result = await performTransaction(
            injectiveAddress,
            [msgMarketMake]
        )

        const content = (
            <div>
                Successfully sent market make
                <br />
                <a
                    href={`https://injscan.com/transaction/${result['txHash']}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 text-sm"
                >
                    View transaction on explorer
                </a>
            </div>
        );

        toast.success(content, {
            autoClose: 5000,
            theme: "dark"
        });

        await loadBalance()
        await loadLiquidity()
    }, [loadLiquidity, loadBalance, connectedAddress])


    return (
        <>
            <ToastContainer />
            {convertModal &&
                <ConvertModal
                    bankBalance={bankBalance}
                    cw20Balance={cw20Balance}
                    onClose={() => setConvertModal(false)}
                    convertToBank={convertToBank}
                    convertToCW20={convertToCw20}
                />
            }

            <div className="flex flex-col min-h-screen pb-10 bg-customGray">
                <div className="pt-14 md:pt-24 mx-2 pb-20">
                    <div className="min-h-full mt-2 md:mt-0">
                        <div className="text-white text-center text-3xl font-magic mt-5 md:mt-0 flex items-center justify-center">
                            Shroom Stats
                            <img
                                className="w-10 rounded-full ml-2 h-10"
                                src={"https://wsrv.nl/?url=https%3A%2F%2Fbafybeibqpgy7vh5dtk7wawnjy7svmo3b6xinvog7znoe5jpklpkwaso63m.ipfs.w3s.link%2Fshroom.jpg&n=-1&w=64&h=64"}
                            />
                        </div>

                        {/** Token Stats */}
                        <div className="p-2 rounded-2xl shadow-md">
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-center">
                                <div className="bg-black/50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://dexscreener.com/injective/inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                                    >
                                        Price
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${shroomPrice.toFixed(6)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg">
                                    <div className="text-sm text-white">Market Cap</div>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(marketCap)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg">
                                    <div className="text-sm text-white">Total Liquidity</div>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(dojoLiquidity + mitoLiquidity + choiceLiquidity)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://mito.fi/vault/inj1g89dl74lyre9q6rjua9l37pcc7psnw66capurp/"
                                    >
                                        Mito Liquidity
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(mitoLiquidity)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://dojo.trading/swap?type=swap&from=inj&to=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8"
                                    >
                                        DojoSwap Liquidity
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(dojoLiquidity)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg">
                                    <a
                                        className="text-sm text-white hover:cursor-pointer"
                                        href="https://choice.exchange/swap?input=inj&output=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8&volumeSplitting=true"
                                    >
                                        Choice Liquidity
                                    </a>
                                    <div className="text-xl font-semibold text-trippyYellow">${humanReadableAmount(choiceLiquidity)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg col-span-1">
                                    <div className="text-sm text-white">Total Holders</div>
                                    <div className="text-xl font-semibold text-trippyYellow">{humanReadableAmount(numHolders)}</div>
                                </div>
                                <div className="bg-black/50 p-4 rounded-lg col-span-1">
                                    <div className="text-sm text-white">Tokens Burned</div>
                                    <div className="text-xl font-semibold text-trippyYellow">
                                        {humanReadableAmount(burnedAmount)} (${humanReadableAmount(burnedAmount * shroomPrice)})
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="m-auto text-center mt-5 text-2xl font-semibold">
                            <Link
                                className="text-center hover:underline flex justify-center"
                                to={'https://choice.exchange/swap?input=inj&output=inj1300xcg9naqy00fujsr9r8alwk7dh65uqu87xm8&volumeSplitting=true'}
                            >
                                Trade on Choice Exchange <img src={choice} className="w-6 ml-4" />
                            </Link>
                        </div>

                        {/** Balances */}
                        <div
                            className="bg-black/50 lg:w-1/2 m-auto p-4 rounded-lg mt-5"
                        >
                            <div className="text-center mb-2 text-lg font-bold text-ellipsis  overflow-hidden m-auto">
                                {connectedAddress !== null ? `${connectedAddress.slice(0, 8)}...${connectedAddress.slice(-8)}` : "Connect your wallet"}
                            </div>
                            <div
                                className="flex flex-row space-x-5 md:space-x-20 justify-center text-center items-center"
                            >
                                <div>
                                    <p className="font-bold text-lg">
                                        CW20 balance
                                    </p>
                                    <div>
                                        {humanReadableAmount(cw20Balance)} SHROOM
                                    </div>
                                    <div>
                                        {(cw20Balance * shroomPrice).toFixed(2)} USD
                                    </div>
                                </div>

                                <div
                                    onClick={() => setConvertModal(true)}
                                    className="text-center text-xs hover:cursor-pointer border px-5 py-1 rounded-lg transform transition duration-300 hover:scale-110"
                                >
                                    <SiConvertio
                                        size={30}
                                        className="m-auto"
                                    />
                                    <div className="mt-1">Convert</div>
                                </div>

                                <div>
                                    <p className="font-bold text-lg">
                                        Bank balance
                                    </p>
                                    <div>
                                        {humanReadableAmount(bankBalance)} SHROOM
                                    </div>
                                    <div>
                                        {(bankBalance * shroomPrice).toFixed(2)} USD
                                    </div>
                                </div>

                            </div>

                            <div className="text-center mt-2">
                                <p className="font-bold text-lg">
                                    Total balance
                                </p>
                                <div>
                                    {humanReadableAmount(bankBalance + cw20Balance)} SHROOM
                                </div>
                                <div>
                                    ${humanReadableAmount((cw20Balance + bankBalance) * shroomPrice)} USD
                                </div>
                            </div>
                            <div className="flex justify-center mt-5">
                                <button
                                    onClick={() => void sendMarketMake()}
                                    className="p-1 rounded-lg border"
                                >
                                    <div className="text-sm">
                                        Tighten mito orders
                                    </div>
                                </button>
                            </div>
                        </div>


                    </div>
                </div>
                <Footer />
            </div>
        </>

    );
}

export default ShroomHub