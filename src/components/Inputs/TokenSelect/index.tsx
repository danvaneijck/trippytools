import { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import IPFSImage from '../../App/IpfsImage';

const TokenSelect = ({ options, selectedOption, setSelectedOption }) => {
    const [showPasteButton, setShowPasteButton] = useState(!selectedOption);

    const handleChange = (option) => {
        setSelectedOption(option);
        setShowPasteButton(false); // Hide paste button when an option is selected
    };

    const handleCreate = (inputValue) => {
        const newOption = { value: inputValue, label: inputValue };
        setSelectedOption(newOption);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const newOption = { value: text, label: text };
            setSelectedOption(newOption);
        } catch (error) {
            console.error('Failed to read clipboard contents:', error);
        }
    };

    useEffect(() => {
        setShowPasteButton(!selectedOption); // Show paste button when no option is selected
    }, [selectedOption]);

    return (
        <div className='token-select-container mt-1'>
            {showPasteButton && (
                <button onClick={handlePaste} className="text-xs bg-slate-700 p-1 rounded shadow-lg mb-1 mt-1">
                    Paste from clipboard
                </button>
            )}
            <CreatableSelect
                isClearable
                isOptionDisabled={(option) => option.isDisabled}
                value={selectedOption}
                onChange={handleChange}
                options={options}
                className="token-select text-black"
                onCreateOption={handleCreate}
                noOptionsMessage={() => null}
                placeholder={"Search contract address"}
                formatCreateLabel={(inputValue) => `${inputValue}`}
                formatOptionLabel={(data) => (
                    <div className='flex flex-row items-center'>
                        {data.img && <IPFSImage className={"rounded mr-2"} width={30} ipfsPath={data.img} />}
                        {data.label}
                    </div>
                )}
                backspaceRemovesValue={true}
            />

        </div>
    );
};

export default TokenSelect;
