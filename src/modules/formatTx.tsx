
import { Parser } from '@json2csv/plainjs';

// Function to process the JSON data and prepare it for CSV
function processTransactions(jsonData) {
    return jsonData.map(tx => {
        const baseFields = {
            'Block Time': tx.blockTimestamp,
            'Block Number': tx.blockNumber,
            'TX Hash': tx.transactionHash,
            'TX Type': tx.type,
            'Signed': tx.signed,
            'Funds Sent': extractFundsSent(tx),
            'Funds Received': extractFundsReceived(tx),
        };

        return baseFields;
    });
}

// Helper function to extract funds sent based on transaction type
function extractFundsSent(tx) {
    switch (tx.type) {
        case 'Cancel Spot Order':
            return "N/A"
        case 'Place Spot Limit Order':
            return `${tx.offerAmount} ${tx.offerAsset}`;
        case 'Place Spot Market Order':
            return `${tx.offerAmount} ${tx.offerAsset}`;
        case 'Helix Swap':
            return `${tx.offerAmount} ${tx.offerAsset}`;
        case 'Native Token Transfer':
            return tx.isSender ? `${tx.amount} ${tx.denom}` : "N/A";
        case 'Send to Ethereum':
            return tx.receiver === tx.sender ? 'N/A' : `${tx.amount} ${tx.denom}`;
        case 'Swap':
            return `${tx.offerAmount} ${tx.offerAsset}`;
        case 'Mito LP Staking':
            return `${tx.stakedAmount} ${tx.denom}`;
        case 'Mito Vault Subscription':
            return `${JSON.stringify(tx.subscribedFunds)}`;
        case 'Create Derivatives Limit Order':
            return tx.offerAmount ? `${tx.offerAmount} ${tx.offerAsset}` : "N/A";
        case 'Create Derivatives Market Order':
            return tx.offerAmount ? `${tx.offerAmount} ${tx.offerAsset}` : "N/A";
        case 'NFT Transfer':
            return tx.isSender ? `token id ${tx.tokenId} collection ${tx.collection}` : "N/A"
        case 'MultiSend Sender':
            return `${tx.amount} ${tx.denom}`
        case 'Delegate':
            return `${tx.amount} ${tx.denom}`
        case 'CW20 Token Transfer':
            return tx.isSender ? `${tx.amount} ${tx.contractAddress}` : "N/A"
        case 'IBC Token Transfer':
            return tx.isSender ? `${tx.amount} ${tx.denom}` : "N/A"
        default:
            return 'N/A';
    }
}

// Helper function to extract funds received based on transaction type
function extractFundsReceived(tx) {
    switch (tx.type) {
        case 'Cancel Spot Order':
            return `${tx.returnAmount} ${tx.returnAsset}`;
        case 'Place Spot Limit Order':
            return 'N/A';
        case 'Helix Swap':
            return `${tx.returnAmount} ${tx.returnAsset}`;
        case 'Native Token Transfer':
            return tx.isSender ? 'N/A' : `${tx.amount} ${tx.denom}`;
        case 'MultiSend Receiver':
            return tx.receiver === tx.sender ? 'N/A' : `${tx.amount} ${tx.denom}`;
        case 'Mito Claim Stake':
            return `${tx.claimedAmount} ${tx.lpToken}`;
        case 'Mito Vault Subscription':
            return `${tx.returnAmount} ${tx.returnAsset}`;
        case 'Vault Redemption':
            return `${JSON.stringify(tx.redeemedFunds)}`;
        case 'Mito Unstake':
            return `${tx.unstakeAmount} ${tx.unstakeDenom}`;
        case 'Mito Reward Claim':
            return `${tx.amountReceived} ${tx.token}`;
        case 'Swap':
            return `${tx.returnAmount} ${tx.returnAsset}`;
        case 'Received Tokens from Order book trade':
            return `${tx.returnAmount} ${tx.returnAsset}`;
        case 'Create Derivatives Limit Order':
            return tx.returnAmount ? `${tx.returnAmount} ${tx.returnAsset}` : "N/A";
        case 'Create Derivatives Market Order':
            return tx.returnAmount ? `${tx.returnAmount} ${tx.returnAsset}` : "N/A";
        case 'Royalty Income':
            return `${tx.returnAmount} ${tx.returnAsset}`;
        case 'NFT Transfer':
            return tx.isSender ? "N/A" : `token id ${tx.tokenId} collection ${tx.collection}`
        case 'NFT Purchase':
            return tx.isSender ? "N/A" : `token id ${tx.tokenId} collection ${tx.collection}`
        case 'MultiSend Receiver':
            return `${tx.amount} ${tx.denom}`
        case 'NFT Minting':
            return `token id ${tx.tokenId} collection ${tx.contract}`
        case 'Staking Reward':
            return `${tx.amount} ${tx.denom}`
        case 'CW20 Token Transfer':
            return tx.isSender ? "N/A" : `${tx.amount} ${tx.contractAddress}`
        case 'IBC RecvPacket':
            return tx.isSender ? "N/A" : `${tx.amount} ${tx.denom}`
        default:
            return 'N/A';
    }
}

export function formatTransactionData(jsonData) {

    try {
        const processedData = processTransactions(jsonData);

        const fields = ['Block Time', 'Block Number', 'TX Hash', 'TX Type', 'Signed', 'Funds Sent', 'Funds Received'];

        const parser = new Parser({ fields });
        const csv = parser.parse(processedData);


        return processedData

    } catch (parseError) {
        console.error('Error parsing JSON file:', parseError);
    }

}