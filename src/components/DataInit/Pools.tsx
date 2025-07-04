import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { LiquidityPool } from '../../utils/types';
import dayjs from 'dayjs';
import client from "../../utils/choiceApolloClient"
import useLiquidityPoolStore from '../../store/usePoolStore';


const QUERY_POOLS = gql`
query getPools($yesterday: timestamptz!){
  liquidity_liquiditypool(where: {track_price: {_eq: true}}) {
    contract_addr
    dex {
      id
      factory_address
      router_address
      name
    }
    volume24h {
      updated_at
      window_start
      usd_volume
      usd_fee
      usd_pool_fee
    }
    pool_amounts(where: {time: {_gte: $yesterday}}, order_by: {time: desc}, limit: 1){
      time
      usd_asset_1
      usd_asset_2
      usd_liquidity
    }
    liquidity_token {
      address
      symbol
      name
      decimals
      logo
    }
    asset_1 {
      address
      symbol
      name
      decimals
      logo
      prices(order_by: {time: desc}, limit: 1) {
        time
        price
      }
    }
    asset_2 {
      address
      symbol
      name
      decimals
      logo
      prices(order_by: {time: desc}, limit: 1) {
        time
        price
      }
    }
  }
}
`

const PoolInitializer = () => {

    const [yesterday] = useState(dayjs().subtract(24, 'hour'))

    const { data, refetch, error } = useQuery(QUERY_POOLS, {
        client: client,
        fetchPolicy: "network-only",
        variables: {
            yesterday: yesterday
        }
    });

    useEffect(() => {
        const id = setInterval(() => {
            refetch({
                yesterday: dayjs().subtract(24, "hour").toISOString(),
            });
        }, 10000);

        return () => clearInterval(id);
    }, [refetch]);


    const setPools = useLiquidityPoolStore(state => state.setPools);

    useEffect(() => {
        if (data && data.liquidity_liquiditypool) {
            // console.log(data)
            const poolsWithTokenInfo: LiquidityPool[] = []

            data.liquidity_liquiditypool.map((pool) => {
                const asset1 = {
                    ...pool.asset_1,
                    info: (pool.asset_1.address == ("inj") || pool.asset_1.address.includes("peggy") || pool.asset_1.address.includes("factory/") || pool.asset_1.address.includes("ibc/")) ?
                        {
                            native_token: {
                                denom: pool.asset_1.address
                            }
                        } :
                        {
                            token: {
                                contract_addr: pool.asset_1.address
                            }
                        },
                    icon: pool.asset_1.logo
                }
                const asset2 = {
                    ...pool.asset_2,
                    info: (pool.asset_2.address == ("inj") || pool.asset_2.address.includes("peggy") || pool.asset_2.address.includes("factory/") || pool.asset_2.address.includes("ibc/")) ?
                        {
                            native_token: {
                                denom: pool.asset_2.address
                            }
                        } :
                        {
                            token: {
                                contract_addr: pool.asset_2.address
                            }
                        },
                    icon: pool.asset_2.logo
                }

                let liqToken = null

                if (pool.liquidity_token) {
                    liqToken = {
                        ...pool.liquidity_token,
                        info: pool.liquidity_token.address.includes("factory/") ?
                            {
                                native_token: {
                                    denom: pool.liquidity_token.address
                                }
                            } :
                            {
                                token: {
                                    contract_addr: pool.liquidity_token.address
                                }
                            },
                        icon: pool.liquidity_token.logo
                    }
                }

                let tvl
                let tvlUpdated

                if (pool.pool_amounts.length == 1) {
                    tvl = pool.pool_amounts[0].usd_liquidity
                    tvlUpdated = pool.pool_amounts[0].time
                }

                let dayVolume = 0
                let dayFee = 0
                let apr24h = 0

                if (pool.volume24h) {
                    dayVolume = pool.volume24h.usd_volume
                    dayFee = pool.volume24h.usd_pool_fee
                }

                if (dayFee && tvl) {
                    apr24h = (dayFee / tvl) * 365
                }

                poolsWithTokenInfo.push({
                    ...pool,
                    asset_1: asset1,
                    asset_2: asset2,
                    liquidity_token: liqToken,
                    tvl: tvl,
                    tvlUpdated: tvlUpdated,
                    dayVolume: dayVolume,
                    dayFee,
                    apr24h,
                })
            })
            setPools(poolsWithTokenInfo)
        }

    }, [data, setPools, error]);


    return null;
};

export default PoolInitializer;
