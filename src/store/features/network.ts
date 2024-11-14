import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentNetwork: 'mainnet',
    connectedAddress: null, 
    networks: {
        mainnet: {
            grpc: "https://sentry.chain.grpc-web.injective.network",
            explorer: "https://sentry.explorer.grpc-web.injective.network/api/explorer/v1",
            rest: "https://sentry.lcd.injective.network",
            rpc: "https://sentry.tm.injective.network",
            indexer: "https://sentry.exchange.grpc-web.injective.network",
            chainId: "injective-1",
            explorerUrl: "https://explorer.injective.network",
        },
        testnet: {
            grpc: "https://testnet.sentry.chain.grpc-web.injective.network",
            explorer: "https://testnet.sentry.explorer.grpc-web.injective.network/api/explorer/v1",
            rest: "https://testnet.sentry.lcd.injective.network",
            indexer: "https://testnet.sentry.exchange.grpc-web.injective.network",
            chainId: "injective-888",
            explorerUrl: "https://testnet.explorer.injective.network",
        }
    }
};

export const networkSlice = createSlice({
    name: 'network',
    initialState,
    reducers: {
        switchNetwork: (state) => {
            state.currentNetwork = state.currentNetwork === 'mainnet' ? 'testnet' : 'mainnet';
        },
        setConnectedAddress: (state, action) => {
            state.connectedAddress = action.payload;  
        },
        clearConnectedAddress: (state) => {
            state.connectedAddress = null;
        }
    },
});

export const { switchNetwork, setConnectedAddress, clearConnectedAddress } = networkSlice.actions;
export default networkSlice.reducer;