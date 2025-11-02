import { Link } from "react-router-dom";
import Footer from "../../components/App/Footer";

const ReflectionTokenLaunchpad = () => {
    return (
        <div className="flex flex-col min-h-screen bg-customGray">
            <div className="pt-20 flex-grow mx-2">
                <div className="flex justify-center items-center min-h-full">
                    <div className="w-full max-w-screen-md px-2 pb-10 text-center">
                        <div className="text-3xl font-magic mb-4">Reflection Token Launchpad</div>
                        <p className="text-slate-300 mb-10">
                            Create a new CW20 reflection token with advanced tax features or manage your existing token.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Option 1: Create New Token */}
                            <Link to="/cw20-reflection/launch" className="bg-slate-800 p-8 rounded-lg shadow-lg hover:bg-slate-700 transition-colors">
                                <h2 className="text-2xl font-bold mb-3 text-white">Create New Token</h2>
                                <p className="text-sm text-slate-400">
                                    Launch a new reflection token from scratch using our step-by-step wizard.
                                </p>
                            </Link>

                            {/* Option 2: Manage Existing Token */}
                            <Link to="/cw20-reflection/manage" className="bg-slate-800 p-8 rounded-lg shadow-lg hover:bg-slate-700 transition-colors">
                                <h2 className="text-2xl font-bold mb-3 text-white">Manage Existing Token</h2>
                                <p className="text-sm text-slate-400">
                                    Update the whitelist, tax rates, and other settings for a token you've already launched.
                                </p>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ReflectionTokenLaunchpad;