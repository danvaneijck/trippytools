import React from "react";
import InjectiveWelcome from "./components/InjectiveWelcome";
import TokenHolders from "./views/TokenHolders";

type Props = {};

const App = (props: Props) => {
  return (
    <div
      className={"min-h-screen bg-blue-1000 overflowy-scroll p-2"}
    >
      <div
        className='text-center text-white text-2xl pt-10'
      >
        trippy tools on injective
      </div>

      <TokenHolders />

    </div>
  );
};

export default App;
