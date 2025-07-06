import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import { gql, useQuery } from '@apollo/client';
import moment from "moment";
import { PiParachute } from "react-icons/pi";
import Footer from "../../components/App/Footer";
import useWalletStore from "../../store/useWalletStore";
import useNetworkStore from "../../store/useNetworkStore";


const AIRDROP_HISTORY_QUERY = gql`
query getAirdropHistory {
  airdrop_tracker_airdroplog(order_by: {time: desc}) {
    id
    amount_dropped
    criteria
    description
    time
    fee
    tx_hashes
    token {
      address
      name
      symbol
    }
    total_participants
    wallet {
      address
    }
  }
}
`

function humanReadableAmount(number) {
    if (!number) {
        return 0
    }
    const units = ["", "k", "m", "b", "t"];
    let unitIndex = 0;

    while (number >= 1000 && unitIndex < units.length - 1) {
        number /= 1000;
        unitIndex++;
    }

    return `${number.toFixed(number >= 10 ? 0 : 2)}${units[unitIndex]}`;
}

const AirdropHistory = () => {
    const { connectedWallet: connectedAddress } = useWalletStore()
    const { networkKey: currentNetwork, network: networkConfig } = useNetworkStore()

    const { data, loading } = useQuery(AIRDROP_HISTORY_QUERY, {
        fetchPolicy: "network-only",
        pollInterval: 5000
    })

    const [airdropData, setAirdropData] = useState([])

    useEffect(() => {
        console.log(data)
        if (!data) return

        setAirdropData(data.airdrop_tracker_airdroplog)
    }, [data])


    return (
        <div className="flex flex-col min-h-screen pb-10 bg-customGray">

            <div className="pt-16 mx-2 pb-20">
                {currentNetwork == "mainnet" && <div className="mt-2 md:mt-0"><ShroomBalance /></div>}

                <div className="min-h-full mt-2 md:mt-0 md:w-1/2 mx-auto">
                    <div className="px-2 text-white">

                        <div className="text-white text-2xl font-magic">Airdrop History</div>
                        <div className="flex flex-row justify-end">
                            <Link to="/airdrop" className="bg-slate-800 p-2 mt-2 rounded  text-sm">
                                Do airdrop
                            </Link>
                        </div>

                        {airdropData.length > 0 && airdropData.map((value, index) => {
                            return <div className="my-2 bg-slate-800 p-4 rounded-lg text-sm" key={index}>

                                <div className="flex flex-row items-center">
                                    <PiParachute className="mr-2 text-2xl" />
                                    {moment(value.time).fromNow()}

                                </div>
                                <a
                                    href={`https://explorer.injective.network/account/${value.wallet.address}`}
                                >
                                    performed by wallet: <span className="text-indigo-300 hover:text-indigo-900">{value.wallet.address.slice(0, 8)}...{value.wallet.address.slice(-8)}</span>
                                </a>
                                <div className="text-lg"><b>token dropped:</b> {value.token.symbol}</div>
                                <div className="text-lg"><b>participants:</b> {value.total_participants}</div>

                                <div className="text-lg">{value.criteria}
                                    <br />
                                    {value.description}
                                </div>
                                TX hashes:
                                {value.tx_hashes.split(",").map((value, index) => {
                                    return <a
                                        key={index}
                                        className="hover:text-indigo-900 text-indigo-300"
                                        href={`https://explorer.injective.network/transaction/${value}`}
                                    >
                                        <div className="text-sm" key={index}>
                                            explorer.injective.network/transaction/{value.slice(0, 5)}...
                                        </div>
                                    </a>

                                })}
                                <div className="text-sm flex flex-row justify-end mt-2">fee: {humanReadableAmount(value.fee)} SHROOM</div>
                            </div>
                        })}
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}

export default AirdropHistory