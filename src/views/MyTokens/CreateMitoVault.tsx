import {
    MsgExecuteContractCompat,
} from "@injectivelabs/sdk-ts";
import { useCallback, useEffect, useState } from "react";
import { Link } from 'react-router-dom';
import { CircleLoader } from "react-spinners";
import TokenUtils from "../../modules/tokenUtils";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";
import { performTransaction } from "../../utils/walletStrategy";


const CreateMitoVault = (props: {
    token: any
    setShowModal: (value: any) => void
    setLoaded: (value: any) => void
}) => {

    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const [vaultCreationFee, setVaultCreationFee] = useState<number | null>(null);
    const [notionalValueCap, setNotionalValueCap] = useState('1000000');

    const [injPrice, setInjPrice] = useState<string | number | undefined>(null as any);

    const [baseTokenAmount, setBaseTokenAmount] = useState<string | number>(500000);
    const [quoteTokenAmount, setQuoteTokenAmount] = useState<string | number>(300);

    const [vaultLink, setVaultLink] = useState<string | null>(null);

    const [progress, setProgress] = useState("")
    const [txLoading, setTxLoading] = useState(false)

    const [error, setError] = useState<string | null>(null)

    const getVaultFee = useCallback(async () => {
        console.log("get vault fee", props.token)
        const module = new TokenUtils(networkConfig);
        try {
            const fee = await module.fetchMitoVaultCreationFee();
            const inj = await module.getINJDerivativesPrice()
            setInjPrice(inj)
            return fee
        } catch (error) {
            console.error('Failed to fetch spot markets:', error);
            throw error;
        }
    }, [networkConfig, props.token]);

    useEffect(() => {
        const fetchData = async () => {
            if (!connectedAddress) return;
            if (vaultCreationFee) return

            try {
                const fee = await getVaultFee()
                setVaultCreationFee(fee)
            } catch (e) {
                if ((e as any).name !== 'AbortError') {
                    console.error("Failed to fetch tokens:", e);
                }
            }
        };

        void fetchData();
    }, [vaultCreationFee, getVaultFee, connectedAddress])

    const create = useCallback(async () => {
        console.log(props.token)
        setError(null)

        if (Number(quoteTokenAmount) < 20) {
            setError("Minimum 20 INJ starting liquidity")
            return
        }
        else {
            setError(null)
        }


        const injectiveAddress = connectedAddress;


        setError(null)


        const baseDecimals = props.token.metadata.decimals
        const quoteDecimals = 18; // INJ

        let mitoMasterContract: string
        let contractCode: number
        if (networkConfig.chainId.includes("888")) {
            mitoMasterContract = "inj174efvalr8d9muguudh9uyd7ah7zdukqs9w4adq"
            contractCode = 9212
        } else {
            mitoMasterContract = 'inj1vcqkkvqs7prqu70dpddfj7kqeqfdz5gg662qs3';
            contractCode = 540
        }

        const funds = [
            {
                denom: 'inj',
                amount: ((Number(quoteTokenAmount) + Number(vaultCreationFee)) * Math.pow(10, 18)).toLocaleString('fullwide', { useGrouping: false })
            },
            {
                denom: props.token.token,
                amount: (Number(baseTokenAmount) * Math.pow(10, baseDecimals)).toLocaleString('fullwide', { useGrouping: false })
            }
        ];

        const valueCap = (Number(notionalValueCap) * Math.pow(10, 18)).toLocaleString('fullwide', { useGrouping: false });

        const msgs = MsgExecuteContractCompat.fromJSON({
            contractAddress: mitoMasterContract,
            funds,
            exec: {
                action: 'register_vault',
                msg: {
                    is_subscribing_with_funds: true,
                    registration_mode: {
                        permissionless: {
                            whitelisted_vault_code_id: contractCode,
                        },
                    },
                    instantiate_vault_msg: {
                        Amm: {
                            owner: injectiveAddress,
                            master_address: mitoMasterContract,
                            notional_value_cap: valueCap,
                            market_id: props.token.marketId,
                            order_density: 35,
                            pricing_strategy: {
                                SmoothingPricingWithRelativePriceRange: {
                                    bid_range: '0.8',
                                    ask_range: '0.8',
                                },
                            },
                            max_invariant_sensitivity_bps: '5',
                            max_price_sensitivity_bps: '5',
                            fee_bps: 100,
                            order_type: 'Vanilla',
                            config_owner: injectiveAddress,
                            base_decimals: baseDecimals,
                            quote_decimals: quoteDecimals,
                        },
                    },
                },
            },
            sender: injectiveAddress as string,
        });

        console.log("create mito vault", msgs)

        const response = await performTransaction(injectiveAddress as string, [msgs])
        let address = ""
        const contract = response?.['events']?.find((x: any) => x.type === 'wasm-vault_instantiated')
        if (contract) {
            address = contract['attributes'].find((x: any) => x.key === "_contract_address").value
        }

        setProgress(`Done! Go back and refresh`)
        setVaultLink(`https://${currentNetwork == 'testnet' ? 'testnet.' : ''}mito.fi/vault/${address}`)
        // navigate('/manage-tokens');
    }, [props.token, quoteTokenAmount, networkConfig.chainId, connectedAddress, vaultCreationFee, baseTokenAmount, notionalValueCap, currentNetwork])

    return (
        <>
            <div
                className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-hidden focus:outline-hidden text-white text-sm"
            >
                <div className="relative w-auto my-4 mx-auto max-w-4xl">
                    <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-slate-800 outline-hidden focus:outline-hidden">
                        <div className="flex items-start justify-between p-4 border-b border-solid border-blueGray-900 rounded-t">
                            <h3 className="text-xl font-semibold">
                                Create Mito vault
                            </h3>
                        </div>
                        <div className="relative p-6 flex-auto">
                            <p className="mb-2">
                                Completing this action will create a Mito CCPM vault with default settings
                            </p>
                            <div className="flex flex-col md:flex-row">

                                <div>
                                    <div className="mb-2">Connected address: {connectedAddress && connectedAddress}</div>
                                    <div>Base denom: {props.token && props.token.token}</div>
                                    <div>Quote denom: INJ</div>
                                    <div>Helix market id: {props.token && props.token.marketId}</div>

                                    <div className="mt-4">
                                        <label
                                            className="block font-bold text-white"
                                        >
                                            Notional Value Cap
                                        </label>
                                        <span className="text-xs">
                                            the max cap of INJ for the vault
                                        </span>
                                        <input
                                            type="text"
                                            className="text-black w-full rounded-sm p-1 text-sm"
                                            onChange={(e) =>
                                                setNotionalValueCap(e.target.value)
                                            }
                                            value={notionalValueCap}
                                        />
                                    </div>
                                    <div className="mt-4 flex flex-row">
                                        <div className="pr-2">
                                            <label
                                                className="block font-bold text-white"
                                            >
                                                Base Token Amount
                                            </label>
                                            <input
                                                type="text"
                                                className="text-black w-full rounded-sm p-1 text-sm"
                                                onChange={(e) =>
                                                    setBaseTokenAmount(e.target.value)
                                                }
                                                value={baseTokenAmount}
                                            />
                                        </div>
                                        <div className="pl-2">
                                            <label
                                                className="block font-bold text-white"
                                            >
                                                Quote Token Amount (min 20 INJ)
                                            </label>
                                            <input
                                                type="text"
                                                className="text-black w-full rounded-sm p-1 text-sm"
                                                onChange={(e) =>
                                                    setQuoteTokenAmount(e.target.value)
                                                }
                                                value={quoteTokenAmount}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-5 text-base">
                                INJ price: <span className="font-bold">${injPrice}</span>
                            </div>
                            <div className="mt-5 text-base">
                                Starting price in INJ: <span className="font-bold text-xl">
                                    {(Number(quoteTokenAmount)) / Number(baseTokenAmount)} INJ
                                </span>
                            </div>
                            <div className="mt-2 text-base">
                                Token starting liquidity: <span className="font-bold text-xl">
                                    ${(Number(quoteTokenAmount) * Number(injPrice)) * 2} USD
                                </span>
                            </div>
                            <div className="mt-2 text-base">
                                Token starting price: <span className="font-bold text-xl">
                                    ${(Number(quoteTokenAmount) * Number(injPrice)) / Number(baseTokenAmount)} USD
                                </span>
                            </div>
                            <div className="mt-5 text-base">
                                Vault creation fee: <span className="font-bold text-xl">{vaultCreationFee} INJ</span>
                            </div>
                            <div className="mt-2 mb-2 text-base">
                                Total INJ required: <span className="font-bold text-xl">{(vaultCreationFee ?? 0) + Number(quoteTokenAmount)} INJ</span>
                            </div>
                            {vaultLink &&
                                <Link
                                    className="underline text-xl"
                                    target="_blank"
                                    to={vaultLink}
                                >
                                    Mito Vault Link
                                </Link>
                            }
                            {progress && <div className="mt-5 whitespace-pre">progress: {progress}</div>}
                            {txLoading && <CircleLoader color="#36d7b7" className="mt-2 m-auto" />}
                            {error && <div className="text-red-500 mt-5">{error}</div>}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-solid border-blueGray-200 rounded-b">
                            <button
                                className="text-slate-500 background-transparent font-bold uppercase px-6 py-2 text-sm outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                type="button"
                                onClick={() => {
                                    if (vaultLink != null) {
                                        props.setLoaded(false)
                                    }
                                    props.setShowModal(null)
                                }
                                }
                            >
                                Back
                            </button>
                            {vaultLink == null &&
                                <button
                                    className="bg-slate-500 text-white active:bg-emerald-600 font-bold uppercase text-sm px-6 py-3 rounded-sm shadow-sm hover:shadow-lg outline-hidden focus:outline-hidden mr-1 mb-1 ease-linear transition-all duration-150"
                                    type="button"
                                    onClick={() => { void create().then(() => console.log("done")).catch(e => {
                                        console.log(e)
                                        setError(e.message)
                                        setProgress("")
                                        setTxLoading(false)
                                    }) }}
                                >
                                    Create
                                </button>
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-40 bg-black"></div>
        </>
    )
}

export default CreateMitoVault