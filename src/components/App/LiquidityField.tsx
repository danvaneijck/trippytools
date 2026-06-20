import { useState, useEffect } from 'react';
import { MdWaterDrop } from 'react-icons/md';
import { humanReadableAmount } from '../../utils/format';

const LiquidityField = ({ value }: any) => {
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
