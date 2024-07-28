import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
const url = import.meta.env.VITE_HASURA_URL;
// const secret = import.meta.env.VITE_HASURA_KEY;

const client = new ApolloClient({
  link: new HttpLink({
    uri: url, 
    // headers: {
    //   'x-hasura-admin-secret': secret,
    // },
  }),
  cache: new InMemoryCache()
});

export default client;
