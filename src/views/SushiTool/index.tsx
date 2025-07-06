import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ConnectWallet from "../../components/App/ConnectKeplr";
import { processSushiData, getAllNfts, getMetaData, getSushiStats } from "./SushiUtils";
import { GridLoader } from "react-spinners";
import Footer from "../../components/App/Footer";


const SushiTool = () => {
    // 18810
    const [sushiId, setSushiId] = useState('18810');
    const [data, setData] = useState([{}]);
    const [sushiStats, setSushiStats] = useState([]);
    const [loading, setLoading] = useState(true);


    const [currentSushi, setCurrentSushi] = useState({});
    const [currentSushiImage, setCurrentSushiImage] = useState({});

    useEffect(() => {
        // Define the async function inside useEffect
        const fetchData = async () => {
            try {
                const [response1, response2, repsonse3] = await Promise.all([
                    getAllNfts(),
                    getMetaData(),
                    getSushiStats(),
                ]);

                const nfts = await response1;
                const metadata = await response2;

                const _sushiStats = await repsonse3;

                setSushiStats(_sushiStats["data"]["sortedWallets"]);

                const result = processSushiData(metadata, nfts);

                setData(result);
                setLoading(false);
            } catch (error) {
                setLoading(false);
            }
        };

        // Call the function
        fetchData();
    }, []);

    const handleInputChange = (event: any) => {
        setSushiId(event.target.value);
    };


    const handleSushiIdSearch = () => {
        const temp: any = data.filter((i: any) => {
            return i.rank !== null && i.index === parseInt(sushiId)
        })[0];
        setCurrentSushiImage(temp.metadata.image)
        console.log(temp.metadata.image)
        console.log(temp);
        setCurrentSushi(temp);

        console.log(sushiId);
    };

    return (
        <div className="flex flex-col min-h-screen pb-10">
            <header className="flex flex-row bg-gray-800 text-white shadow-md fixed top-0 left-0 right-0 z-10">
                <div className="container mx-auto flex items-center p-2 text-xs md:text-sm">
                    <Link to="/" className="font-bold hover:underline mx-5">
                        home
                    </Link>

                    <Link
                        to="/token-liquidity?address=inj1m35kyjuegq7ruwgx787xm53e5wfwu6n5uadurl"
                        className="font-bold hover:underline mr-5"
                    >
                        liquidity tool
                    </Link>
                    <Link
                        to="/manage-tokens"
                        className="font-bold hover:underline "
                    >
                        manage tokens
                    </Link>

                    <Link to="/sushi-tool" className="font-bold hover:underline mx-5">
                        sushi tool
                    </Link>
                </div>
                <div className="m-2">
                    <ConnectWallet />
                </div>
            </header>

            <div className="pt-14 flex-grow mx-2 pb-20">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-lg px-2 py-10">
                        <div className="text-center">
                            <div className="text-xl">
                                sushi holder tool
                            </div>
                            <div className="text-xs">on Injective main net</div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <label

                                className="block text-white"
                            >
                                search sushi by id
                            </label>
                            <input
                                style={{ color: "black" }}
                                type="text"
                                value={sushiId}
                                onChange={handleInputChange}
                            />
                        </div>

                        {!loading ? (
                            <button
                                onClick={handleSushiIdSearch}
                                className="mt-5 bg-gray-800 rounded-lg p-2 w-full text-white border border-slate-800 shadow-lg font-bold"
                            >
                                get sushi rank and oma
                            </button>
                        ) : (
                            <div className="flex flex-col items-center justify-center pt-5">
                                <GridLoader color="#f9d73f" />
                            </div>
                        )}

                        {(currentSushi as any)?.rank ? (
                            <div className="my-2">
                                <div> oma {(currentSushi as any).totalOma} </div>
                                <div> rank {(currentSushi as any).rank} </div>
                                <img className="rounded-lg" style={{ maxWidth: '300px', maxHeight: '300px' }} src={currentSushiImage as string} />

                            </div>
                        ) : (
                            <div></div>
                        )}

                        {sushiStats.length > 0 ? (
                            <div className="mt-2">
                                <table className="table-auto w-full">
                                    <thead className="text-left">
                                        <tr>
                                            <th>position</th>
                                            <th>wallet</th>
                                            <th>oma</th>
                                            <th>staked</th>
                                            <th>total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sushiStats.map((item, index) => (
                                            <tr key={index}>
                                                <td>{index + 1}</td>
                                                <td>{(item as any).wallet}</td>
                                                <td>{Math.floor((item as any).oma)}</td>
                                                <td>{(item as any).stakeCount}</td>
                                                <td>{(item as any).totalCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                            </div>
                        ) : (
                            <div></div>
                        )}

                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default SushiTool;
