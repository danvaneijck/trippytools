

const IPFSImage = ({ ipfsPath, className, width }) => {
    const baseUrl = "https://ipfs.io/ipfs/";

    const getImageUrl = (path) => {
        if (path.startsWith("https://")) {
            return path;
        }
        else if (path.startsWith("ipfs://")) {
            return path.replace("ipfs://", baseUrl);
        }
        return path;
    };

    const imageUrl = getImageUrl(ipfsPath);

    return <img src={imageUrl} style={{ width: width }}
        className={className}
        alt="logo" alt="IPFS Image" />;
};

export default IPFSImage