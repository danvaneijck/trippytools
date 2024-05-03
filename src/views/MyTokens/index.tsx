/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useCallback, useEffect, useState } from "react";
import TokenUtils from "../../modules/tokenUtils";
import { GridLoader } from "react-spinners";
import { Link } from "react-router-dom";
import { Holder, MarketingInfo, TokenInfo } from "../../types";
import { useSearchParams } from 'react-router-dom';
import { Buffer } from "buffer";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useSelector } from "react-redux";

const MAIN_NET = {
    grpc: "https://sentry.chain.grpc-web.injective.network",
    explorer: `https://sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://sentry.lcd.injective.network",
    indexer: "https://sentry.exchange.grpc-web.injective.network",
    chainId: "injective-1",
    dojoFactory: "inj1pc2vxcmnyzawnwkf03n2ggvt997avtuwagqngk",
    explorerUrl: "https://explorer.injective.network",
};

const TEST_NET = {
    grpc: "https://testnet.sentry.chain.grpc-web.injective.network",
    explorer: `https://testnet.sentry.explorer.grpc-web.injective.network/api/explorer/v1`,
    rest: "https://testnet.sentry.lcd.injective.network",
    indexer: "https://testnet.sentry.exchange.grpc-web.injective.network",
    chainId: "injective-888",
    explorerUrl: "https://testnet.explorer.injective.network",
};


const MyTokens = () => {

    const [module, setModule] = useState<TokenUtils | null>(null);
    const [tokens, setTokens] = useState([])

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const getKeplr = async (chainId: string) => {
        await window.keplr.enable(chainId);

        const offlineSigner = window.keplr.getOfflineSigner(chainId);
        const accounts = await offlineSigner.getAccounts();
        const key = await window.keplr.getKey(chainId);

        return { offlineSigner, accounts, key };
    };

    const getTokens = useCallback(async () => {
        if (!module) {
            console.log("no module")
            return
        }
        setTokens([])
        console.log("get tokens")
        console.log(networkConfig.chainId)
        const { key, offlineSigner } = await getKeplr(networkConfig.chainId);
        const pubKey = Buffer.from(key.pubKey).toString("base64");
        const injectiveAddress = key.bech32Address;
        const tokens = await module.getUserTokens(injectiveAddress)
        return tokens
    }, [module, networkConfig])

    useEffect(() => {
        getTokens().then(tokens => {
            console.log(tokens)
            return setTokens([...tokens]);
        }).catch(e => {
            console.log(e)
        })
    }, [getTokens, module])

    useEffect(() => {
        setModule(new TokenUtils(networkConfig))
    }, [networkConfig])

    return (
        <div className="flex flex-col min-h-screen pb-10">
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-base">
                    <Link to="/" className="font-bold hover:underline mr-5">
                        home
                    </Link>

                    <Link
                        to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                        className="font-bold hover:underline "
                    >
                        liquidity tool
                    </Link>

                </div>
                <div className="m-2">
                    <ConnectKeplr />
                </div>
            </header>

            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-xl px-2 py-10">
                        <div className="text-center text-white">
                            <div className="text-xl">
                                Mange tokens
                            </div>
                            <div className="text-xs">on Injective main net</div>
                        </div>
                        <div className="flex flex-col">
                            {tokens && tokens.length > 0 && tokens.map((token) => {
                                return <div>{token}</div>
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <footer className="bg-gray-800 text-white text-xs p-4 fixed bottom-0 left-0 right-0">
                buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
            </footer>
        </div>
    );
};

export default MyTokens;
