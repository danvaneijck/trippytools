import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import ConnectKeplr from "../../components/App/ConnectKeplr";
import { useEffect, useState } from "react";
import ShroomBalance from "../../components/App/ShroomBalance";
import { gql, useQuery } from '@apollo/client';
import moment from "moment";
import { PiParachute } from "react-icons/pi";


const AIRDROP_HISTORY_QUERY = gql`
query getAirdropHistory {
  airdrop_tracker_airdroplog(order_by: {time: desc}) {
    id
    amount_dropped
    criteria
    description
    time
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

const AirdropHistory = () => {
    const connectedAddress = useSelector(state => state.network.connectedAddress);

    const currentNetwork = useSelector(state => state.network.currentNetwork);
    const networkConfig = useSelector(state => state.network.networks[currentNetwork]);

    const { data, loading } = useQuery(AIRDROP_HISTORY_QUERY)

    const [airdropData, setAirdropData] = useState([])

    useEffect(() => {
        console.log(data)
        if (!data) return

        setAirdropData(data.airdrop_tracker_airdroplog)
    }, [data])


    return (
        <div className="flex flex-col min-h-screen pb-10">
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-sm md:text-sm">
                    <Link to="/" className="ml-5 font-bold hover:underline mr-5">
                        home
                    </Link>

                </div>
                <div className="m-2">
                    <ConnectKeplr />
                </div>
            </header>
            <div className="pt-14 mx-2 pb-20">
                {currentNetwork == "mainnet" && <div className="mt-2 md:mt-0"><ShroomBalance /></div>}
                <div className="flex justify-center items-center min-h-full mt-2 md:mt-0">
                    <div className="px-2 text-white">
                        <div className="text-white text-lg">Airdrop History</div>
                        {airdropData.length > 0 && airdropData.map((value, index) => {
                            return <div className="my-2 bg-slate-800 p-2 rounded-lg" key={index}>

                                <div className="flex flex-row items-center">
                                    <PiParachute className="mr-2 text-2xl" />

                                    {moment(value.time).fromNow()} by {value.wallet.address.slice(-5)}
                                </div>
                                <div><b>token dropped:</b> {value.token.symbol}</div>
                                <div><b>participants</b> {value.total_participants}</div>

                                <b>criteria:</b> {value.criteria}
                                <br />
                                <b>description:</b> {value.description}

                            </div>
                        })}
                    </div>
                </div>
            </div>

            <footer className="bg-gray-800 text-white text-xs p-4 fixed bottom-0 left-0 right-0">
                buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
            </footer>
        </div>
    );
}

export default AirdropHistory