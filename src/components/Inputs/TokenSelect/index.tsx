import { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import IPFSImage from '../../App/IpfsImage';

// `dark` opts into a dark-themed control (via the caller-supplied `styles`) and
// drops the app default white-field `text-black` treatment. Off by default so
// every existing usage keeps its current look.
const TokenSelect = ({ options, selectedOption, setSelectedOption, styles, dark = false, placeholder }: any) => {
    const [showPasteButton, setShowPasteButton] = useState(!selectedOption);

    const handleChange = (option: any) => {
        setSelectedOption(option);
        setShowPasteButton(false); // Hide paste button when an option is selected
    };

    const handleCreate = (inputValue: any) => {
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
                <button
                    onClick={() => { void handlePaste(); }}
                    className={
                        dark
                            ? "mb-1.5 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                            : "text-xs bg-slate-700 p-1 rounded-sm shadow-lg mb-1 mt-1"
                    }
                >
                    Paste from clipboard
                </button>
            )}
            <CreatableSelect
                isClearable
                isOptionDisabled={(option) => option.isDisabled}
                value={selectedOption}
                onChange={handleChange}
                options={options}
                className={dark ? "token-select" : "token-select text-black"}
                styles={styles}
                onCreateOption={handleCreate}
                noOptionsMessage={() => null}
                placeholder={placeholder ?? "Search contract address"}
                formatCreateLabel={(inputValue) => `${inputValue}`}
                formatOptionLabel={(data) => (
                    <div className='flex flex-row items-center'>
                        {data.img && <IPFSImage className={"rounded-sm mr-2"} width={30} ipfsPath={data.img} />}
                        {data.label}
                    </div>
                )}
                backspaceRemovesValue={true}
            />

        </div>
    );
};

export default TokenSelect;
