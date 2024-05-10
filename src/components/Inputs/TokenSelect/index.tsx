import CreatableSelect from 'react-select/creatable';
import IPFSImage from '../../App/IpfsImage';


const TokenSelect = ({ options, selectedOption, setSelectedOption }) => {
    const handleChange = (option) => {
        setSelectedOption(option);
    };

    const handleCreate = (inputValue: string) => {
        const newOption: OptionType = { value: inputValue, label: inputValue };
        setSelectedOption(newOption);
    };

    return (
        <CreatableSelect
            isClearable
            value={selectedOption}
            onChange={handleChange}
            options={options}
            className="token-select text-black"
            onCreateOption={handleCreate}
            noOptionsMessage={() => null}
            placeholder={"search contract address"}
            formatCreateLabel={(inputValue: string) => `${inputValue}`}
            formatOptionLabel={(data) => {
                return (
                    <div className='flex flex-row items-center'>
                        {data.img && <IPFSImage className={"rounded mr-2"} width={30} ipfsPath={data.img} />}
                        {data.label}
                    </div>
                )
            }}
            backspaceRemovesValue={true}
        />
    );
};

export default TokenSelect;
