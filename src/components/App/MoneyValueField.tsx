import { useState, useEffect } from 'react';

const MoneyValueField = ({ value }) => {
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
            ${value.toFixed(10)}
        </div>
    );
};

export default MoneyValueField;
