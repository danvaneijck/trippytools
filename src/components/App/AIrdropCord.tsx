import { useRef } from "react";
import moment from "moment";
import { PiParachute } from "react-icons/pi";
import { toPng } from "html-to-image";
import shroomi from "../../assets/mush_sticker.png";
import shroomlogo from "../../assets/shroom.jpg";

import useTokenStore from "../../store/useTokenStore";

type Props = {
    log: {
        amount_dropped: string;
        criteria: string;
        description: string;
        time: string;
        fee: string;
        tx_hashes: string;
        token: { symbol: string };
        total_participants: number;
        wallet: { address: string };
    };
};

function humanReadableAmount(n: number | string) {
    const units = ["", "k", "m", "b", "t"];
    let num = Number(n);
    let i = 0;
    while (num >= 1000 && i < units.length - 1) {
        num /= 1000;
        i++;
    }
    return `${num.toFixed(num >= 10 ? 0 : 2)}${units[i]}`;
}

const AirdropCard = ({ log }: Props) => {
    const cardRef = useRef<HTMLDivElement>(null);

    const { tokens } = useTokenStore()

    const tokenDetails = tokens.find(token => token.address == log.token.address)

    const copyPng = async () => {
        if (!cardRef.current) return;

        const dataUrl = await toPng(cardRef.current, {
            pixelRatio: 2,
            filter: (node) =>
                !(node.classList && node.classList.contains("no-export")),
        });

        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);
    };

    return (
        <div
            ref={cardRef}
            className="
        relative overflow-hidden rounded-2xl p-4 mb-6 text-sm
        bg-[#002B3D]
        shadow-lg ring-1 ring-white/10 backdrop-blur-md
        transition hover:scale-[1.02] hover:shadow-2xl
      "
        >
            {tokenDetails && (
                <img
                    src={tokenDetails.icon}
                    alt={`${tokenDetails.symbol} logo`}
                    className="
                        absolute inset-0
                        w-full h-full object-contain
                        opacity-20
                        pointer-events-none
                        select-none
                    "
                />
            )}
            {/* floating shroomi */}
            <img
                src={shroomi}
                alt="Shroomi"
                className="absolute w-28 right-3 top-2 drop-shadow-lg select-none pointer-events-none"
            />

            <button
                onClick={copyPng}
                className="no-export absolute top-40 right-2 flex items-center gap-1
                   rounded-md bg-white/10 hover:bg-white/20 px-2 py-1
                   text-[11px] font-medium backdrop-blur"
            >
                {/* <ClipboardIcon className="w-4 h-4" /> */}
                Copy img
            </button>



            <div className="flex items-center text-indigo-100 mb-1 text-xl font-bold">
                <PiParachute className="mr-2 text-xl" />
                <p className="text-lg">Airdropped {log.token.symbol} to {log.total_participants} wallets</p>
                {/* {tokenDetails && <img
                    src={tokenDetails.icon} />
                } */}
            </div>

            <a
                href={`https://explorer.injective.network/account/${log.wallet.address}`}
                className="block text-sm mb-2 hover:text-indigo-400"
            >
                By wallet:&nbsp;
                <span className="font-mono">
                    {log.wallet.address.slice(0, 8)}…{log.wallet.address.slice(-8)}
                </span>

            </a>

            <p>Time: {moment(log.time).fromNow()}</p>

            <p className="mt-2 whitespace-pre-line text-lg font-semibold">
                {log.criteria.toLocaleUpperCase()}
                <br />
                {log.description.toLocaleUpperCase()}
            </p>

            <div className="mt-2">
                <b>TX hashes:</b>
                {log.tx_hashes.split(",").map((hash, i) => (
                    <a
                        key={i}
                        href={`https://explorer.injective.network/transaction/${hash}`}
                        className="block text-indigo-100 hover:text-indigo-400 text-xs"
                    >
                        explorer.injective.network/…/{hash.slice(0, 6)}…
                    </a>
                ))}
            </div>

            <div className="text-right mt-3 text-sm flex flex-row items-center justify-end">
                fee: {humanReadableAmount(log.fee)} SHROOM
                <img src={shroomlogo} className="w-8 rounded-full ml-2" />
            </div>
        </div>
    );
};

export default AirdropCard;
