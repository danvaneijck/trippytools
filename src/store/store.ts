import { configureStore } from '@reduxjs/toolkit';
import networkReducer from './features/network';

export const store = configureStore({
    reducer: {
        network: networkReducer
    },
});
