import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import useTokenStore from '../../store/useTokenStore';
import { Token } from '../../utils/types';
import dayjs from 'dayjs';
import client from "../../utils/choiceApolloClient"

const QUERY_TOKENS = gql`
query ($yesterday: timestamptz!) {
  tokens_token {
    address
    name
    symbol
    logo
    decimals
    show_on_ui
    total_supply
    prices(limit: 1, order_by: {time: desc}) {
      time
      price
    }
    yesterday_price: prices(where: {time: {_lte: $yesterday}}, order_by: {time: desc}, limit: 1) {
      time
      price
    }
    liquidity_token_pool {
      contract_addr
      asset_1 {
        address
        name
        symbol
        decimals
        logo
      }
      asset_2 {
        address
        name
        symbol
        decimals
        logo
      }
      liquidity_token {
        address
        symbol
        name
        decimals
        logo
      }
    }
    pools_asset_1 {
      contract_addr
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
        yesterday_price: prices(where: {time: {_lte: $yesterday}}, order_by: {time: desc}, limit: 1) {
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
        yesterday_price: prices(where: {time: {_lte: $yesterday}}, order_by: {time: desc}, limit: 1) {
          time
          price
        }
      }
    }
    pools_asset_2 {
      contract_addr
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
        yesterday_price: prices(where: {time: {_lte: $yesterday}}, order_by: {time: desc}, limit: 1) {
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
        yesterday_price: prices(where: {time: {_lte: $yesterday}}, order_by: {time: desc}, limit: 1) {
          time
          price
        }
      }
    }
  }
}
`

function getTodayPrice(token: Token): number {
  const raw =
    token.prices && token.prices[0]?.price != null
      ? token.prices[0].price
      : token.price;
  return parseFloat(raw || "0");
}

function getPercentChange(token): number {
  const today = getTodayPrice(token);
  const yesterday =
    token.yesterday_price && token.yesterday_price[0]?.price != null
      ? parseFloat(token.yesterday_price[0].price)
      : 0;

  if (yesterday > 0) {
    return ((today - yesterday) / yesterday) * 100;
  }
  // If no valid yesterday price, treat as “0” (or you could return NaN or a sentinel)
  return 0;
}


const TokenInitializer = () => {

  const [yesterday] = useState(dayjs().subtract(24, 'hour'))

  const { data, refetch } = useQuery(QUERY_TOKENS, {
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
    }, 100000);

    return () => clearInterval(id);
  }, [refetch]);

  const setTokens = useTokenStore(state => state.setTokens);

  useEffect(() => {
    console.log(data)
    if (data && data.tokens_token) {
      setTokens(data.tokens_token.map((token: Token) => {
        const price = getTodayPrice(token)
        const percentChange = getPercentChange(token)
        const marketCap = (token.total_supply / Math.pow(10, token.decimals)) * price
        return {
          ...token,
          percentChange: percentChange,
          marketCap: marketCap,
          price: price,
          info: (token.address == ("inj") || token.address.includes("peggy") || token.address.includes("factory/") || token.address.includes("ibc/")) ?
            {
              native_token: {
                denom: token.address
              }
            } :
            {
              token: {
                contract_addr: token.address
              }
            },
          icon: token.logo
        }
      }));
    }

  }, [data, setTokens]);


  return null;
};

export default TokenInitializer;
