import { useState } from "react";

export default function DisclaimerModal() {
    const [isOpen, setIsOpen] = useState(true);
    const [isAccepted, setIsAccepted] = useState(false);

    const handleAccept = () => {
        setIsAccepted(!isAccepted);
    };

    const closeModal = () => {
        if (isAccepted) {
            setIsOpen(false);
        }
    };

    return (
        <div>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-75">
                    <div className="bg-gradient-to-b from-black to-slate-700 w-96 p-6 rounded-lg shadow-lg mx-2 md:min-w-[500px]">
                        <h2 className="text-2xl font-bold mb-4">Terms and Conditions</h2>
                        <p className="text-sm mb-4">
                            Please read and accept the terms and conditions before proceeding
                            to use this site. Your acceptance is required to continue.
                        </p>
                        <div className="max-h-40 overflow-y-auto border p-2 mb-4">
                            <p className="text-sm">
                                The author of this tool provides it "as is" without any guarantees or warranties of any kind. By using this tool, you acknowledge that the author is not responsible for any issues, errors, or losses that may occur, including but not limited to loss of funds. The use of this tool is entirely at your own risk, and the author shall not be liable for any damages or consequences arising from its use. You are responsible for ensuring that the tool is suitable for your needs and that you understand its operation and potential risks.
                            </p>
                        </div>
                        <div className="flex items-center mb-4">
                            <input
                                type="checkbox"
                                id="acceptTerms"
                                checked={isAccepted}
                                onChange={handleAccept}
                                className="mr-2"
                            />
                            <label htmlFor="acceptTerms" className="text-sm">
                                I accept the terms and conditions
                            </label>
                        </div>
                        <button
                            onClick={closeModal}
                            disabled={!isAccepted}
                            className={`w-full px-4 py-2 rounded-lg ${isAccepted ? "bg-slate-900 text-white" : "bg-slate-500"
                                }`}
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
