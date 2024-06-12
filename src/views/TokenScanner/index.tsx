import { gql, useQuery } from '@apollo/client';
import chroma from "chroma-js";
import tokenScannerImg from "../../assets/token.png"
import moment from "moment";
import { useEffect, useState } from 'react';

const GET_TOKENS = gql`
  query GetTokens {
  token_tracker_token(where: {liquidity_last_updated: {_is_null: false}}) {
    address
    name
    symbol
    decimals
    total_supply
    liquidity_last_updated
    total_liquidity
    total_pooled_inj
    prices(order_by: {time: desc}, limit: 1) {
      time
      price
    }
    asset_1_pools {
      contract_addr
      asset_1{
        symbol
      }
      asset_2{
        symbol
      }
      dex{
        name
      }
      pool_amounts(order_by: {time: desc}, limit: 1) {
        prices(order_by: {time: desc}, limit: 1) {
        time
          price
          liquidity
        }
      }
    }
    asset_2_pools {
      contract_addr
      asset_1{
        symbol
      }
      asset_2{
        symbol
      }
      dex{
        name
      }
      pool_amounts(order_by: {time: desc}, limit: 1) {
        prices(order_by: {time: desc}, limit: 1) {
        time
          price
          liquidity
        }
      }
    }
  }
}
`;

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

const TokenScanner = () => {
    const [currentTime, setCurrentTime] = useState(moment().format('LTS'));

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(moment().format('LTS'));
        }, 1000);
        return () => clearInterval(interval); // Clean up the interval on component unmount
    }, []);
    const { loading, error, data } = useQuery(GET_TOKENS, {
        pollInterval: 5000
    });

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error.message}</p>;

    return (
        <div>
            <div className="flex justify-center">
                <img src={tokenScannerImg} width={200} />
            </div>
            <div className="ml-6">
                <p>{currentTime}</p>
            </div>
            <div className="token-grid text-white font-bold">
                {data.token_tracker_token.map((token) => {
                    const combinedPools = [
                        ...token.asset_1_pools.map(pool => ({
                            name: `${pool.asset_1.symbol}/${pool.asset_2.symbol} ${pool.dex.name}`,
                            contract_addr: pool.contract_addr,
                            liquidity: pool.pool_amounts[0]?.prices[0]?.liquidity,
                            price: pool.pool_amounts[0]?.prices[0]?.price,
                            priceTime: pool.pool_amounts[0]?.prices[0]?.time
                        })),
                        ...token.asset_2_pools.map(pool => ({
                            name: `${pool.asset_1.symbol}/${pool.asset_2.symbol} ${pool.dex.name}`,
                            contract_addr: pool.contract_addr,
                            liquidity: pool.pool_amounts[0]?.prices[0]?.liquidity,
                            price: pool.pool_amounts[0]?.prices[0]?.price,
                            priceTime: pool.pool_amounts[0]?.prices[0]?.time
                        }))
                    ];
                    combinedPools.sort((a, b) => b.liquidity - a.liquidity)
                    return (
                        <div key={token.address} className="token-card">
                            <div className='p-5 rounded-lg bg-slate-800'>
                                <h2 className='text-lg'>{token.symbol}</h2>
                                <p className='text-sm'>{`${token.address.slice(0, 5)}...${token.address.slice(-5)}`}</p>
                                <p>Total Supply: {humanReadableAmount(token.total_supply / Math.pow(10, token.decimals))}</p>
                                <p>Total Liquidity: ${humanReadableAmount(token.total_liquidity)} {moment(token.liquidity_last_updated).fromNow()}</p>
                                <p>Total Pooled INJ: {token.total_pooled_inj.toFixed(2)}</p>
                                <p>${Number(token.prices[0]?.price).toFixed(10)} {moment(token.prices[0]?.time).fromNow()}</p>
                                <div className="mt-2">
                                    <h3>Liquidity Pools ({combinedPools.length})</h3>
                                    <div className='mt-1 max-h-44 overflow-y-scroll'>
                                        {combinedPools.map((pool, index) => (
                                            <div key={index} className="bg-slate-900 px-2 py-1 my-1 rounded-lg text-sm">
                                                <p>{pool.name}</p>
                                                <p>${Number(pool.price).toFixed(10)}</p>
                                                <p>${humanReadableAmount(pool.liquidity)} {moment(pool.priceTime).fromNow()}</p>
                                            </div>
                                        ))}
                                    </div>

                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>

    );
};

export default TokenScanner;