import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import TokenHolders from "./views/TokenHolders";
import TrippyDistribution from "./views/TrippyDistribution";
import TokenLiquidity from "./views/TokenLiquidity";
import Home from "./views/Home";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/token-holders" element={<TokenHolders />} />
        <Route path="/token-liquidity" element={<TokenLiquidity />} />
        <Route path="/trippy-distribution" element={<TrippyDistribution />} />
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  );
};

export default App;
