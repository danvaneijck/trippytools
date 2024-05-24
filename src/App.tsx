import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import TokenHolders from "./views/TokenHolders";
import SushiTool from "./views/SushiTool";
import TokenLiquidity from "./views/TokenLiquidity";
import TokenLaunch from './views/TokenLaunch';
import TrippyDistribution from "./views/TrippyDistribution";
import Home from "./views/Home";
import MyTokens from './views/MyTokens';
import { store } from './store/store';
import { Provider } from 'react-redux';
import Airdrop from './views/Airdrop';
import MyceliumFarm from './views/MyceliumFarm';

const App = () => {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          <Route path="/token-holders" element={<TokenHolders />} />
          <Route path="/sushi-tool" element={<SushiTool />} />
          <Route path="/token-liquidity" element={<TokenLiquidity />} />
          <Route path="/token-launch" element={<TokenLaunch />} />
          <Route path="/trippy-distribution" element={<TrippyDistribution />} />
          <Route path="/manage-tokens" element={<MyTokens />} />
          <Route path="/airdrop" element={<Airdrop />} />
          <Route path="/mycelium-farm" element={<MyceliumFarm />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </Provider>
  );
};

export default App;
