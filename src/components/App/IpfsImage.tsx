import { useState } from 'react';
import tokenFallback from '../../assets/token.png';
import { resolveImageUrl, directImageUrl } from '../../utils/img';

// Renders a token logo from any source (Choice registry / IPFS / https), routed
// through the wsrv.nl proxy for reliability and resizing.
//
// Staged fallback on load error: proxied (wsrv.nl) → direct source URL → generic
// token icon. wsrv.nl refuses some hosts by policy (e.g. postimg.cc → HTTP 400
// "Domain or TLD blocked by policy"), which used to drop straight to the generic
// icon; we now retry the source directly first so those logos still load.
const IPFSImage = ({ ipfsPath, className, width }: any) => {
    const [stage, setStage] = useState(0);

    // `width` is used both for layout and to request a sensibly-sized (retina)
    // image from the proxy.
    const px = typeof width === 'number' ? width : Number(width) || 48;
    const src = !ipfsPath || stage >= 2
        ? tokenFallback
        : stage === 1
            ? directImageUrl(ipfsPath)
            : resolveImageUrl(ipfsPath, px * 2);

    return (
        <img
            src={src}
            style={{ width }}
            className={className}
            alt="logo"
            loading="lazy"
            onError={() => setStage((s) => s + 1)}
        />
    );
};

export default IPFSImage;
