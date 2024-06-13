import { useState, useEffect } from 'react';
import { MdWaterDrop } from 'react-icons/md';

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

const LiquidityField = ({ value }) => {
    const [prevValue, setPrevValue] = useState(value);
    const [animationClass, setAnimationClass] = useState('');

    useEffect(() => {
        if (value > prevValue) {
            setAnimationClass('up');
        } else if (value < prevValue) {
            setAnimationClass('down');
        }

        const timeout = setTimeout(() => {
            setAnimationClass('');
        }, 1000);

        setPrevValue(value);

        return () => clearTimeout(timeout);
    }, [value, prevValue]);

    return (
        <div className={`money-value ${animationClass}`}>
            <div className='flex flex-row items-center'>${humanReadableAmount(value)} <MdWaterDrop className='ml-2' /></div>
        </div>
    );
};

export default LiquidityField;
