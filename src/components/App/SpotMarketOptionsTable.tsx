import { useState } from 'react';

const data = [
    { range: "0.0000001 - 0.000001", minPriceTick: "0.00000000001", minQtyTick: "1,000,000" },
    { range: "0.000001 - 0.00001", minPriceTick: "0.0000000001", minQtyTick: "100,000" },
    { range: "0.00001 - 0.0001", minPriceTick: "0.000000001", minQtyTick: "10,000" },
    { range: "0.0001 - 0.001", minPriceTick: "0.00000001", minQtyTick: "1,000" },
    { range: "0.001 - 0.01", minPriceTick: "0.0000001", minQtyTick: "100" },
    { range: "0.01 - 0.1", minPriceTick: "0.000001", minQtyTick: "10" },
    { range: "0.1 - 1", minPriceTick: "0.00001", minQtyTick: "1" },
    { range: "1 - 10", minPriceTick: "0.0001", minQtyTick: "0.1" },
    { range: "10 - 100", minPriceTick: "0.001", minQtyTick: "0.01" },
    { range: "100 - 1,000", minPriceTick: "0.01", minQtyTick: "0.001" },
    { range: "1,000 - 10,000", minPriceTick: "0.1", minQtyTick: "0.0001" },
    { range: "10,000+", minPriceTick: "1", minQtyTick: "0.00001" },
];

const SpotMarketConfigDropdownTable = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="w-full max-w-4xl mx-auto mt-5 ">
            <button
                onClick={toggleDropdown}
                className="w-full bg-slate-900 rounded-lg text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
                {isOpen ? 'Hide Suggested Tick Sizes' : 'Show Suggested Tick Sizes'}
            </button>
            {isOpen && (
                <div className="overflow-x-auto mt-4 ">
                    <table className="min-w-full ">
                        <thead>
                            <tr>
                                <th className="px-4 py-2">Expected Price per Token Range (USDT)</th>
                                <th className="px-4 py-2">Min Price Tick (USDT)</th>
                                <th className="px-4 py-2">Min Qty Tick</th>
                            </tr>
                        </thead>
                        <tbody className='text-slate-800 font-bold text-sm'>
                            {data.map((row, index) => (
                                <tr key={index} className="bg-gray-100">
                                    <td className="border px-2 py-1">{row.range}</td>
                                    <td className="border px-2 py-1">{row.minPriceTick}</td>
                                    <td className="border px-2 py-1">{row.minQtyTick}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SpotMarketConfigDropdownTable;