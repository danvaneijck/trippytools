import { useState } from 'react';
import { SiConvertio } from "react-icons/si";

const ConvertModal = ({ onClose, cw20Balance, bankBalance, convertToBank, convertToCW20 }) => {
    const [amount, setAmount] = useState('');
    const [conversionDirection, setConversionDirection] = useState('cw20ToBank');

    const handleAmountChange = (e) => {
        setAmount(e.target.value);
    };

    const handleToggleConversion = () => {
        setConversionDirection(conversionDirection === 'cw20ToBank' ? 'bankToCW20' : 'cw20ToBank');
        setAmount('');
    };

    const handleConvert = async () => {
        if (conversionDirection === 'cw20ToBank') {
            await convertToBank(amount);
        } else {
            await convertToCW20(amount);
        }
    };

    const outputAmount = conversionDirection === 'cw20ToBank'
        ? (amount)
        : (amount);

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 ">
            <div className="bg-customGray p-6 rounded-lg shadow-lg max-w-sm w-full slide-in">
                <h2 className="text-center mb-2 font-magic text-3xl">Convert {conversionDirection === 'cw20ToBank' ? 'CW20 to Bank' : 'Bank to CW20'}</h2>
                <div className='mb-4 text-sm'>
                    You can switch between CW20 and bank tokens at a 1:1 ratio at any time. CW20 tokens are ideal for paying tool fees, while bank tokens are best suited for use on Mito Finance and the Helix DEX.
                </div>
                <div className="mb-2">
                    <label className="block text-white font-medium mb-2">
                        {conversionDirection === 'cw20ToBank' ? 'CW20 Input' : 'Bank Input'}
                    </label>
                    <div className="flex items-center">
                        <input
                            type="number"
                            value={amount}
                            onChange={handleAmountChange}
                            placeholder={conversionDirection === 'cw20ToBank' ? `Balance: ${cw20Balance}` : `Balance: ${bankBalance}`}
                            className="w-full p-2 border border-gray-300 rounded-l text-black"
                        />
                        <button
                            onClick={() => {
                                setAmount(conversionDirection === 'cw20ToBank' ? cw20Balance - (cw20Balance * 0.00000000001) : bankBalance - (bankBalance * 0.00000000001));
                            }}
                            className="bg-gray-700 text-white border px-4 py-2 rounded-r hover:bg-gray-800 transition"
                        >
                            MAX
                        </button>
                    </div>
                </div>

                <div className="flex justify-center ">
                    <button
                        onClick={handleToggleConversion}
                        className="px-4 py-2  text-white rounded-lg transition"
                    >
                        <SiConvertio
                            size={30}
                            className="m-auto"
                        />
                    </button>
                </div>

                <div className="mb-10">
                    <label className="block text-white font-medium mb-2">
                        {conversionDirection === 'cw20ToBank' ? 'Bank Output' : 'CW20 Output'}
                    </label>
                    <input
                        type="text"
                        value={outputAmount}
                        readOnly
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                    />
                </div>

                <button
                    onClick={handleConvert}
                    disabled={!amount || amount <= 0}
                    className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition disabled:bg-gray-300"
                >
                    Convert
                </button>

                <button
                    onClick={onClose}
                    className="w-full mt-3 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition"
                >
                    Cancel
                </button>
            </div>
        </div>



    );
};

export default ConvertModal;
