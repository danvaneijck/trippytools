import TokenHolders from "./views/TokenHolders";

const App = () => {
  return (
    <div>
      <header className="fixed top-0 left-0 w-full bg-gray-800 shadow-md z-10">
        <div className="container mx-auto flex items-center p-2">
          <img src="src//assets/trippy.webp" alt="Logo" className="h-12 mr-3" />
          <h1 className="text-lg font-semibold">trippytools</h1>
        </div>
      </header>

      <div
        className={"bg-blue-1000 overflowy-scroll p-2 mt-10"}
      >
        <TokenHolders />

        <footer className="text-white text-xs fixed inset-x-0 bottom-0 bg-gray-800 text-white p-4">
          buy me a coffee: inj1q2m26a7jdzjyfdn545vqsude3zwwtfrdap5jgz
        </footer>
      </div>
    </div>

  );
};

export default App;
