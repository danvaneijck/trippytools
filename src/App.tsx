import PreSaleInfo from "./views/PresaleInfo";
import TokenHolders from "./views/TokenHolders";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import TrippyDistribution from "./views/TrippyDistribution";
import TokenLiquidity from "./views/TokenLiquidity";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/token-holders" element={<TokenHolders />} />
        <Route path="/token-liquidity" element={<TokenLiquidity />} />
        <Route path="/trippy-distribution" element={<TrippyDistribution />} />
        <Route path="/" element={<PreSaleInfo />} />
      </Routes>
    </Router>
  );
};

export default App;
