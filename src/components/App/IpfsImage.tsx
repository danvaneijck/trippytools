import { useState } from 'react';
import tokenFallback from '../../assets/token.png';
import { resolveImageUrl } from '../../utils/img';

// Renders a token logo from any source (Choice registry / IPFS / https), routed
// through the wsrv.nl proxy for reliability and resizing. Falls back to a generic
// token icon if the source still fails to load.
const IPFSImage = ({ ipfsPath, className, width }: any) => {
    const [errored, setErrored] = useState(false);

    // `width` is used both for layout and to request a sensibly-sized (retina)
    // image from the proxy.
    const px = typeof width === 'number' ? width : Number(width) || 48;
    const src =
        errored || !ipfsPath ? tokenFallback : resolveImageUrl(ipfsPath, px * 2);

    return (
        <img
            src={src}
            style={{ width }}
            className={className}
            alt="logo"
            loading="lazy"
            onError={() => setErrored(true)}
        />
    );
};

export default IPFSImage;
