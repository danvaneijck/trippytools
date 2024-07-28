import { gql, useQuery } from '@apollo/client';
import tokenScannerImg from "../../assets/token.png"
import serverDownImg from "../../assets/serverdown.png"
import moment from "moment";
import { useCallback, useEffect, useState } from 'react';
import Slider, { SliderThumb, SliderValueLabelProps } from '@mui/material/Slider';
import { MenuItem, FormControl } from '@mui/material';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import _ from 'lodash';
import { styled } from '@mui/material/styles';
import MoneyValueField from '../../components/App/MoneyValueField';
import LiquidityField from '../../components/App/LiquidityField';
import MarketCapField from '../../components/App/MarketCapField';

const GET_TOKENS = gql`
query GetTokens($orderBy: [token_tracker_token_order_by!], $minLiquidity: float8, $maxLiquidity: float8) {
  token_tracker_token(where: {liquidity_last_updated: {_is_null: false}, total_liquidity: {_gte: $minLiquidity, _lte: $maxLiquidity}}, order_by: $orderBy) {
    address
    name
    symbol
    decimals
    total_supply
    liquidity_last_updated
    total_liquidity
    total_pooled_inj
    circulating_supply
    fdv
    market_cap
    holder_count: balances_aggregate(where: {wallet: {burn_address: {_eq: false}}}){
      aggregate{
        count
      }
    }
    prices(order_by: {time: desc}, limit: 1) {
      time
      price
    }
    asset_1_pools {
      contract_addr
      asset_1 {
        symbol
      }
      asset_2 {
        symbol
      }
      dex {
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
      asset_1 {
        symbol
      }
      asset_2 {
        symbol
      }
      dex {
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

const valuetext = (value) => {
  return `${humanReadableAmount(value)}`;
};

const minDistance = 10000;

const PrettoSlider = styled(Slider)({
  color: '#0636F9',
  height: 8,
  '& .MuiSlider-track': {
    border: 'none',
  },
  '& .MuiSlider-thumb': {
    height: 24,
    width: 24,
    backgroundColor: '#fff',
    border: '2px solid currentColor',
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: 'inherit',
    },
    '&::before': {
      display: 'none',
    },
  },
  '& .MuiSlider-valueLabel': {
    lineHeight: 1.2,
    fontSize: 14,
    background: 'unset',
    padding: 0,
    width: 52,
    height: 52,
    borderRadius: '50% 50% 50% 0',
    backgroundColor: '#0636F9',
    transformOrigin: 'bottom left',
    transform: 'translate(50%, -100%) rotate(-45deg) scale(0)',
    '&::before': { display: 'none' },
    '&.MuiSlider-valueLabelOpen': {
      transform: 'translate(50%, -100%) rotate(-45deg) scale(2)',
    },
    '& > *': {
      transform: 'rotate(45deg)',
    },
  },
});

const FilterBar = ({ orderBy, setOrderBy, liquidityRange, setLiquidityRange }) => {
  const handleChange = (event, newValue, activeThumb) => {
    if (!Array.isArray(newValue)) {
      return;
    }

    if (activeThumb === 0) {
      setLiquidityRange([Math.min(newValue[0], liquidityRange[1] - minDistance), liquidityRange[1]]);
    } else {
      setLiquidityRange([liquidityRange[0], Math.max(newValue[1], liquidityRange[0] + minDistance)]);
    }
  };

  return (
    <div className="flex flex-row text-sm">
      <div className="flex flex-row items-center text-white ">
        <label className='mr-5'>Order By</label>
        <Select
          style={{ color: "white" }}
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value)}
        >
          <MenuItem value="market_cap">Market Cap</MenuItem>
          <MenuItem value="total_liquidity">Total Liquidity</MenuItem>
          <MenuItem value="total_pooled_inj">Total Pooled INJ</MenuItem>
          <MenuItem value="liquidity_last_updated">Liquidity Last Updated</MenuItem>

        </Select>
      </div>
      <div className="ml-10 flex flex-row items-center">
        <div>
          <label>Liquidity Range</label>
          <div style={{ width: 300 }}>
            <PrettoSlider
              getAriaLabel={() => 'Minimum distance'}
              value={liquidityRange}
              onChange={handleChange}
              valueLabelDisplay="auto"
              getAriaValueText={valuetext}
              disableSwap
              min={0}
              max={100000}
            />
          </div>
        </div>
        <div className='ml-4'>
          {humanReadableAmount(liquidityRange[0])} - {humanReadableAmount(liquidityRange[1])}
        </div>
      </div>
    </div>
  );
};


const TokenScanner = () => {
  const [currentTime, setCurrentTime] = useState(moment().format('LTS'));
  const [orderBy, setOrderBy] = useState("total_liquidity");
  const [liquidityRange, setLiquidityRange] = useState([420, 69000]);
  const [mcRange, setMcRange] = useState([420, 69000]);

  const [variables, setVariables] = useState({
    orderBy: { total_liquidity: "desc" },
    minLiquidity: 0,
    maxLiquidity: 1000000
  });

  const debouncedSetVariables = useCallback(
    _.debounce((newVariables) => {
      setVariables(newVariables);
    }, 1000),
    []
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(moment().format('LTS'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    debouncedSetVariables({
      orderBy: { [orderBy]: "desc" },
      minLiquidity: liquidityRange[0],
      maxLiquidity: liquidityRange[1]
    });
  }, [orderBy, liquidityRange, debouncedSetVariables]);

  const { loading, error, data } = useQuery(GET_TOKENS, {
    variables,
    pollInterval: 5000
  });

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {error ? <div className="flex justify-center mt-20">
        <div>
          <img src={serverDownImg} width={200} />

          <p className='text-center mt-2'>dev is devvin'</p>
          <p>{error.message}</p>
        </div>

      </div> : <div className="flex justify-center">
        <img src={tokenScannerImg} width={200} />
      </div>
      }
      {!error &&
        <div>
          <div className='flex flex-row justify-between items-center'>

            <div className='ml-5'>
              <FilterBar
                orderBy={orderBy}
                setOrderBy={setOrderBy}
                liquidityRange={liquidityRange}
                setLiquidityRange={setLiquidityRange}
              />
            </div>
            <div className="mr-6 ">
              <p>{currentTime}</p>
            </div>
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
              const sortPools = (a, b) => {
                if (!a.liquidity) return 1;
                if (!b.liquidity) return -1;
                return b.liquidity - a.liquidity;
              };

              combinedPools.sort(sortPools);
              return (
                <div key={token.address} className="token-card">
                  <div className='p-5 rounded-lg bg-slate-800'>
                    <div className='flex flex-row justify-between'>
                      <div>
                        <h2 className='text-2xl'>{token.symbol}</h2>
                        <p className='text-sm'>{`${token.address.slice(0, 5)}...${token.address.slice(-5)}`}</p>
                        <p>Total Supply: {humanReadableAmount(token.total_supply / Math.pow(10, token.decimals))}</p>
                        <p>Circ Supply: {humanReadableAmount(token.circulating_supply)}</p>
                        {/* <p>Total Liquidity: ${humanReadableAmount(token.total_liquidity)} {moment(token.liquidity_last_updated).fromNow()}</p> */}
                        <p>Total Pooled INJ: {token.total_pooled_inj.toFixed(2)}</p>
                        <p>Holders: {token.holder_count.aggregate.count.toFixed(2)}</p>

                      </div>
                      <div>
                        <MoneyValueField value={Number(token.prices[0]?.price)} />
                        {/* <p className='text-xs'>{moment(token.prices[0]?.time).fromNow()}</p> */}
                        <MarketCapField value={Number(token.market_cap)} />
                        <LiquidityField value={Number(token.total_liquidity)} />
                        <p className='text-xs'>{moment(token.prices[0]?.time).fromNow()}</p>
                      </div>
                    </div>
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
      }
    </div>

  );
};

export default TokenScanner;