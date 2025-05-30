import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import TokenHolders from "./views/TokenHolders";
import SushiTool from "./views/SushiTool";
import TokenLiquidity from "./views/TokenLiquidity";
import TokenLaunch from './views/TokenLaunch';
import TrippyDistribution from "./views/TrippyDistribution";
import Home from "./views/Home";
import MyTokens from './views/MyTokens';
import { store, persistor } from './store/store';
import { Provider } from 'react-redux';
import Airdrop from './views/Airdrop';
import MyceliumFarm from './views/MyceliumFarm';
import TokenScanner from './views/TokenScanner';
import { ApolloProvider } from '@apollo/client';
import client from './utils/apolloClient';
import BinaryOptionMarkets from './views/BinaryOptionMarkets';
import AirdropHistory from './views/AirdropHistory';
import MitoMarketMake from './views/MitoMarketMake';
import PreSaleTool from './views/PresaleTool';
import { PersistGate } from 'redux-persist/integration/react';
import DojoWhitelist from './views/DojoWhitelist';
import Header from './components/App/Header';
import ShroomHub from './views/ShroomHub';
import QuntUnwrap from './views/QuntUnwrap';
import WalletExport from './views/WalletExport';

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ApolloProvider client={client}>
          <Router>
            <Header />
            <Routes>
              <Route path="/token-holders" element={<TokenHolders />} />
              <Route path="/sushi-tool" element={<SushiTool />} />
              <Route path="/token-liquidity" element={<TokenLiquidity />} />
              <Route path="/token-launch" element={<TokenLaunch />} />
              {/* <Route path="/trippy-distribution" element={<TrippyDistribution />} /> */}
              <Route path="/manage-tokens" element={<MyTokens />} />
              <Route path="/airdrop" element={<Airdrop />} />
              <Route path="/airdrop-history" element={<AirdropHistory />} />
              <Route path="/mycelium-farm" element={<MyceliumFarm />} />
              <Route path="/token-scanner" element={<TokenScanner />} />
              <Route path="/binary-option-markets" element={<BinaryOptionMarkets />} />
              <Route path="/market-make" element={<MitoMarketMake />} />
              <Route path="/pre-sale-tool" element={<PreSaleTool />} />
              <Route path="/dojo-whitelist" element={<DojoWhitelist />} />
              <Route path="/shroom-hub" element={<ShroomHub />} />
              <Route path="/qunt-unwrap" element={<QuntUnwrap />} />
              <Route path="/wallet-export" element={<WalletExport />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </Router>
        </ApolloProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;
