import TokenHolders from "./views/TokenHolders";

const App = () => {
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
