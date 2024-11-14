import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { quantile } from 'd3-array';
import { Holder } from '../../constants/types';

interface HoldersChartProps {
    data: Holder[];
}

const HoldersChart: React.FC<HoldersChartProps> = ({ data }) => {
    const formattedData = data.map(holder => ({
        ...holder,
        balance: typeof holder.balance === 'string' ? parseFloat(holder.balance) : holder.balance,
        usdValue: holder.usdValue ? Number(holder.usdValue) : undefined
    }));

    const values = formattedData.map(holder => holder.usdValue ?? holder.balance).sort((a, b) => a - b);
    const usingUsdValues = formattedData.some(holder => holder.usdValue !== undefined);

    const quantiles = [
        quantile(values, 0.2),
        quantile(values, 0.4),
        quantile(values, 0.6),
        quantile(values, 0.8),
        quantile(values, 1.0)
    ];

    const categories = [
        { category: usingUsdValues ? `<= $${quantiles[0].toFixed(2)}` : `<= ${quantiles[0].toFixed(2)}`, count: 0 },
        { category: usingUsdValues ? `$${quantiles[0].toFixed(2)} - $${quantiles[1].toFixed(2)}` : `${quantiles[0].toFixed(2)} - ${quantiles[1].toFixed(2)}`, count: 0 },
        { category: usingUsdValues ? `$${quantiles[1].toFixed(2)} - $${quantiles[2].toFixed(2)}` : `${quantiles[1].toFixed(2)} - ${quantiles[2].toFixed(2)}`, count: 0 },
        { category: usingUsdValues ? `$${quantiles[2].toFixed(2)} - $${quantiles[3].toFixed(2)}` : `${quantiles[2].toFixed(2)} - ${quantiles[3].toFixed(2)}`, count: 0 },
        { category: usingUsdValues ? `> $${quantiles[3].toFixed(2)}` : `> ${quantiles[3].toFixed(2)}`, count: 0 }
    ];

    formattedData.forEach(holder => {
        const value = holder.usdValue ?? holder.balance;
        if (value <= quantiles[0]) categories[0].count++;
        else if (value <= quantiles[1]) categories[1].count++;
        else if (value <= quantiles[2]) categories[2].count++;
        else if (value <= quantiles[3]) categories[3].count++;
        else categories[4].count++;
    });

    function CustomTooltip({ payload, label, active }) {
        if (active) {
            return (
                <div className="custom-tooltip bg-white text-black p-2">
                    <p className="label">{`${label}`}</p>
                    <p className="label">Wallets: {`${payload[0].value}`}</p>
                </div>
            );
        }
        return null;
    }

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categories} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid stroke='white' strokeDasharray="3 3" />
                <XAxis stroke='white' dataKey="category" />
                <YAxis stroke='white' />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" fill="#36d7b7" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default HoldersChart;
