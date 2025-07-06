import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
const url = import.meta.env.VITE_CHOICE_URL;

const client = new ApolloClient({
    link: new HttpLink({
        uri: url,
    }),
    cache: new InMemoryCache(),
});

export default client;
