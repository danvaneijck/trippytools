import { Link } from "react-router-dom";
import { PiHandCoinsBold } from "react-icons/pi";
import Footer from "../../components/App/Footer";
import useNetworkStore from "../../store/useNetworkStore";
import { claimDropsContract } from "../../utils/claimDrops/config";
import { btnSecondary } from "../Airdrop/components/ui";

/**
 * Placeholder for the creator's manage view (`/claim-drop/manage` — freeze / set
 * expiry / clawback, plus the paginated claimant list from `fetchAllClaims`).
 *
 * Routed now so the link the create flow offers is never a 404. The public claim
 * page it used to cover as well now exists — see ClaimPage.
 */
const ClaimDropSoon = () => {
    const { networkKey } = useNetworkStore();
    const contract = claimDropsContract(networkKey);

    return (
        <div className="flex min-h-screen flex-col bg-customGray">
            <div className="mx-2 grow pt-24 pb-20">
                <div className="mx-auto max-w-xl space-y-4 px-2 text-center text-white">
                    <PiHandCoinsBold className="mx-auto text-trippyYellow" size={34} />
                    <div className="font-magic text-3xl">Manage claim drops</div>
                    <p className="text-sm text-slate-400">
                        The manage view (freeze, expiry, clawback, claimant list) is being built. Your drops
                        are live and claimable in the meantime — every one of those actions is optional.
                    </p>

                    <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-xs">
                        <div className="flex flex-wrap gap-x-2">
                            <span className="text-slate-400">network</span>
                            <span className="capitalize text-slate-200">{networkKey}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2">
                            <span className="text-slate-400">contract</span>
                            <span className="break-all font-mono text-slate-200">
                                {contract || "not deployed yet"}
                            </span>
                        </div>
                    </div>

                    <Link to="/claim-drop">
                        <div className={`${btnSecondary} w-full`}>Create a claim drop</div>
                    </Link>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ClaimDropSoon;
