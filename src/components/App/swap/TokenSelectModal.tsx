import IPFSImage from '../IpfsImage';
import type { Token } from '../../../utils/swap/types';

interface Props {
  open: boolean;
  onClose: () => void;
  tokens: Token[];
  excludeAddress?: string;
  onSelect: (t: Token) => void;
}

const TokenSelectModal = ({ open, onClose, tokens, excludeAddress, onSelect }: Props) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-customGray p-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-magic text-xl">Select token</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {tokens.map((t) => {
            const disabled = t.address === excludeAddress;
            return (
              <button
                key={t.address}
                disabled={disabled}
                onClick={() => {
                  onSelect(t);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-white/10'
                }`}
              >
                {t.icon ? (
                  <IPFSImage className="h-8 w-8 rounded-full" width={32} ipfsPath={t.icon} />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs">
                    {t.symbol?.[0] ?? '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{t.symbol}</div>
                  <div className="truncate text-xs text-stone-400">{t.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TokenSelectModal;
