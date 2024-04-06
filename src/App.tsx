import PreSaleInfo from "./views/PresaleInfo";
import TokenHolders from "./views/TokenHolders";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/token-holders" element={<TokenHolders />} />
        <Route path="/" element={<PreSaleInfo />} />
      </Routes>
    </Router>
  );
};

export default App;
