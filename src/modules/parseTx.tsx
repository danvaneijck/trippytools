import { Buffer } from "buffer";

export function processAccountTx(data, walletAddress) {

    const taxData = [];

    let breakLoop = false

    data.forEach(transaction => {
        const signed = transaction.signatures.some(signature => signature.address === walletAddress);
        if (transaction.errorLog.length > 0) return


        transaction.messages.forEach((message, index) => {
            try {

                // NFT purchase
                if (message.message.msg && typeof message.message.msg === 'string' && message.message.msg.includes("buy_token")) {
                    const msgContent = JSON.parse(message.message.msg);
                    const tokenId = msgContent.buy_token.token_id;
                    const collection = msgContent.buy_token.contract_address

                    let added = false

                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index
                        log.events.forEach(event => {
                            if (event.type === "coin_received") {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");

                                const returnAsset = amountAttribute.value.replace(/^\d+/, '').trim();
                                const returnAmount = Number(amountAttribute.value.match(/^\d+/)[0])

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === walletAddress &&
                                    parseInt(msgIndex) === index
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "Royalty Income",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        tokenId: tokenId,
                                        collection: collection,
                                        returnAsset,
                                        returnAmount,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        // NFT purchase
                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm") {
                                    const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                    const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                    const recipientAttribute = event.attributes.find(attr => attr.key === "recipient");
                                    const tokenIdAttribute = event.attributes.find(attr => attr.key === "token_id");

                                    if (
                                        actionAttribute &&
                                        actionAttribute.value === "transfer_nft" &&
                                        tokenIdAttribute &&
                                        tokenIdAttribute.value === tokenId &&
                                        (senderAttribute.value == walletAddress || recipientAttribute.value == walletAddress)
                                    ) {
                                        added = true
                                        taxData.push({
                                            type: "NFT Purchase",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            tokenId: tokenId,
                                            collection: collection,
                                            sender: senderAttribute.value,
                                            recipient: recipientAttribute.value,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    }

                    if (!added) {
                        console.log("Royalty Income 1")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'object' &&
                    message.message.msg.buy_token
                ) {
                    const msgContent = message.message.msg;
                    const tokenId = msgContent.buy_token.token_id;
                    const collection = msgContent.buy_token.contract_address;

                    let added = false

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "coin_received") {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;

                                const returnAsset = amountAttribute.value.replace(/^\d+/, '').trim();
                                const returnAmount = Number(amountAttribute.value.match(/^\d+/)[0])

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === walletAddress &&
                                    msgIndexAttribute !== undefined &&
                                    parseInt(msgIndexAttribute) === index
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "Royalty Income",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        tokenId: tokenId,
                                        collection: collection,
                                        returnAsset,
                                        returnAmount,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Royalty Income 2")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'string' &&
                    message.message.msg.includes("send_nft")
                ) {
                    const msgContent = JSON.parse(message.message.msg);
                    const tokenId = msgContent.send_nft.token_id;
                    const collection = msgContent.send_nft.contract;

                    let added = false

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "coin_received") {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;

                                const returnAsset = amountAttribute.value.replace(/^\d+/, '').trim();
                                const returnAmount = Number(amountAttribute.value.match(/^\d+/)[0]);

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === walletAddress &&
                                    msgIndexAttribute !== undefined &&
                                    parseInt(msgIndexAttribute) === index
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "Royalty Income",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        tokenId: tokenId,
                                        collection: collection,
                                        returnAsset,
                                        returnAmount,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        transaction.logs.forEach(log => {
                            const msgIndex = log.msg_index || 0
                            log.events.forEach(event => {
                                if (event.type === "wasm") {
                                    const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                    const recipientAttribute = event.attributes.find(attr => attr.key === "recipient");
                                    const tokenIdAttribute = event.attributes.find(attr => attr.key === "token_id");

                                    if (senderAttribute && recipientAttribute &&
                                        parseInt(msgIndex) === index
                                    ) {
                                        added = true;
                                        taxData.push({
                                            type: "Send NFT",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: senderAttribute.value,
                                            recipient: recipientAttribute.value,
                                            tokenId: tokenIdAttribute ? tokenIdAttribute.value : null,
                                            collection: collection,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    }


                    if (!added) {
                        console.log("Royalty Income 3")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'object' &&
                    message.message.msg.send_nft
                ) {
                    const msgContent = message.message.msg;
                    const tokenId = msgContent.send_nft.token_id;
                    const collection = msgContent.send_nft.contract;

                    let added = false

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "coin_received") {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;

                                const returnAsset = amountAttribute.value.replace(/^\d+/, '').trim();
                                const returnAmount = Number(amountAttribute.value.match(/^\d+/)[0]);

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === walletAddress &&
                                    msgIndexAttribute !== undefined &&
                                    parseInt(msgIndexAttribute) === index
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "Royalty Income",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        tokenId: tokenId,
                                        collection: collection,
                                        returnAmount,
                                        returnAsset,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'string' &&
                    message.message.msg.includes("transfer_nft")
                ) {
                    const msgContent = JSON.parse(message.message.msg);
                    const tokenId = msgContent.transfer_nft.token_id;
                    const recipient = msgContent.transfer_nft.recipient;
                    const collection = message.message.contract;

                    let added = false

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                const recipientAttribute = event.attributes.find(attr => attr.key === "recipient");
                                const tokenIdAttribute = event.attributes.find(attr => attr.key === "token_id");

                                if (
                                    actionAttribute &&
                                    actionAttribute.value === "transfer_nft" &&
                                    senderAttribute &&
                                    recipientAttribute &&
                                    recipientAttribute.value === recipient &&
                                    tokenIdAttribute &&
                                    tokenIdAttribute.value === tokenId
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "NFT Transfer",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        tokenId: tokenId,
                                        collection: collection,
                                        recipient: recipient,
                                        sender: senderAttribute.value,
                                        isSender: senderAttribute.value === walletAddress,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("NFT Transfer")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                // send native denom
                else if (message.type === "/cosmos.bank.v1beta1.MsgSend") {
                    let added = false
                    const { from_address, to_address, amount } = message.message;
                    const denomAmount = amount[0];

                    const adjustedAmount = parseFloat(denomAmount.amount)

                    if (from_address == walletAddress || to_address == walletAddress) {
                        added = true
                        taxData.push({
                            type: "Native Token Transfer",
                            blockNumber: transaction.blockNumber,
                            blockTimestamp: transaction.blockTimestamp,
                            transactionHash: transaction.hash,
                            isSender: from_address == walletAddress,
                            sender: from_address,
                            receiver: to_address,
                            denom: denomAmount.denom,
                            amount: adjustedAmount,
                            signed: signed
                        });
                    }


                    // if (!added) {
                    //     console.log("Native Token Transfer")
                    //     console.log(JSON.stringify(transaction, null, 2))

                    //     breakLoop = true
                    // }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'string' &&
                    message.message.msg.includes("create_asset_meta")
                ) {
                    let added = false
                    const msgContent = JSON.parse(message.message.msg);
                    const tokenAddress = msgContent.create_asset_meta.asset_info.token.contract_addr;
                    const nonce = msgContent.create_asset_meta.nonce;
                    const collection = message.contract;

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const contractAddressAttribute = event.attributes.find(attr => attr.key === "_contract_address");
                                const tokenChainAttribute = event.attributes.find(attr => attr.key === "meta.token_chain");
                                const tokenAttribute = event.attributes.find(attr => attr.key === "meta.token");
                                const nonceAttribute = event.attributes.find(attr => attr.key === "meta.nonce");
                                const blockTimeAttribute = event.attributes.find(attr => attr.key === "meta.block_time");

                                if (
                                    contractAddressAttribute &&
                                    tokenChainAttribute &&
                                    tokenAttribute &&
                                    nonceAttribute &&
                                    blockTimeAttribute &&
                                    tokenAttribute.value === tokenAddress
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "Token Attestation",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        tokenAddress: tokenAddress,
                                        contractAddress: contractAddressAttribute.value,
                                        tokenChain: tokenChainAttribute.value,
                                        nonce: nonce,
                                        blockTime: new Date(Number(blockTimeAttribute.value) * 1000).toISOString(),
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Token Attestation")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type == "/cosmos.authz.v1beta1.MsgRevoke"
                ) {

                }

                else if (
                    message.type === "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
                ) {
                    let added = false
                    const delegatorAddress = message.message.delegator_address;
                    const validatorAddress = message.message.validator_address;

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "withdraw_rewards") {
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const validatorAttribute = event.attributes.find(attr => attr.key === "validator");
                                const delegatorAttribute = event.attributes.find(attr => attr.key === "delegator");

                                if (
                                    amountAttribute &&
                                    validatorAttribute &&
                                    validatorAttribute.value === validatorAddress
                                    // delegatorAttribute &&
                                    // delegatorAttribute.value === delegatorAddress
                                ) {
                                    added = true
                                    taxData.push({
                                        type: "Staking Reward",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        delegatorAddress: delegatorAddress,
                                        validatorAddress: validatorAddress,
                                        denom: "inj",
                                        amount: Number(amountAttribute.value.split("inj")[0]),
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Staking Reward")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmos.gov.v1.MsgVote" &&
                    message.message.voter
                ) {
                    let added = false
                    const voter = message.message.voter;
                    const proposalId = message.message.proposal_id;
                    const option = message.message.option;

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "proposal_vote") {
                                const proposalIdAttribute = event.attributes.find(attr => attr.key === "proposal_id");

                                if (
                                    proposalIdAttribute &&
                                    proposalIdAttribute.value === proposalId
                                ) {

                                    added = true
                                    taxData.push({
                                        type: "Governance Vote",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        voter: voter,
                                        proposalId: proposalId,
                                        voteOption: option,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Governance Vote")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmos.bank.v1beta1.MsgMultiSend" &&
                    message.message.outputs
                ) {
                    let added = false

                    if (message.message.inputs[0].address == walletAddress) {
                        added = true
                        message.message.outputs.forEach(output => {
                            output.coins.forEach(coin => {
                                taxData.push({
                                    type: "MultiSend Sender",
                                    blockNumber: transaction.blockNumber,
                                    blockTimestamp: transaction.blockTimestamp,
                                    transactionHash: transaction.hash,
                                    receiver: output.address,
                                    denom: coin.denom,
                                    amount: Number(coin.amount),
                                    signed: signed
                                });
                            });

                        });
                    }
                    else {
                        message.message.outputs.forEach(output => {
                            if (output.address === walletAddress) {
                                output.coins.forEach(coin => {
                                    added = true
                                    taxData.push({
                                        type: "MultiSend Receiver",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        receiver: output.address,
                                        denom: coin.denom,
                                        amount: Number(coin.amount),
                                        signed: signed
                                    });
                                });
                            }
                        });
                    }

                    if (!added) {
                        console.log("MultiSend")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg && typeof message.message.msg === 'string' && message.message.msg.includes("use") && !message.message.msg.includes("transfer") && !message.message.msg.includes("LpTransfer")
                ) {
                    let added = false
                    const msgContent = JSON.parse(message.message.msg);
                    const contractAddress = message.message.contract;
                    const sender = message.message.sender;
                    const funds = Number(message.message.funds.split("inj")[0]) / Math.pow(10, 18); // Convert to INJ
                    const tokenNumber = msgContent.token_number;
                    const mintLimit = msgContent.mint_limit;
                    const proof = msgContent.proof;

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "transfer_nft")) {
                                const tokenId = event.attributes.find(attr => attr.key === "token_id").value;
                                const recipient = event.attributes.find(attr => attr.key === "recipient").value;
                                const senderContract = event.attributes.find(attr => attr.key === "sender").value;
                                const contract = event.attributes.find(attr => attr.key === "_contract_address").value;

                                if (recipient === sender) {
                                    added = true
                                    taxData.push({
                                        type: "NFT Minting",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        contract: contract,
                                        sender: sender,
                                        tokenId: tokenId,
                                        mintLimit: mintLimit,
                                        fundsSpent: funds,
                                        proof: proof,
                                        recipient: recipient,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("NFT Minting")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" &&
                    message.message.msg &&
                    message.message.msg.execute_routes
                ) {
                    let added = false
                    const msgContent = message.message.msg.execute_routes;
                    const offerAsset = msgContent.offer_asset_info.native_token?.denom || msgContent.offer_asset_info.token.contract_addr;
                    const routes = msgContent.routes;
                    const minimumReceive = Number(msgContent.minimum_receive)
                    const contractAddress = message.message.contract;
                    const sender = message.message.sender;

                    // Extract transaction details from logs
                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach(event => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "helix_swap")) {
                                const returnAmountAttr = event.attributes.find(attr => attr.key === "return_amount");
                                const returnAssetAttr = event.attributes.find(attr => attr.key === "ask_asset");

                                const returnAmount = returnAmountAttr ? Number(returnAmountAttr.value) : null;
                                const returnAsset = returnAssetAttr ? returnAssetAttr.value : null;

                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver")

                                if (receiverAttribute.value == walletAddress) {
                                    added = true

                                    taxData.push({
                                        type: "Helix Swap",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contract: contractAddress,
                                        offerAsset: offerAsset,
                                        routes: routes,
                                        minimumReceive: minimumReceive,
                                        returnAmount: returnAmount,
                                        returnAsset: returnAsset,
                                        signed: signed
                                    });
                                }

                            }
                            else if (event.type === "wasm" && event.attributes.some(attr => attr.key === "hallswap")) {
                                const returnAmountAttr = event.attributes.find(attr => attr.key === "return_amount");
                                const returnAssetAttr = event.attributes.find(attr => attr.key === "return_asset");
                                const offerAmountAttr = event.attributes.find(attr => attr.key === "offer_amount");

                                const returnAmount = returnAmountAttr ? Number(returnAmountAttr.value) : null;
                                const returnAsset = returnAssetAttr ? returnAssetAttr.value : null;



                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver")

                                if (receiverAttribute.value == walletAddress) {
                                    added = true
                                    taxData.push({
                                        type: "Swap",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contract: contractAddress,
                                        offerAsset: offerAsset,
                                        offerAmount: offerAmountAttr.value,
                                        routes: routes,
                                        minimumReceive: minimumReceive,
                                        returnAsset: returnAsset,
                                        returnAmount: returnAmount,
                                        signed: signed
                                    });
                                }

                            }

                            // TODO check this
                            else if (event.type == "coin_received" && !added) {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === walletAddress &&
                                    parseInt(msgIndex) === index
                                ) {
                                    let token = "factory" + amountAttribute.value.split("factory")[1]
                                    let amount = Number(amountAttribute.value.split("factory")[0])
                                    if (!amountAttribute.value.split("factory")[1]) {
                                        token = "inj"
                                        amount = Number(amountAttribute.value.split("inj")[0])
                                    }

                                    added = true
                                    taxData.push({
                                        type: "Received Tokens from Order book trade",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        returnAsset: token,
                                        returnAmount: amount,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Swap 1")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    message.message.msg.includes("\"withdraw\"")
                ) {
                    let added = false
                    const contractAddress = message.message.contract;

                    // Extract details from logs
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "withdraw")) {
                                const amountAttr = event.attributes.find(attr => attr.key === "amount");
                                const ownerAttr = event.attributes.find(attr => attr.key === "owner");

                                const withdrawnAmount = amountAttr ? Number(amountAttr.value) / Math.pow(10, 18) : null; // Adjust decimals
                                const owner = ownerAttr ? ownerAttr.value : null;

                                added = true
                                taxData.push({
                                    type: "Revenue Share Withdrawal",
                                    blockNumber: transaction.blockNumber,
                                    blockTimestamp: transaction.blockTimestamp,
                                    transactionHash: transaction.hash,
                                    contract: contractAddress,
                                    owner: owner,
                                    amount: withdrawnAmount,
                                    gasUsed: transaction.gasUsed,
                                    gasFee: Number(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18),
                                    signed: signed
                                });
                            }
                        });
                    });

                    if (!added) {
                        console.log("Revenue Share Withdrawal")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.exchange.v1beta1.MsgPrivilegedExecuteContract" &&
                    message.message.data &&
                    JSON.parse(message.message.data).args?.msg?.redeem?.redemption_type
                ) {
                    let added = false
                    const { sender, funds, contract_address, data: rawData } = message.message;

                    const dataContent = JSON.parse(rawData);
                    const redemptionType = dataContent.args?.msg?.redeem?.redemption_type;
                    const traderSubaccountId = dataContent.args?.trader_subaccount_id;
                    const vaultSubaccountId = dataContent.args?.vault_subaccount_id;

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm-lp_balance_changed") {
                                const contractAddress = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                const burnAmount = event.attributes.find(attr => attr.key === "burn_amount")?.value;
                                const redeemedFunds = event.attributes.find(attr => attr.key === "redeemed_funds")?.value;
                                const traderAddress = event.attributes.find(attr => attr.key === "trader_address")?.value;

                                if (contractAddress && burnAmount && redeemedFunds && traderAddress === walletAddress) {
                                    const redeemedFundsParsed = JSON.parse(redeemedFunds).map(fund => ({
                                        denom: fund.denom,
                                        amount: Number(fund.amount)
                                    }));

                                    added = true
                                    taxData.push({
                                        type: "Vault Redemption",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender,
                                        contractAddress,
                                        redemptionType,
                                        traderSubaccountId,
                                        vaultSubaccountId,
                                        burnAmount: Number(burnAmount),
                                        redeemedFunds: redeemedFundsParsed,
                                        signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Vault Redemption")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg === "{\"Claim\":{}}") {
                    let added = false
                    const { sender, contract } = message.message;

                    // Extract logs for the claim
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm-launchpad_claimed") {
                                const contractAddress = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                const subscriber = event.attributes.find(attr => attr.key === "subscriber")?.value;
                                const tokensToSendImmediately = event.attributes.find(attr => attr.key === "tokens_to_send_immediately")?.value;
                                const tokensToVest = event.attributes.find(attr => attr.key === "tokens_to_vest")?.value;

                                if (subscriber === walletAddress) {
                                    const tokensClaimed = tokensToSendImmediately
                                        ? JSON.parse(tokensToSendImmediately).map(token => ({
                                            denom: token.denom,
                                            amount: Number(token.amount)
                                        }))
                                        : [];

                                    const tokensVested = tokensToVest
                                        ? JSON.parse(tokensToVest).map(token => ({
                                            denom: token.denom,
                                            amount: Number(token.amount)
                                        }))
                                        : [];

                                    added = true
                                    taxData.push({
                                        type: "Launchpad Claim",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender,
                                        contractAddress,
                                        tokensClaimed,
                                        tokensVested,
                                        signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Launchpad Claim")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg === "{\"Subscribe\":{}}") {
                    let added = false
                    const { sender, contract, funds } = message.message;

                    // Extract logs for subscription details
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm-launchpad_subscribed") {
                                const contractAddress = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                const subscriber = event.attributes.find(attr => attr.key === "subscriber")?.value;
                                const newSubscribedAmount = event.attributes.find(attr => attr.key === "new_subscribed_amount")?.value;
                                const diff = event.attributes.find(attr => attr.key === "diff")?.value;
                                const newTotalAmount = event.attributes.find(attr => attr.key === "new_total_amount")?.value;
                                const targetQuoteSubscription = event.attributes.find(attr => attr.key === "target_quote_subscription_incl_vault")?.value;

                                if (subscriber === walletAddress) {
                                    added = true
                                    taxData.push({
                                        type: "Launchpad Subscription",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender,
                                        contractAddress,
                                        subscribedAmount: Number(newSubscribedAmount) / Math.pow(10, 18),
                                        subscriptionDiff: Number(diff) / Math.pow(10, 18),
                                        totalSubscribed: Number(newTotalAmount) / Math.pow(10, 18),
                                        targetSubscription: Number(targetQuoteSubscription) / Math.pow(10, 18),
                                        fundsSpent: Number(funds.split("inj")[0]) / Math.pow(10, 18),
                                        signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Launchpad Subscription")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg === "{\"bond\":{}}") {
                    let added = false
                    const { sender, contract, funds } = message.message;

                    // Extract logs for bonding details
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const contractAddress = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                const action = event.attributes.find(attr => attr.key === "action")?.value;
                                const owner = event.attributes.find(attr => attr.key === "owner")?.value;
                                const amount = event.attributes.find(attr => attr.key === "amount")?.value;

                                if (action === "bond" && owner === walletAddress) {
                                    added = true
                                    taxData.push({
                                        type: "Bonding",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        owner,
                                        contractAddress,
                                        bondedAmount: Number(amount) / Math.pow(10, 18), // Convert to readable format
                                        fundsTransferred: funds,
                                        signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Bonding")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("end_auction")) {
                    let added = false
                    const { sender, contract } = message.message;

                    // Extract auction details from logs
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const contractAddress = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                const auctionId = event.attributes.find(attr => attr.key === "auction_id")?.value;
                                const seller = event.attributes.find(attr => attr.key === "seller")?.value;
                                const tokenId = event.attributes.find(attr => attr.key === "token_id")?.value;
                                const highestBidder = event.attributes.find(attr => attr.key === "highest_bidder")?.value;
                                const currency = event.attributes.find(attr => attr.key === "currency")?.value;
                                const amount = event.attributes.find(attr => attr.key === "amount")?.value;

                                if (auctionId && seller && tokenId && highestBidder) {
                                    added = true
                                    taxData.push({
                                        type: "End NFT Auction",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        auctionId,
                                        seller,
                                        tokenId,
                                        highestBidder,
                                        currency,
                                        highestBid: Number(amount),
                                        contractAddress,
                                        signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        transaction.logs.forEach(log => {
                            const msgIndex = log.msg_index
                            log.events.forEach(event => {
                                if (event.type === "coin_received") {
                                    const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                    const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                    const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;

                                    const returnAsset = amountAttribute.value.replace(/^\d+/, '').trim();
                                    const returnAmount = Number(amountAttribute.value.match(/^\d+/)[0]);

                                    if (
                                        receiverAttribute &&
                                        receiverAttribute.value === walletAddress &&
                                        msgIndex === index
                                    ) {
                                        added = true
                                        taxData.push({
                                            type: "Royalty Income",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            returnAmount,
                                            returnAsset,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    }

                    // if (!added) {
                    //     console.log("End NFT Auction")
                    //     console.log(JSON.stringify(transaction.hash, null, 2))

                    //     breakLoop = true
                    // }
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("stake_voting_tokens")) {
                    let added = false
                    const { sender, contract, funds } = message.message;

                    // Extract staking details from logs
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "staking")) {
                                const contractAddress = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                const stakingAmount = event.attributes.find(attr => attr.key === "amount")?.value;

                                if (contractAddress && stakingAmount) {
                                    added = true
                                    taxData.push({
                                        type: "Staking Voting Tokens",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender,
                                        stakingAmount: Number(stakingAmount) / Math.pow(10, 18), // Convert to readable format
                                        token: funds.split("/")[1], // Extract token identifier from funds
                                        contractAddress,
                                        signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Staking Voting Tokens")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("claim") && transaction.memo === "talis") {
                    let added = false
                    const { sender, contract, msg } = message.message;
                    const claimDetails = JSON.parse(msg).claim;

                    // Extract claim details from logs
                    const log = transaction.logs.find(log => log.msg_index === index);
                    if (log) {
                        const claimEvent = log.events.find(event => event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "claim"));

                        if (claimEvent) {
                            const claimedAmount = claimEvent.attributes.find(attr => attr.key === "amount")?.value;
                            const contractAddress = claimEvent.attributes.find(attr => attr.key === "_contract_address")?.value;

                            added = true
                            taxData.push({
                                type: "Claiming Drops",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                sender,
                                contractAddress,
                                dropId: claimDetails.drop_id,
                                maxClaimableAmount: Number(claimDetails.max_claimable_amount) / Math.pow(10, 18), // Convert to readable format
                                claimedAmount: claimedAmount ? Number(claimedAmount) / Math.pow(10, 18) : null,
                                signed: transaction.signatures.some(signature => signature.address === walletAddress)
                            });
                        }
                    }
                    if (!added) {
                        console.log("Staking Voting Tokens")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }

                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'object' &&
                    message.message.msg.swap
                ) {
                    let added = false
                    const swapData = message.message.msg.swap;
                    const marketId = swapData.market_id;
                    const minimumReceive = Number(swapData.minimum_receive)

                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                const offerAmountAttribute = event.attributes.find(attr => attr.key === "offer_amount");
                                const returnAmountAttribute = event.attributes.find(attr => attr.key === "return_amount");
                                const recipientAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                const offerAssetAttribute = event.attributes.find(attr => attr.key === "offer_asset");
                                const askAssetAttribute = event.attributes.find(attr => attr.key === "ask_asset");

                                const contractAddressAttribute = event.attributes.find(attr => attr.key === "_contract_address");


                                if (
                                    actionAttribute &&
                                    (actionAttribute.value === "helix_swap" || actionAttribute.value === "swap") &&
                                    recipientAttribute &&
                                    senderAttribute &&
                                    recipientAttribute.value === walletAddress
                                ) {
                                    const returnAmount = returnAmountAttribute
                                        ? Number(returnAmountAttribute.value)
                                        : null;

                                    added = true
                                    taxData.push({
                                        type: "Swap",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        marketId: marketId,
                                        contractAddress: contractAddressAttribute.value,
                                        offerAsset: offerAssetAttribute.value,
                                        offerAmount: offerAmountAttribute.value,
                                        returnAsset: askAssetAttribute.value,
                                        returnAmount: returnAmount,
                                        minimumReceive: minimumReceive,
                                        sender: senderAttribute.value,
                                        recipient: recipientAttribute.value,
                                        signed: signed
                                    });
                                }


                                const input = event.attributes.find(attr => attr.key === "input");
                                const output = event.attributes.find(attr => attr.key === "output")
                                const amount = event.attributes.find(attr => attr.key === "amount")

                                if (input && input.value == "factory/inj1zaem9jqplp08hkkd5vcl6vmvala9qury79vfj4/point") {
                                    added = true
                                    taxData.push({
                                        type: "Swap Point to Black",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        input: input.value,
                                        output: output.value,
                                        signed: signed
                                    });
                                }
                            }

                            if (event.type == "coin_received") {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === walletAddress &&
                                    parseInt(msgIndex) === index
                                ) {
                                    let token = "factory" + amountAttribute.value.split("factory")[1]
                                    let amount = Number(amountAttribute.value.split("factory")[0])
                                    if (!amountAttribute.value.split("factory")[1]) {
                                        token = "inj"
                                        amount = Number(amountAttribute.value.split("inj")[0])
                                    }


                                    added = true
                                    taxData.push({
                                        type: "Received Tokens from Order book trade",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        token: token,
                                        amountReceived: amount,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Swap 2")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'string' &&
                    message.message.msg.includes("LpTransfer")
                ) {
                    let added = false
                    try {


                        const contractAddress = message.message.contract;


                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "transfer") {
                                    const recipientAttribute = event.attributes.find(attr => attr.key === "recipient");
                                    const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                    const amountAttribute = event.attributes.find(attr => attr.key === "amount");

                                    if (

                                        recipientAttribute &&
                                        senderAttribute &&
                                        recipientAttribute.value == walletAddress
                                    ) {
                                        const recipient = recipientAttribute.value;
                                        const sender = senderAttribute.value;
                                        const amount = amountAttribute.value.split("factory")[0]

                                        added = true
                                        taxData.push({
                                            type: "LpTransfer",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            contractAddress: contractAddress,
                                            sender: sender,
                                            recipient: recipient,
                                            amount: amount,
                                            funds: amountAttribute.value,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse message.msg:", error);
                    }

                    if (!added) {
                        console.log("LpTransfer")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'string' &&
                    message.message.msg.includes("claim_stake")
                ) {
                    let added = false
                    try {
                        const parsedMsg = JSON.parse(message.message.msg);
                        const claimStakeData = parsedMsg.claim_stake;

                        if (!claimStakeData) return;

                        const lpToken = claimStakeData.lp_token;
                        const senderAddress = message.message.sender;
                        const contractAddress = message.message.contract;

                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm-stake_updated") {
                                    const stakerAttribute = event.attributes.find(attr => attr.key === "staker");
                                    const diffAttribute = event.attributes.find(attr => attr.key === "diff");
                                    const denomAttribute = event.attributes.find(attr => attr.key === "denom");
                                    const directionAttribute = event.attributes.find(attr => attr.key === "direction");

                                    if (
                                        stakerAttribute &&
                                        diffAttribute &&
                                        denomAttribute &&
                                        denomAttribute.value === lpToken &&
                                        stakerAttribute.value === senderAddress &&
                                        directionAttribute &&
                                        directionAttribute.value === "1" // Direction "1" indicates claiming
                                    ) {
                                        const claimedAmount = Number(diffAttribute.value) / Math.pow(10, 18);
                                        added = true
                                        taxData.push({
                                            type: "Mito Claim Stake",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            contractAddress: contractAddress,
                                            sender: senderAddress,
                                            lpToken: lpToken,
                                            claimedAmount: claimedAmount,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse claim_stake message:", error);
                    }
                    if (!added) {
                        console.log("Mito Claim Stake")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.message.msg &&
                    typeof message.message.msg === 'string' &&
                    message.message.msg.includes("unstake")
                ) {
                    let added = false
                    try {
                        const parsedMsg = JSON.parse(message.message.msg);
                        const unstakeData = parsedMsg.unstake;

                        if (!unstakeData || !unstakeData.coin) return;

                        const unstakeDenom = unstakeData.coin.denom;
                        const unstakeAmountRaw = unstakeData.coin.amount;
                        const unstakeAmount = Number(unstakeAmountRaw)
                        const senderAddress = message.message.sender;
                        const contractAddress = message.message.contract;

                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm-stake_updated") {
                                    const stakerAttribute = event.attributes.find(attr => attr.key === "staker");
                                    const denomAttribute = event.attributes.find(attr => attr.key === "denom");
                                    const diffAttribute = event.attributes.find(attr => attr.key === "diff");
                                    const directionAttribute = event.attributes.find(attr => attr.key === "direction");
                                    const rewardsPerTokenAttribute = event.attributes.find(attr => attr.key === "rewards_per_token");

                                    if (
                                        stakerAttribute &&
                                        denomAttribute &&
                                        denomAttribute.value === unstakeDenom &&
                                        stakerAttribute.value === senderAddress &&
                                        diffAttribute &&
                                        directionAttribute &&
                                        directionAttribute.value === "1" // Direction "1" indicates unstaking
                                    ) {
                                        const rewards = rewardsPerTokenAttribute
                                            ? JSON.parse(rewardsPerTokenAttribute.value)
                                            : [];
                                        const formattedRewards = rewards.map(reward => ({
                                            denom: reward.denom,
                                            amount: parseFloat(reward.amount)
                                        }));

                                        added = true
                                        taxData.push({
                                            type: "Mito Unstake",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            contractAddress: contractAddress,
                                            sender: senderAddress,
                                            unstakeDenom: unstakeDenom,
                                            unstakeAmount: unstakeAmount,
                                            rewards: formattedRewards,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse unstake message:", error);
                    }
                    if (!added) {
                        console.log("Mito Unstake")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.exchange.v1beta1.MsgCreateSpotMarketOrder" &&
                    message.message.order
                ) {
                    let added = false

                    try {
                        const order = message.message.order;
                        const marketId = order.market_id;
                        const subaccountId = order.order_info.subaccount_id;
                        const feeRecipient = order.order_info.fee_recipient;
                        const priceRaw = order.order_info.price;
                        const quantityRaw = order.order_info.quantity;
                        const orderType = order.order_type;

                        // Convert price and quantity to human-readable format
                        const price = Number(priceRaw);
                        const quantity = Number(quantityRaw);

                        // Parse logs for details like spent and received coins
                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "coin_spent") {
                                    const spender = event.attributes.find(attr => attr.key === "spender")?.value;
                                    const spentAmountRaw = event.attributes.find(attr => attr.key === "amount")?.value;

                                    if (spender === message.message.sender && spentAmountRaw) {
                                        const spentAsset = spentAmountRaw.replace(/^\d+/, '').trim(); // Extract the asset symbol
                                        const spentAmount = Number(spentAmountRaw.match(/^\d+/)[0])

                                        added = true
                                        taxData.push({
                                            type: "Place Spot Market Order",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            marketId: marketId,
                                            subaccountId: subaccountId,
                                            feeRecipient: feeRecipient,
                                            orderType: orderType,
                                            price: price,
                                            quantity: quantity,
                                            offerAsset: spentAsset,
                                            offerAmount: spentAmount,
                                            sender: message.message.sender,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });

                        if (!added) {
                            added = true
                            taxData.push({
                                type: "Place Spot Market Order",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                marketId: marketId,
                                subaccountId: subaccountId,
                                feeRecipient: feeRecipient,
                                orderType: orderType,
                                price: price,
                                quantity: quantity,
                                signed: signed
                            });
                        }
                    } catch (error) {
                        console.error("Failed to parse spot market order message:", error);
                    }
                    if (!added) {
                        console.log("SpotMarketOrder")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    message.message.msg.includes("\"stake\"") && !message.message.msg.includes("token_ids")
                ) {
                    let added = false
                    try {
                        // Extract contract details
                        const contractAddress = message.message.contract;
                        const sender = message.message.sender;
                        const fundsRaw = message.message.funds;

                        // Parse funds
                        const [amountRaw, assetDenom] = fundsRaw.match(/(\d+)([a-zA-Z\/]+)/).slice(1, 3);
                        const stakedAmount = Number(amountRaw)

                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm-stake_updated") {
                                    const updatedContract = event.attributes.find(attr => attr.key === "_contract_address")?.value;
                                    const staker = event.attributes.find(attr => attr.key === "staker")?.value;
                                    const diff = event.attributes.find(attr => attr.key === "diff")?.value;
                                    const denom = event.attributes.find(attr => attr.key === "denom")?.value;

                                    if (updatedContract === contractAddress && staker === sender) {
                                        const stakedDiff = Number(diff)


                                        added = true
                                        taxData.push({
                                            type: "Mito LP Staking",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            staker: staker,
                                            contractAddress: contractAddress,
                                            stakedAmount: stakedAmount,
                                            stakedDiff: stakedDiff,
                                            denom: denom,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse LP staking transaction:", error);
                    }
                    if (!added) {
                        console.log("Mito LP Staking")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" &&
                    message.message.msg &&
                    typeof message.message.msg === "object" &&
                    message.message.msg.send &&
                    message.message.msg.send.amount &&
                    message.message.msg.send.contract &&
                    message.message.msg.send.msg &&
                    transaction.memo == "Swapped via Hallswap (coinhall.org)"
                ) {
                    let added = false
                    try {
                        // Extract message details
                        const sender = message.message.sender;
                        const contractAddress = message.message.contract;
                        const swapAmount = Number(message.message.msg.send.amount);
                        const swapContract = message.message.msg.send.contract;

                        // Decode the Base64-encoded "msg" field
                        const decodedMsg = JSON.parse(
                            Buffer.from(message.message.msg.send.msg, "base64").toString("utf-8")
                        );

                        // Extract swap details from the decoded message
                        const beliefPrice = decodedMsg?.swap?.belief_price || null;
                        const maxSpread = decodedMsg?.swap?.max_spread || null;

                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "swap")) {
                                    const askAsset = event.attributes.find(attr => attr.key === "ask_asset")?.value;
                                    const offerAmountRaw = event.attributes.find(attr => attr.key === "offer_amount")?.value;
                                    const offerAssetRaw = event.attributes.find(attr => attr.key === "offer_asset")?.value;

                                    const returnAmountRaw = event.attributes.find(attr => attr.key === "return_amount")?.value;
                                    const spreadAmountRaw = event.attributes.find(attr => attr.key === "spread_amount")?.value;
                                    const commissionAmountRaw = event.attributes.find(attr => attr.key === "commission_amount")?.value;

                                    // Convert amounts to human-readable format
                                    const offerAmount = offerAmountRaw ? Number(offerAmountRaw) : null;
                                    const returnAmount = returnAmountRaw ? Number(returnAmountRaw) : null;
                                    const spreadAmount = spreadAmountRaw ? Number(spreadAmountRaw) : null;
                                    const commissionAmount = commissionAmountRaw ? Number(commissionAmountRaw) : null;

                                    added = true
                                    taxData.push({
                                        type: "Swap",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contractAddress: contractAddress,
                                        swapContract: swapContract,
                                        swapAmount: swapAmount,
                                        beliefPrice: beliefPrice,
                                        maxSpread: maxSpread,
                                        offerAsset: offerAssetRaw,
                                        returnAsset: askAsset,
                                        offerAmount: offerAmount,
                                        returnAmount: returnAmount,
                                        spreadAmount: spreadAmount,
                                        commissionAmount: commissionAmount,
                                        signed: signed
                                    });
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse Coinhall swap transaction:", error);
                    }

                    if (!added) {
                        console.log("Swap 3")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }


                else if (
                    message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" &&
                    message.message.msg &&
                    typeof message.message.msg === "object" &&
                    message.message.msg.end_auction
                ) {
                    let added = false
                    try {
                        // Extract auction and sender details
                        const sender = message.message.sender;
                        const contractAddress = message.message.contract;
                        const auctionId = message.message.msg.end_auction.auction_id;

                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm" && event.attributes.some(attr => attr.key === "auction_id")) {
                                    const auctionAttributes = event.attributes.reduce((acc, attr) => {
                                        acc[attr.key] = attr.value;
                                        return acc;
                                    }, {});

                                    const nftTransferEvent = transaction.logs[0].events.find(e => e.type === "wasm" && e.attributes.some(attr => attr.key === "action" && attr.value === "transfer_nft"));
                                    const nftRecipient = nftTransferEvent?.attributes.find(attr => attr.key === "recipient")?.value;
                                    const nftTokenId = nftTransferEvent?.attributes.find(attr => attr.key === "token_id")?.value;

                                    const coinSpent = transaction.logs[0].events.find(e => e.type === "coin_spent");
                                    const coinSpentAmountRaw = coinSpent?.attributes.find(attr => attr.key === "amount")?.value || null;
                                    const coinSpentAmount = coinSpentAmountRaw ? Number(coinSpentAmountRaw.replace("inj", "")) / Math.pow(10, 18) : null;

                                    const coinReceived = transaction.logs[0].events.find(e => e.type === "coin_received");
                                    const coinReceivedAmountRaw = coinReceived?.attributes.find(attr => attr.key === "amount")?.value || null;
                                    const coinReceivedAmount = coinReceivedAmountRaw ? Number(coinReceivedAmountRaw.replace("inj", "")) / Math.pow(10, 18) : null;

                                    added = true
                                    taxData.push({
                                        type: "EndAuction",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contractAddress: contractAddress,
                                        auctionId: auctionId,
                                        nftRecipient: nftRecipient,
                                        nftTokenId: nftTokenId,
                                        coinSpentAmount: coinSpentAmount,
                                        coinReceivedAmount: coinReceivedAmount,
                                        signed: signed
                                    });
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse NFT auction end transaction:", error);
                    }

                    if (!added) {
                        console.log("EndAuction")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" &&
                    message.message.msg &&
                    typeof message.message.msg === "object" &&
                    message.message.msg.send &&
                    typeof message.message.msg.send.msg === "string" // Base64-encoded
                ) {
                    let added = false
                    try {
                        const decodedMsg = JSON.parse(
                            Buffer.from(message.message.msg.send.msg, "base64").toString("utf-8")
                        );

                        if (decodedMsg.swap) {
                            const swapData = decodedMsg.swap;
                            const offerAssetInfo = swapData.offer_asset.info.token.contract_addr;
                            const offerAmount = Number(swapData.offer_asset.amount)
                            const beliefPrice = parseFloat(swapData.belief_price);
                            const maxSpread = parseFloat(swapData.max_spread);
                            const deadline = new Date(swapData.deadline * 1000).toISOString();

                            transaction.logs.forEach(log => {
                                log.events.forEach(event => {
                                    if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "swap")) {
                                        const wasmAttributes = event.attributes.reduce((acc, attr) => {
                                            acc[attr.key] = attr.value;
                                            return acc;
                                        }, {});

                                        const returnAmount = wasmAttributes.return_amount
                                            ? Number(wasmAttributes.return_amount)
                                            : null;
                                        const commissionAmount = wasmAttributes.commission_amount
                                            ? Number(wasmAttributes.commission_amount)
                                            : null;
                                        const spreadAmount = wasmAttributes.spread_amount
                                            ? Number(wasmAttributes.spread_amount)
                                            : null;

                                        added = true
                                        taxData.push({
                                            type: "Swap",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: message.message.sender,
                                            offerAsset: offerAssetInfo,
                                            offerAmount: offerAmount,
                                            returnAmount: returnAmount,
                                            commissionAmount: commissionAmount,
                                            spreadAmount: spreadAmount,
                                            beliefPrice: beliefPrice,
                                            maxSpread: maxSpread,
                                            deadline: deadline,
                                            signed: signed
                                        });
                                    }
                                });
                            });
                        }

                        if (decodedMsg.execute_routes) {
                            const msgContent = decodedMsg.execute_routes;
                            const offerAsset = msgContent.offer_asset_info.native_token?.denom || msgContent.offer_asset_info.token.contract_addr;
                            const routes = msgContent.routes;
                            const minimumReceive = Number(msgContent.minimum_receive)
                            const contractAddress = message.message.contract;
                            const sender = message.message.sender;

                            // Extract transaction details from logs
                            transaction.logs.forEach(log => {
                                log.events.forEach(event => {
                                    if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "helix_swap")) {
                                        const returnAmountAttr = event.attributes.find(attr => attr.key === "return_amount");
                                        const returnAssetAttr = event.attributes.find(attr => attr.key === "ask_asset");

                                        const returnAmount = returnAmountAttr ? Number(returnAmountAttr.value) : null;
                                        const returnAsset = returnAssetAttr ? returnAssetAttr.value : null;

                                        const receiverAttribute = event.attributes.find(attr => attr.key === "receiver")

                                        if (receiverAttribute.value == walletAddress) {
                                            added = true
                                            taxData.push({
                                                type: "Helix Swap",
                                                blockNumber: transaction.blockNumber,
                                                blockTimestamp: transaction.blockTimestamp,
                                                transactionHash: transaction.hash,
                                                sender: sender,
                                                contract: contractAddress,
                                                offerAsset: offerAsset,
                                                routes: routes,
                                                minimumReceive: minimumReceive,
                                                returnAmount: returnAmount,
                                                returnAsset: returnAsset,
                                                signed: signed
                                            });
                                        }

                                    }
                                    else if (event.type === "wasm" && event.attributes.some(attr => attr.key === "hallswap")) {
                                        const returnAmountAttr = event.attributes.find(attr => attr.key === "return_amount");
                                        const returnAssetAttr = event.attributes.find(attr => attr.key === "return_asset");
                                        const offerAmountAttr = event.attributes.find(attr => attr.key === "offer_amount");

                                        const returnAmount = returnAmountAttr ? Number(returnAmountAttr.value) : null;
                                        const returnAsset = returnAssetAttr ? returnAssetAttr.value : null;

                                        const receiverAttribute = event.attributes.find(attr => attr.key === "receiver")

                                        if (receiverAttribute.value == walletAddress) {
                                            added = true
                                            taxData.push({
                                                type: "Swap",
                                                blockNumber: transaction.blockNumber,
                                                blockTimestamp: transaction.blockTimestamp,
                                                transactionHash: transaction.hash,
                                                sender: sender,
                                                contract: contractAddress,
                                                offerAsset: offerAsset,
                                                offerAmount: offerAmountAttr.value,
                                                routes: routes,
                                                minimumReceive: minimumReceive,
                                                returnAsset: returnAsset,
                                                returnAmount: returnAmount,
                                                signed: signed
                                            });
                                        }
                                    }
                                });
                            });

                        }

                        if (decodedMsg.withdraw_liquidity) {
                            const withdrawData = decodedMsg.withdraw_liquidity;
                            const minAssets = withdrawData.min_assets.map(asset => {
                                if (asset.info.native_token) {
                                    return {
                                        type: "native",
                                        denom: asset.info.native_token.denom,
                                        amount: Number(asset.amount),
                                    };
                                } else if (asset.info.token) {
                                    return {
                                        type: "token",
                                        contractAddr: asset.info.token.contract_addr,
                                        amount: Number(asset.amount),
                                    };
                                } else {
                                    console.warn("Unknown asset type:", asset);
                                    return null; // Handle unexpected asset types gracefully
                                }
                            }).filter(asset => asset !== null);
                            const deadline = new Date(withdrawData.deadline * 1000).toISOString();

                            transaction.logs.forEach(log => {
                                log.events.forEach(event => {
                                    if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "withdraw_liquidity")) {
                                        const wasmAttributes = event.attributes.reduce((acc, attr) => {
                                            acc[attr.key] = attr.value;
                                            return acc;
                                        }, {});

                                        const refundAssets = wasmAttributes.refund_assets
                                            ? wasmAttributes.refund_assets.split(",").map(asset => {
                                                const [amount, contractAddr] = asset.trim().split(/(?=[inj1])/);
                                                return { amount: Number(amount), contractAddr: contractAddr.trim() };
                                            })
                                            : null;

                                        const withdrawnShare = wasmAttributes.withdrawn_share
                                            ? Number(wasmAttributes.withdrawn_share)
                                            : null;

                                        added = true;
                                        taxData.push({
                                            type: "Withdraw Liquidity",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: wasmAttributes.sender,
                                            contractAddress: wasmAttributes._contract_address,
                                            minAssets: minAssets,
                                            refundAssets: refundAssets,
                                            withdrawnShare: withdrawnShare,
                                            deadline: deadline,
                                            signed: signed,
                                        });
                                    }
                                });
                            });


                        }

                        if (decodedMsg.execute_swap_operations) {
                            const swapOperations = decodedMsg.execute_swap_operations.operations;
                            const minimumReceive = Number(decodedMsg.execute_swap_operations.minimum_receive);
                            const deadline = new Date(decodedMsg.execute_swap_operations.deadline * 1000).toISOString();

                            transaction.logs.forEach(log => {
                                log.events.forEach(event => {
                                    if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "swap")) {
                                        const askAsset = event.attributes.find(attr => attr.key === "ask_asset")?.value;
                                        const offerAmountRaw = event.attributes.find(attr => attr.key === "offer_amount")?.value;
                                        const offerAssetRaw = event.attributes.find(attr => attr.key === "offer_asset")?.value;

                                        const returnAmountRaw = event.attributes.find(attr => attr.key === "return_amount")?.value;
                                        const spreadAmountRaw = event.attributes.find(attr => attr.key === "spread_amount")?.value;
                                        const commissionAmountRaw = event.attributes.find(attr => attr.key === "commission_amount")?.value;

                                        // Convert amounts to human-readable format
                                        const offerAmount = offerAmountRaw ? Number(offerAmountRaw) : null;
                                        const returnAmount = returnAmountRaw ? Number(returnAmountRaw) : null;
                                        const spreadAmount = spreadAmountRaw ? Number(spreadAmountRaw) : null;
                                        const commissionAmount = commissionAmountRaw ? Number(commissionAmountRaw) : null;

                                        // Iterate through operations to gather swap details
                                        const operationDetails = swapOperations.map(op => {
                                            if (op.dojo_swap) {
                                                const offerAssetInfo = op.dojo_swap.offer_asset_info.token
                                                    ? op.dojo_swap.offer_asset_info.token.contract_addr
                                                    : op.dojo_swap.offer_asset_info.native_token.denom;

                                                const askAssetInfo = op.dojo_swap.ask_asset_info.token
                                                    ? op.dojo_swap.ask_asset_info.token.contract_addr
                                                    : op.dojo_swap.ask_asset_info.native_token.denom;

                                                return {
                                                    offerAsset: offerAssetInfo,
                                                    askAsset: askAssetInfo,
                                                };
                                            }
                                            console.warn("Unknown operation type:", op);
                                            return null;
                                        }).filter(op => op !== null); // Filter out invalid operations

                                        added = true;
                                        taxData.push({
                                            type: "Execute Swap Operations",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: message.message.sender,
                                            contractAddress: message.message.contract,
                                            operations: operationDetails,
                                            minimumReceive: minimumReceive,
                                            deadline: deadline,
                                            swapDetails: {
                                                askAsset: askAsset,
                                                offerAsset: offerAssetRaw,
                                                offerAmount: offerAmount,
                                                returnAmount: returnAmount,
                                                spreadAmount: spreadAmount,
                                                commissionAmount: commissionAmount,
                                            },
                                            signed: signed,
                                        });
                                    }
                                });
                            });
                        }

                        if (decodedMsg.bond_boost) {
                            const bondBoostData = decodedMsg.bond_boost;

                            transaction.logs.forEach(log => {
                                log.events.forEach(event => {
                                    if (
                                        event.type === "wasm" &&
                                        event.attributes.some(attr => attr.key === "action" && attr.value === "bond_boost")
                                    ) {
                                        const wasmAttributes = event.attributes.reduce((acc, attr) => {
                                            acc[attr.key] = attr.value;
                                            return acc;
                                        }, {});

                                        const amount = wasmAttributes.amount
                                            ? Number(wasmAttributes.amount)
                                            : null;

                                        const owner = wasmAttributes.owner || null;

                                        added = true;
                                        taxData.push({
                                            type: "HYDRO Bond Boost",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: message.message.sender,
                                            contractAddress: message.message.contract,
                                            amount: amount,
                                            owner: owner,
                                            signed: signed,
                                        });
                                    }
                                });
                            });
                        }

                        if (decodedMsg.deposit) {
                            added = true;
                            taxData.push({
                                type: "Dojo Deposit",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                signed
                            })
                        }

                        if (decodedMsg.bond) {
                            added = true;
                            taxData.push({
                                type: "hINJ Bond",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                signed
                            })
                        }


                    } catch (error) {
                        console.error("Failed to parse swap transaction:", error);
                    }
                    if (!added) {
                        console.log("cw20 send custom")
                        console.log(JSON.stringify(transaction, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" &&
                    message.message.msg &&
                    typeof message.message.msg === "object" &&
                    message.message.msg.harvest
                ) {
                    let added = false
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "harvest")) {
                                const wasmAttributes = event.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {});

                                const offeringAmount = wasmAttributes.offering_amount
                                    ? Number(wasmAttributes.offering_amount) / Math.pow(10, 18)
                                    : null;
                                const refundAmount = wasmAttributes.refund_amount
                                    ? Number(wasmAttributes.refund_amount) / Math.pow(10, 18)
                                    : null;
                                const sender = wasmAttributes.address || null;

                                added = true
                                taxData.push({
                                    type: "DojoSwap Harvest",
                                    blockNumber: transaction.blockNumber,
                                    blockTimestamp: transaction.blockTimestamp,
                                    transactionHash: transaction.hash,
                                    sender: sender,
                                    offeringAmount: offeringAmount,
                                    refundAmount: refundAmount,
                                    signed: signed
                                });
                            }

                            // Extract additional transfer details if needed
                            if (event.type === "transfer") {
                                const transferAttributes = event.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {});

                                const transferAmount = transferAttributes.amount
                                    ? Number(transferAttributes.amount.replace("inj", "")) / Math.pow(10, 18)
                                    : null;
                                const transferRecipient = transferAttributes.recipient || null;
                                const transferSender = transferAttributes.sender || null;

                                if (transferAmount && transferRecipient && transferSender) {
                                    added = true
                                    taxData.push({
                                        type: "Transfer",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: transferSender,
                                        recipient: transferRecipient,
                                        amount: transferAmount,
                                        token: "inj",
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Transfer")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" &&
                    message.message.msg &&
                    typeof message.message.msg === "object" &&
                    message.message.msg.deposit
                ) {
                    let added = false
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "deposit")) {
                                const wasmAttributes = event.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {});

                                const depositAmount = wasmAttributes.amount
                                    ? Number(wasmAttributes.amount) / Math.pow(10, 18)
                                    : null;
                                const depositor = wasmAttributes.address || null;

                                added = true
                                taxData.push({
                                    type: "Deposit",
                                    blockNumber: transaction.blockNumber,
                                    blockTimestamp: transaction.blockTimestamp,
                                    transactionHash: transaction.hash,
                                    sender: depositor,
                                    depositAmount: depositAmount,
                                    token: "inj",
                                    contract: message.message.contract,
                                    signed: signed
                                });
                            }

                            // Parse the transfer details
                            if (event.type === "transfer") {
                                const transferAttributes = event.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {});

                                const transferAmount = transferAttributes.amount
                                    ? Number(transferAttributes.amount.replace("inj", "")) / Math.pow(10, 18)
                                    : null;
                                const transferRecipient = transferAttributes.recipient || null;
                                const transferSender = transferAttributes.sender || null;

                                if (transferAmount && transferRecipient && transferSender) {
                                    added = true
                                    taxData.push({
                                        type: "Transfer",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: transferSender,
                                        recipient: transferRecipient,
                                        amount: transferAmount,
                                        token: "inj",
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.log("Transfer / Deposit")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    JSON.parse(message.message.msg).swap_min_output
                ) {
                    let added = false
                    try {
                        // Parse the stringified JSON in the `msg` field
                        const parsedMsg = JSON.parse(message.message.msg);

                        // Ensure it's a swap message
                        if (parsedMsg.swap_min_output) {
                            const swapData = parsedMsg.swap_min_output;
                            const contractAddress = message.message.contract;
                            const inputFunds = message.message.funds;

                            // Parse input funds for denomination and amount
                            const inputAmount = inputFunds.match(/^\d+/)[0]
                            const inputDenom = inputFunds.replace(/\d+/g, ""); // Extract the asset

                            // Extract swap details
                            const minOutputQuantity = swapData.min_output_quantity
                                ? Number(swapData.min_output_quantity)
                                : null;
                            const targetDenom = swapData.target_denom || null;

                            transaction.logs.forEach(log => {
                                log.events.forEach(event => {
                                    if (event.type === "wasm-atomic_swap_execution") {
                                        const wasmAttributes = event.attributes.reduce((acc, attr) => {
                                            acc[attr.key] = attr.value;
                                            return acc;
                                        }, {});

                                        const swapInputAmount = wasmAttributes.swap_input_amount
                                            ? Number(wasmAttributes.swap_input_amount)
                                            : null;
                                        const swapFinalAmount = wasmAttributes.swap_final_amount
                                            ? Number(wasmAttributes.swap_final_amount)
                                            : null;
                                        const swapInputDenom = wasmAttributes.swap_input_denom || null;
                                        const swapFinalDenom = wasmAttributes.swap_final_denom || null;

                                        added = true
                                        taxData.push({
                                            type: "Helix Swap",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            contract: contractAddress,
                                            sender: wasmAttributes.sender || null,
                                            offerAsset: swapInputDenom || inputDenom,
                                            offerAmount: swapInputAmount || Number(inputAmount),
                                            returnAsset: swapFinalDenom || targetDenom,
                                            returnAmount: swapFinalAmount,
                                            minOutputAmount: minOutputQuantity,
                                            targetAsset: targetDenom,
                                            signed: signed
                                        });
                                    }
                                });
                            });
                        }
                    } catch (error) {
                        console.error("Failed to parse swap message:", error);
                    }
                    if (!added) {
                        console.log("Helix Swap")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    (JSON.parse(message.message.msg).approve_escrow || JSON.parse(message.message.msg).trade)
                ) {
                    let added = false
                    const msgData = JSON.parse(message.message.msg);

                    if (msgData.approve_escrow) {
                        const escrowId = msgData.approve_escrow.trading_escrow_id;
                        added = true
                        taxData.push({
                            type: "Approve Escrow",
                            contract: message.message.contract,
                            sender: message.message.sender,
                            tradingEscrowId: escrowId,
                            signed
                        });
                    }

                    if (msgData.trade) {
                        const escrowId = msgData.trade.trading_escrow_id;

                        transaction.logs.forEach(log => {
                            // Extract logs for trade details
                            const nftTransfer = log.events.find(
                                (event) =>
                                    event.type === "wasm" &&
                                    event.attributes.some(attr => attr.key === "action" && attr.value === "transfer_nft")
                            );

                            const coinTransfer = log.events.find(
                                (event) =>
                                    event.type === "transfer" &&
                                    event.attributes.some(attr => attr.key === "recipient")
                            );

                            const tokenTransfer = nftTransfer
                                ? nftTransfer.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            const coinDetails = coinTransfer
                                ? coinTransfer.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            added = true
                            taxData.push({
                                type: "Trade Execution",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                contract: message.message.contract,
                                sender: message.message.sender,
                                tradingEscrowId: escrowId,
                                nft: {
                                    tokenId: tokenTransfer.token_id || null,
                                    sender: tokenTransfer.sender || null,
                                    recipient: tokenTransfer.recipient || null,
                                },
                                funds: {
                                    amount: coinDetails.amount
                                        ? Number(coinDetails.amount.replace("inj", "")) / Math.pow(10, 18)
                                        : null,
                                    sender: coinDetails.sender || null,
                                    recipient: coinDetails.recipient || null,
                                },
                                signed: signed
                            });
                        })


                    }
                    if (!added) {
                        console.log("Trade Execution")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    JSON.parse(message.message.msg).create_escrow
                ) {
                    let added = false
                    const msgData = JSON.parse(message.message.msg);

                    if (msgData.create_escrow) {
                        const escrowId = msgData.create_escrow.trading_escrow_id;

                        transaction.logs.forEach(log => {
                            // Extract logs for escrow creation details
                            const nftTransfer = log.events.find(
                                (event) =>
                                    event.type === "wasm" &&
                                    event.attributes.some(attr => attr.key === "action" && attr.value === "transfer_nft")
                            );

                            const coinTransfer = log.events.find(
                                (event) =>
                                    event.type === "transfer" &&
                                    event.attributes.some(attr => attr.key === "recipient")
                            );

                            const tokenTransfer = nftTransfer
                                ? nftTransfer.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            const coinDetails = coinTransfer
                                ? coinTransfer.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            added = true
                            taxData.push({
                                type: "Create Escrow",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                contract: message.message.contract,
                                sender: message.message.sender,
                                tradingEscrowId: escrowId,
                                nft: {
                                    tokenId: tokenTransfer.token_id || null,
                                    sender: tokenTransfer.sender || null,
                                    recipient: tokenTransfer.recipient || null,
                                },
                                funds: {
                                    amount: coinDetails.amount
                                        ? Number(coinDetails.amount.replace("inj", "")) / Math.pow(10, 18)
                                        : null,
                                    sender: coinDetails.sender || null,
                                    recipient: coinDetails.recipient || null,
                                },
                                signed: signed
                            });
                        });
                    }
                    if (!added) {
                        console.log("Create Escrow")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    JSON.parse(message.message.msg).swap_exact_output
                ) {
                    let added = false
                    const msgData = JSON.parse(message.message.msg);

                    if (msgData.swap_exact_output) {
                        const targetOutputQuantity = msgData.swap_exact_output.target_output_quantity;
                        const targetDenom = msgData.swap_exact_output.target_denom;

                        transaction.logs.forEach(log => {
                            // Extract logs for swap details
                            const wasmSwapExecution = log.events.find(
                                (event) =>
                                    event.type === "wasm-atomic_swap_execution" &&
                                    event.attributes.some(attr => attr.key === "swap_final_amount")
                            );

                            const coinSpent = log.events.find(
                                (event) =>
                                    event.type === "coin_spent" &&
                                    event.attributes.some(attr => attr.key === "spender")
                            );

                            const coinReceived = log.events.find(
                                (event) =>
                                    event.type === "coin_received" &&
                                    event.attributes.some(attr => attr.key === "receiver")
                            );

                            const wasmSwapDetails = wasmSwapExecution
                                ? wasmSwapExecution.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            const spentDetails = coinSpent
                                ? coinSpent.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            const receivedDetails = coinReceived
                                ? coinReceived.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : {};

                            added = true
                            taxData.push({
                                type: "Helix Swap",
                                blockNumber: transaction.blockNumber,
                                blockTimestamp: transaction.blockTimestamp,
                                transactionHash: transaction.hash,
                                contract: message.message.contract,
                                sender: message.message.sender,
                                offerAmount: spentDetails.amount,
                                offerAsset: wasmSwapDetails.swap_input_denom || null,
                                returnAmount: wasmSwapDetails.swap_final_amount,
                                returnAsset: wasmSwapDetails.swap_final_denom || null,
                                refundAmount: wasmSwapDetails.refund_amount,
                                funds: {
                                    amountSpent: spentDetails.amount || null,
                                    spender: spentDetails.spender || null,
                                    amountReceived: receivedDetails.amount || null,
                                    receiver: receivedDetails.receiver || null,
                                },
                                signed: signed
                            });
                        });
                    }
                    if (!added) {
                        console.log("Helix Swap")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    JSON.parse(message.message.msg).withdraw_voting_tokens
                ) {
                    let added = false
                    transaction.logs.forEach(log => {
                        // Extract logs for withdrawal details
                        const wasmWithdrawal = log.events.find(
                            (event) =>
                                event.type === "wasm" &&
                                event.attributes.some(attr => attr.key === "action" && attr.value === "withdraw")
                        );

                        const coinSpent = log.events.find(
                            (event) =>
                                event.type === "coin_spent" &&
                                event.attributes.some(attr => attr.key === "spender")
                        );

                        const coinReceived = log.events.find(
                            (event) =>
                                event.type === "coin_received" &&
                                event.attributes.some(attr => attr.key === "receiver")
                        );

                        const wasmDetails = wasmWithdrawal
                            ? wasmWithdrawal.attributes.reduce((acc, attr) => {
                                acc[attr.key] = attr.value;
                                return acc;
                            }, {})
                            : {};

                        const spentDetails = coinSpent
                            ? coinSpent.attributes.reduce((acc, attr) => {
                                acc[attr.key] = attr.value;
                                return acc;
                            }, {})
                            : {};

                        const receivedDetails = coinReceived
                            ? coinReceived.attributes.reduce((acc, attr) => {
                                acc[attr.key] = attr.value;
                                return acc;
                            }, {})
                            : {};

                        added = true
                        taxData.push({
                            type: "Withdraw Voting Tokens",
                            blockNumber: transaction.blockNumber,
                            blockTimestamp: transaction.blockTimestamp,
                            transactionHash: transaction.hash,
                            contract: message.message.contract,
                            sender: message.message.sender,
                            withdrawalDetails: {
                                amount: wasmDetails.amount
                                    ? Number(wasmDetails.amount) / Math.pow(10, 6) // Assuming Talis uses 6 decimal places
                                    : null,
                                recipient: wasmDetails.recipient || null,
                            },
                            funds: {
                                amountSpent: spentDetails.amount || null,
                                spender: spentDetails.spender || null,
                                amountReceived: receivedDetails.amount || null,
                                receiver: receivedDetails.receiver || null,
                            },
                            signed: signed
                        });
                    });
                    if (!added) {
                        console.log("Withdraw Voting Tokens")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }
                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    JSON.parse(message.message.msg).place_bid
                ) {
                    let added = false
                    const msgData = JSON.parse(message.message.msg);

                    transaction.logs.forEach(log => {
                        // Extract relevant log events
                        const wasmEvent = log.events.find(
                            (event) =>
                                event.type === "wasm" &&
                                event.attributes.some(attr => attr.key === "action" && attr.value === "place bid")
                        );

                        const coinSpent = log.events.find(
                            (event) =>
                                event.type === "coin_spent" &&
                                event.attributes.some(attr => attr.key === "spender")
                        );

                        const coinReceived = log.events.find(
                            (event) =>
                                event.type === "coin_received" &&
                                event.attributes.some(attr => attr.key === "receiver")
                        );

                        const wasmDetails = wasmEvent
                            ? wasmEvent.attributes.reduce((acc, attr) => {
                                acc[attr.key] = attr.value;
                                return acc;
                            }, {})
                            : {};

                        const spentDetails = coinSpent
                            ? coinSpent.attributes.reduce((acc, attr) => {
                                acc[attr.key] = attr.value;
                                return acc;
                            }, {})
                            : {};

                        const receivedDetails = coinReceived
                            ? coinReceived.attributes.reduce((acc, attr) => {
                                acc[attr.key] = attr.value;
                                return acc;
                            }, {})
                            : {};

                        added = true
                        taxData.push({
                            type: "Place Bid",
                            blockNumber: transaction.blockNumber,
                            blockTimestamp: transaction.blockTimestamp,
                            transactionHash: transaction.hash,
                            contract: message.message.contract,
                            sender: message.message.sender,
                            auctionDetails: {
                                auctionId: wasmDetails.auction_id || null,
                                amount: spentDetails.amount
                                    ? Number(spentDetails.amount.replace("inj", "")) / Math.pow(10, 18)
                                    : null,
                            },
                            funds: {
                                spender: spentDetails.spender || null,
                                receiver: receivedDetails.receiver || null,
                            },
                            signed: signed
                        });
                    });
                    if (!added) {
                        console.log("Place Bid")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.exchange.v1beta1.MsgCreateDerivativeMarketOrder" &&
                    message.message.order
                ) {
                    const order = message.message.order;
                    let returnAsset, returnAmount, offerAsset, offerAmount

                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        const coinRecievedEvent = log.events.find(x => x.type == "coin_received" && x.attributes.find(att => att.key == "receiver" && att.value == walletAddress))

                        if (coinRecievedEvent) {
                            const amountReceived = coinRecievedEvent.attributes.find(att => att.key == "amount").value
                            returnAsset = amountReceived.replace(/^\d+/, '').trim();
                            returnAmount = Number(amountReceived.match(/^\d+/)[0])
                        }

                        const coinSpentEvent = log.events.find(x => x.type == "coin_spent" && x.attributes.find(att => att.key == "spender" && att.value == walletAddress))
                        if (coinSpentEvent) {
                            const amountSpent = coinSpentEvent.attributes.find(att => att.key == "amount").value
                            offerAsset = amountSpent.replace(/^\d+/, '').trim();
                            offerAmount = Number(amountSpent.match(/^\d+/)[0])
                        }
                    });

                    taxData.push({
                        type: "Create Derivatives Market Order",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        contract: null, // Not a contract-based transaction
                        sender: message.message.sender,
                        marketId: order.market_id,
                        orderDetails: {
                            subaccountId: order.order_info.subaccount_id || null,
                            feeRecipient: order.order_info.fee_recipient || null,
                            price: order.order_info.price
                                ? Number(order.order_info.price).toFixed(6) // Format price for better readability
                                : null,
                            quantity: order.order_info.quantity
                                ? Number(order.order_info.quantity).toFixed(6) // Format quantity for better readability
                                : null,
                            orderType: order.order_type || null,
                            margin: order.margin
                                ? Number(order.margin).toFixed(6)
                                : null,
                            triggerPrice: order.trigger_price
                                ? Number(order.trigger_price).toFixed(6)
                                : null,
                        },
                        returnAsset,
                        returnAmount,
                        offerAmount,
                        offerAsset,
                        signed: signed
                    });

                }

                else if (
                    message.type === "/injective.exchange.v1beta1.MsgCreateDerivativeLimitOrder" &&
                    message.message.order
                ) {
                    const order = message.message.order;

                    let returnAsset, returnAmount, offerAsset, offerAmount

                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        const coinRecievedEvent = log.events.find(x => x.type == "coin_received" && x.attributes.find(att => att.key == "receiver" && att.value == walletAddress))

                        if (coinRecievedEvent) {
                            const amountReceived = coinRecievedEvent.attributes.find(att => att.key == "amount").value
                            returnAsset = amountReceived.replace(/^\d+/, '').trim();
                            returnAmount = Number(amountReceived.match(/^\d+/)[0])
                        }

                        const coinSpentEvent = log.events.find(x => x.type == "coin_spent" && x.attributes.find(att => att.key == "spender" && att.value == walletAddress))
                        if (coinSpentEvent) {
                            const amountSpent = coinSpentEvent.attributes.find(att => att.key == "amount").value
                            offerAsset = amountSpent.replace(/^\d+/, '').trim();
                            offerAmount = Number(amountSpent.match(/^\d+/)[0])
                        }
                    });


                    taxData.push({
                        type: "Create Derivatives Limit Order",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        sender: message.message.sender,
                        marketId: order.market_id,
                        orderDetails: {
                            subaccountId: order.order_info.subaccount_id || null,
                            feeRecipient: order.order_info.fee_recipient || null,
                            price: order.order_info.price
                                ? Number(order.order_info.price)
                                : null,
                            quantity: order.order_info.quantity
                                ? Number(order.order_info.quantity)
                                : null,
                            orderType: order.order_type || null,
                            margin: order.margin
                                ? Number(order.margin)
                                : null,
                            triggerPrice: order.trigger_price
                                ? Number(order.trigger_price)
                                : null,
                        },
                        returnAsset,
                        returnAmount,
                        offerAmount,
                        offerAsset,
                        signed: signed
                    });
                }

                else if (message.type === "/injective.exchange.v1beta1.MsgCancelDerivativeOrder") {
                    const { sender, market_id, subaccount_id, order_hash } = message.message;

                    let orderDetails = null;
                    let added = false;

                    // Iterate through transaction logs
                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach(event => {
                            if (event.type === "injective.exchange.v1beta1.EventCancelDerivativeOrder") {
                                const orderInfoAttribute = event.attributes.find(attr => attr.key === "limit_order");
                                const marketIdAttribute = event.attributes.find(attr => attr.key === "market_id");

                                if (
                                    orderInfoAttribute &&
                                    parseInt(msgIndex) === index
                                ) {
                                    added = true;

                                    // Parse order details if available
                                    if (orderInfoAttribute.value) {
                                        orderDetails = JSON.parse(orderInfoAttribute.value);
                                    }

                                    taxData.push({
                                        type: "Derivative Order Cancellation",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        marketId: marketIdAttribute ? JSON.parse(marketIdAttribute.value) : market_id,
                                        subaccountId: subaccount_id,
                                        orderHash: order_hash,
                                        orderDetails: orderDetails,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn(`No matching order cancellation log found for message index: ${index}`);
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/injective.exchange.v1beta1.MsgBatchCancelDerivativeOrders") {
                    const { sender, data } = message.message;

                    // Iterate over the data array in the message
                    data.forEach((order, orderIndex) => {
                        const { market_id, subaccount_id, order_hash, order_mask, cid } = order;

                        let orderDetails = null;
                        let added = false;

                        // Iterate through transaction logs to match the message index and extract event details
                        transaction.logs.forEach(log => {
                            const msgIndex = log.msg_index || 0
                            log.events.forEach(event => {
                                if (event.type === "injective.exchange.v1beta1.EventCancelDerivativeOrder") {
                                    const orderInfoAttribute = event.attributes.find(attr => attr.key === "limit_order");
                                    const marketIdAttribute = event.attributes.find(attr => attr.key === "market_id");

                                    if (
                                        orderInfoAttribute &&
                                        parseInt(msgIndex) === index
                                    ) {
                                        added = true;

                                        // Parse order details if available
                                        if (orderInfoAttribute.value) {
                                            orderDetails = JSON.parse(orderInfoAttribute.value);
                                        }

                                        taxData.push({
                                            type: "Batch Derivative Order Cancellation",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: sender,
                                            marketId: marketIdAttribute ? JSON.parse(marketIdAttribute.value) : market_id,
                                            subaccountId: subaccount_id,
                                            orderHash: order_hash,
                                            orderMask: order_mask,
                                            cid: cid,
                                            orderDetails: orderDetails,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });

                        if (!added) {
                            console.warn(`No matching log found for order index: ${orderIndex} in batch cancellation`);
                            console.log(JSON.stringify(transaction.hash, null, 2));

                            breakLoop = true;
                        }
                    });
                }


                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    JSON.parse(message.message.msg).join_guild
                ) {
                    const msgData = JSON.parse(message.message.msg);

                    taxData.push({
                        type: "Join Trading Guild",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        contract: message.message.contract,
                        sender: message.message.sender,
                        guildDetails: {
                            guildId: msgData.join_guild.id || null,
                        },
                        logs: transaction.logs.map((log) => {
                            const guildEvent = log.events.find(
                                (event) =>
                                    event.type === "wasm-campaign-join_guild" &&
                                    event.attributes.some((attr) => attr.key === "guild_id")
                            );

                            return guildEvent
                                ? guildEvent.attributes.reduce((acc, attr) => {
                                    acc[attr.key] = attr.value;
                                    return acc;
                                }, {})
                                : null;
                        }),
                        signed: signed
                    });
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    message.message.msg.includes("remove_strategy")
                ) {
                    let added = false
                    const msgContent = JSON.parse(message.message.msg);

                    // Extract details related to the 'remove_strategy' action
                    const contractAddress = message.message.contract;
                    const sender = message.message.sender;

                    // Loop through transaction logs to collect relevant data
                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "wasm-remove_strategy") {
                                const midPrice = event.attributes.find(attr => attr.key === "mid_price")?.value;
                                const baseDeposit = event.attributes.find(attr => attr.key === "base_deposit")?.value;
                                const quoteDeposit = event.attributes.find(attr => attr.key === "quote_deposit")?.value;
                                const stopReason = event.attributes.find(attr => attr.key === "stop_reason")?.value;

                                added = true
                                taxData.push({
                                    type: "Remove Strategy",
                                    blockNumber: transaction.blockNumber,
                                    blockTimestamp: transaction.blockTimestamp,
                                    transactionHash: transaction.hash,
                                    contractAddress: contractAddress,
                                    sender: sender,
                                    midPrice: parseFloat(midPrice),
                                    baseDeposit: parseFloat(baseDeposit) / Math.pow(10, 6), // Assuming 6 decimals
                                    quoteDeposit: parseFloat(quoteDeposit) / Math.pow(10, 6), // Assuming 6 decimals
                                    stopReason: stopReason,
                                    signed: signed,
                                });
                            }
                        });
                    });
                    if (!added) {
                        console.log("Remove Strategy")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg &&
                    typeof message.message.msg === "string" &&
                    message.message.msg.includes("create_strategy")
                ) {
                    let added = false
                    const msgContent = JSON.parse(message.message.msg);
                    const strategyDetails = msgContent.create_strategy;

                    // Extract details from the message
                    const contractAddress = message.message.contract;
                    const sender = message.message.sender;
                    const subaccountId = strategyDetails.subaccount_id;
                    const numberOfLevels = strategyDetails.levels;
                    const lowerBound = strategyDetails.bounds[0];
                    const upperBound = strategyDetails.bounds[1];
                    const quoteFunds = message.message.funds;

                    // Loop through transaction logs to collect additional data
                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "wasm-create_strategy") {
                                const marketId = event.attributes.find(attr => attr.key === "market_id")?.value;
                                const baseQuantity = event.attributes.find(attr => attr.key === "base_quantity")?.value;
                                const quoteQuantity = event.attributes.find(attr => attr.key === "quote_quantity")?.value;
                                const swapFee = event.attributes.find(attr => attr.key === "swap_fee")?.value;
                                const executionPrice = event.attributes.find(attr => attr.key === "execution_price")?.value;

                                added = true
                                taxData.push({
                                    type: "Grid Trading Strategy Creation",
                                    blockNumber: transaction.blockNumber,
                                    blockTimestamp: transaction.blockTimestamp,
                                    transactionHash: transaction.hash,
                                    contractAddress: contractAddress,
                                    sender: sender,
                                    subaccountId: subaccountId,
                                    marketId: marketId,
                                    lowerBound: parseFloat(lowerBound),
                                    upperBound: parseFloat(upperBound),
                                    baseQuantity: parseFloat(baseQuantity) / Math.pow(10, 6), // Assuming 6 decimals for base
                                    quoteQuantity: parseFloat(quoteQuantity) / Math.pow(10, 6), // Assuming 6 decimals for quote
                                    quoteFunds: parseFloat(quoteFunds.split("peggy")[0]) / Math.pow(10, 6), // Assuming funds use peggy
                                    numberOfLevels: numberOfLevels,
                                    swapFee: parseFloat(swapFee) / Math.pow(10, 18), // Assuming 18 decimals for swap fee
                                    executionPrice: parseFloat(executionPrice) / Math.pow(10, 18), // Assuming 18 decimals for execution price
                                    signed: signed,
                                });
                            }
                        });
                    });

                    if (!added) {
                        console.log("Grid Trading Strategy Creation")
                        console.log(JSON.stringify(transaction.hash, null, 2))

                        breakLoop = true
                    }
                }

                else if (message.type === "/cosmos.authz.v1beta1.MsgGrant") {
                    const granter = message.message.granter;
                    const grantee = message.message.grantee;
                    const grantDetails = message.message.grant;
                    const authorizationType = grantDetails.authorization["@type"];
                    const msgType = grantDetails.authorization.msg;
                    const expiration = grantDetails.expiration;

                    // Add grant information to taxData or logData for processing
                    taxData.push({
                        type: "Grant Authorization",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        granter: granter,
                        grantee: grantee,
                        msgType: msgType,
                        authorizationType: authorizationType,
                        expiration: expiration,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        signed: signed
                    });
                }


                else if (message.type === "/injective.exchange.v1beta1.MsgCreateSpotLimitOrder") {
                    const order = message.message.order;

                    // Extract key details from the order
                    const sender = message.message.sender;
                    const marketId = order.market_id;
                    const subaccountId = order.order_info.subaccount_id;
                    const feeRecipient = order.order_info.fee_recipient;
                    const price = parseFloat(order.order_info.price);
                    const quantity = parseFloat(order.order_info.quantity);
                    const orderType = order.order_type;
                    const triggerPrice = parseFloat(order.trigger_price);

                    // Extract details related to transaction costs
                    const gasFee = parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18); // Convert gas fee to INJ
                    const gasUsed = transaction.gasUsed;

                    // Extract relevant logs for additional details
                    const fundsSpent = null;
                    const recipient = null;

                    let added = false

                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "coin_spent") {
                                const spender = event.attributes.find(attr => attr.key === "spender")?.value;
                                const spentAmountRaw = event.attributes.find(attr => attr.key === "amount")?.value;

                                if (spender === message.message.sender && spentAmountRaw) {
                                    const spentAsset = spentAmountRaw.replace(/^\d+/, '').trim();
                                    const spentAmount = Number(spentAmountRaw.match(/^\d+/)[0])

                                    added = true
                                    taxData.push({
                                        type: "Place Spot Limit Order",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        marketId: marketId,
                                        subaccountId: subaccountId,
                                        feeRecipient: feeRecipient,
                                        price: price,
                                        quantity: quantity,
                                        orderType: orderType,
                                        triggerPrice: triggerPrice,
                                        offerAsset: spentAsset,
                                        offerAmount: spentAmount,
                                        gasFee: gasFee,
                                        gasUsed: gasUsed,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });
                }
                else if (message.type === "/cosmos.staking.v1beta1.MsgDelegate") {
                    const delegation = message.message;

                    // Extract key details from the delegation message
                    const delegatorAddress = delegation.delegator_address;
                    const validatorAddress = delegation.validator_address;
                    const amount = parseFloat(delegation.amount.amount)
                    const denom = delegation.amount.denom;

                    // Extract additional details from transaction logs
                    let rewardsWithdrawn = null;
                    let newShares = null;

                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "withdraw_rewards") {
                                rewardsWithdrawn = parseFloat(
                                    event.attributes.find(attr => attr.key === "amount")?.value.replace("inj", "") || 0
                                )
                            }
                            if (event.type === "delegate") {
                                newShares = event.attributes.find(attr => attr.key === "new_shares")?.value || null;
                            }
                        });
                    });

                    // Add the parsed data to a structured format
                    taxData.push({
                        type: "Delegate",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        delegator: delegatorAddress,
                        validator: validatorAddress,
                        amount: amount,
                        denom: denom,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        rewardsWithdrawn: rewardsWithdrawn,
                        newShares: newShares,
                        signed: signed
                    });


                }
                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("withdraw_funds")) {
                    const withdrawMessage = JSON.parse(message.message.msg);

                    // Extract details from the message
                    const sender = message.message.sender;
                    const contractAddress = message.message.contract;
                    const recipient = withdrawMessage.withdraw_funds.address_to;
                    const funds = parseFloat(message.message.funds || 0) / Math.pow(10, 18); // Convert funds to INJ

                    // Extract details from transaction logs
                    let withdrawnAmount = null;
                    let feeRecipient = null;
                    let feeAmount = null;

                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "transfer") {
                                const senderAttr = event.attributes.find(attr => attr.key === "sender" && attr.value === contractAddress);
                                if (senderAttr) {
                                    withdrawnAmount = parseFloat(
                                        event.attributes.find(attr => attr.key === "amount")?.value.replace("inj", "") || 0
                                    ) / Math.pow(10, 18);
                                }
                            }
                            if (event.type === "transfer" && event.attributes.some(attr => attr.key === "recipient" && attr.value !== recipient)) {
                                feeRecipient = event.attributes.find(attr => attr.key === "recipient")?.value;
                                feeAmount = parseFloat(
                                    event.attributes.find(attr => attr.key === "amount")?.value.replace("inj", "") || 0
                                ) / Math.pow(10, 18);
                            }
                        });
                    });

                    // Add the parsed data to a structured format
                    taxData.push({
                        type: "Withdraw Funds from Candy Machine",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        contractAddress: contractAddress,
                        sender: sender,
                        recipient: recipient,
                        withdrawnAmount: withdrawnAmount,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        feeRecipient: feeRecipient,
                        feeAmount: feeAmount,
                        signed: signed
                    });

                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("withdraw_from_reserve")) {
                    const withdrawMessage = JSON.parse(message.message.msg);

                    // Extract details from the message
                    const sender = message.message.sender;
                    const contractAddress = message.message.contract;
                    const recipient = withdrawMessage.withdraw_from_reserve.address_to;
                    const tokenNumber = withdrawMessage.withdraw_from_reserve.token_number;
                    const funds = parseFloat(message.message.funds || 0) / Math.pow(10, 18); // Convert funds to INJ (if any)

                    // Extract details from transaction logs
                    let withdrawnAmount = null;
                    let feeRecipient = null;
                    let feeAmount = null;

                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "transfer") {
                                const senderAttr = event.attributes.find(attr => attr.key === "sender" && attr.value === contractAddress);
                                if (senderAttr) {
                                    withdrawnAmount = parseFloat(
                                        event.attributes.find(attr => attr.key === "amount")?.value.replace("inj", "") || 0
                                    ) / Math.pow(10, 18);
                                }
                            }
                            if (event.type === "transfer" && event.attributes.some(attr => attr.key === "recipient" && attr.value !== recipient)) {
                                feeRecipient = event.attributes.find(attr => attr.key === "recipient")?.value;
                                feeAmount = parseFloat(
                                    event.attributes.find(attr => attr.key === "amount")?.value.replace("inj", "") || 0
                                ) / Math.pow(10, 18);
                            }
                        });
                    });

                    // Add the parsed data to a structured format
                    taxData.push({
                        type: "Withdraw From Reserve",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        contractAddress: contractAddress,
                        sender: sender,
                        recipient: recipient,
                        tokenNumber: tokenNumber,
                        withdrawnAmount: withdrawnAmount,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        feeRecipient: feeRecipient,
                        feeAmount: feeAmount,
                        signed: signed
                    });
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("update_private_phase")) {

                    const parsedMessage = JSON.parse(message.message.msg);

                    // Extract details from the message
                    const sender = message.message.sender;
                    const contractAddress = message.message.contract;
                    const phaseId = parsedMessage.update_private_phase.phase_id;
                    const params = parsedMessage.update_private_phase.params;
                    const phaseName = params.name;
                    const walletsPath = params.wallets.path;
                    const previewURL = params.wallets.preview;
                    const merkleRoot = params.wallets.merkleRoot;
                    const startTime = new Date(params.start * 1000).toISOString();
                    const endTime = new Date(params.end * 1000).toISOString();
                    const isPrivate = params.private;

                    // Extract details from logs
                    let contractExecutionDetails = null;

                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "wasm" && event.attributes.some(attr => attr.key === "action" && attr.value === "update_private_phase")) {
                                contractExecutionDetails = {
                                    contractAddress: event.attributes.find(attr => attr.key === "_contract_address")?.value,
                                    action: event.attributes.find(attr => attr.key === "action")?.value,
                                    phaseId: event.attributes.find(attr => attr.key === "phase_id")?.value,
                                };
                            }
                        });
                    });

                    // Add parsed data to a structured format
                    taxData.push({
                        type: "Update Private Phase",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        sender: sender,
                        contractAddress: contractAddress,
                        phaseId: phaseId,
                        phaseName: phaseName,
                        walletsPath: walletsPath,
                        previewURL: previewURL,
                        merkleRoot: merkleRoot,
                        startTime: startTime,
                        endTime: endTime,
                        isPrivate: isPrivate,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        contractExecutionDetails: contractExecutionDetails,
                        signed: signed
                    })

                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("mint")) {
                    const mintMessage = JSON.parse(message.message.msg);


                    if (message.message.msg.includes("compose")) {
                        // TODO combining NFT items ?
                    }
                    else {
                        // Extract details from the message
                        const sender = message.message.sender;
                        const contractAddress = message.message.contract;
                        const owner = mintMessage.mint.owner;
                        const metadataUri = mintMessage.mint.metadata_uri;
                        const royalty = mintMessage.mint.royalty;
                        const royaltyBasisPoints = royalty?.seller_fee_basis_points || null;
                        const creators = royalty?.creators || [];
                        const primarySellHappened = royalty?.primary_sell_happened || false;

                        // Add the parsed data to a structured format
                        taxData.push({
                            type: "NFT Mint",
                            blockNumber: transaction.blockNumber,
                            blockTimestamp: transaction.blockTimestamp,
                            transactionHash: transaction.hash,
                            contractAddress: contractAddress,
                            sender: sender,
                            owner: owner,
                            metadataUri: metadataUri,
                            royaltyBasisPoints: royaltyBasisPoints,
                            creators: creators,
                            primarySellHappened: primarySellHappened,
                            gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                            gasUsed: transaction.gasUsed,
                            signed: signed
                        });
                    }


                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("approve_all")) {
                    const parsedMsg = JSON.parse(message.message.msg);

                    if (parsedMsg.approve_all) {
                        const { operator, expires } = parsedMsg.approve_all;
                        const { sender, contract } = message.message;

                        let added = false;

                        // Iterate through transaction logs
                        transaction.logs.forEach(log => {
                            const msgIndex = log.msg_index || 0
                            log.events.forEach(event => {
                                if (event.type === "wasm") {
                                    const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                    const operatorAttribute = event.attributes.find(attr => attr.key === "operator");

                                    if (
                                        actionAttribute &&
                                        actionAttribute.value === "approve_all" &&
                                        operatorAttribute &&
                                        operatorAttribute.value === operator &&
                                        parseInt(msgIndex) === index
                                    ) {
                                        added = true;

                                        taxData.push({
                                            type: "Approve All",
                                            blockNumber: transaction.blockNumber,
                                            blockTimestamp: transaction.blockTimestamp,
                                            transactionHash: transaction.hash,
                                            sender: sender,
                                            operator: operator,
                                            contract: contract,
                                            expiresAtHeight: expires ? expires.at_height : null,
                                            signed: signed
                                        });
                                    }
                                }
                            });
                        });

                        if (!added) {
                            console.warn(`No matching wasm log found for message index: ${index}`);
                        }
                    }
                }

                else if (message.type === "/cosmwasm.wasm.v1.MsgInstantiateContract" &&
                    (message.message.label === "CandyMachine Contract" || message.message.label === "Talis candy machine")
                ) {
                    const instantiateMessage = message.message.msg;

                    // Extract general details
                    const sender = message.message.sender;
                    const admin = instantiateMessage.admin;
                    const contractAddress = instantiateMessage.contract_address;
                    const feeCollector = instantiateMessage.fee_collector;
                    const codeId = instantiateMessage.codeId;
                    const label = instantiateMessage.label;
                    const reservedTokens = instantiateMessage.reserved_tokens;
                    const totalTokens = instantiateMessage.total_tokens;

                    // Extract private phases
                    const privatePhases = instantiateMessage.private_phases.map(phase => ({
                        id: phase.id,
                        private: phase.private,
                        start: new Date(phase.start * 1000).toISOString(),
                        end: new Date(phase.end * 1000).toISOString(),
                        price: phase.price.native.map(price => ({
                            denom: price.denom,
                            amount: parseFloat(price.amount) / Math.pow(10, 18), // Convert amount to human-readable format
                        })),
                        wlMerkleRoot: phase.wl_merkle_root,
                    }));

                    // Extract public phase
                    const publicPhase = {
                        id: instantiateMessage.public_phase.id,
                        private: instantiateMessage.public_phase.private,
                        start: new Date(instantiateMessage.public_phase.start * 1000).toISOString(),
                        end: new Date(instantiateMessage.public_phase.end * 1000).toISOString(),
                        price: instantiateMessage.public_phase.price.native.map(price => ({
                            denom: price.denom,
                            amount: parseFloat(price.amount) / Math.pow(10, 18), // Convert amount to human-readable format
                        })),
                        mintLimit: instantiateMessage.public_phase.mint_limit,
                    };

                    // Add the parsed data to a structured format
                    taxData.push({
                        type: "Instantiate Candy Machine",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        contractAddress: contractAddress,
                        sender: sender,
                        admin: admin,
                        feeCollector: feeCollector,
                        codeId: codeId,
                        label: label,
                        reservedTokens: reservedTokens,
                        totalTokens: totalTokens,
                        privatePhases: privatePhases,
                        publicPhase: publicPhase,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        signed: signed
                    });
                }

                else if (message.type === "/cosmwasm.wasm.v1.MsgInstantiateContract" && message.message.label === "Instantiate CW721") {
                    const instantiateMessage = message.message.msg;

                    // Extract general details
                    const sender = message.message.sender;
                    const admin = instantiateMessage.admin;
                    const contractAddress = message.logs?.[0]?.events.find(event => event.type === "cosmwasm.wasm.v1.EventContractInstantiated")?.attributes.find(attr => attr.key === "contract_address")?.value?.replace(/"/g, "");
                    const name = instantiateMessage.name;
                    const description = instantiateMessage.description;
                    const minter = instantiateMessage.minter;
                    const symbol = instantiateMessage.symbol;
                    const maxSupply = instantiateMessage.max_supply;
                    const codeId = instantiateMessage.codeId;
                    const label = instantiateMessage.label;

                    // Add the parsed data to a structured format
                    taxData.push({
                        type: "Instantiate NFT Collection",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        contractAddress: contractAddress,
                        sender: sender,
                        admin: admin,
                        name: name,
                        description: description,
                        minter: minter,
                        symbol: symbol,
                        maxSupply: maxSupply,
                        codeId: codeId,
                        label: label,
                        gasFee: parseFloat(transaction.gasFee.amounts[0].amount) / Math.pow(10, 18), // Convert gas fee to INJ
                        gasUsed: transaction.gasUsed,
                        signed: signed
                    });
                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("claim_rewards")) {
                    const msgContent = JSON.parse(message.message.msg);
                    const lpToken = msgContent.claim_rewards.lp_token;
                    const contractAddress = message.message.contract;

                    let added = false;

                    // Iterate through transaction logs
                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach(event => {
                            if (event.type === "coin_received") {
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");

                                const returnAsset = amountAttribute.value.replace(/^\d+/, '').trim();
                                const returnAmount = Number(amountAttribute.value.match(/^\d+/)[0])

                                if (
                                    receiverAttribute &&
                                    receiverAttribute.value === message.message.sender &&
                                    parseInt(msgIndex) === index
                                ) {
                                    added = true;
                                    taxData.push({
                                        type: "Mito Reward Claim",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        lpToken: lpToken,
                                        contractAddress: contractAddress,
                                        token: returnAsset,
                                        amountReceived: returnAmount,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn(`No matching reward claim log found for message index: ${index}`);
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (message.type === "/ibc.core.channel.v1.MsgRecvPacket" && message.message.packet) {
                    const packet = message.message.packet;

                    // Decode the `data` field from base64
                    const decodedData = JSON.parse(Buffer.from(packet.data, 'base64').toString('utf-8'));

                    // Extract necessary details
                    const sequence = packet.sequence;
                    const sourcePort = packet.source_port;
                    const sourceChannel = packet.source_channel;
                    const destinationPort = packet.destination_port;
                    const destinationChannel = packet.destination_channel;
                    const amount = decodedData.amount;
                    const denom = decodedData.denom;
                    const sender = decodedData.sender;
                    const receiver = decodedData.receiver;

                    // Construct the data for the taxData array
                    if (sender == walletAddress || receiver == walletAddress) {
                        taxData.push({
                            type: "IBC RecvPacket",
                            blockNumber: transaction.blockNumber,
                            blockTimestamp: transaction.blockTimestamp,
                            transactionHash: transaction.hash,
                            sequence,
                            sourcePort,
                            sourceChannel,
                            destinationPort,
                            destinationChannel,
                            amount,
                            denom,
                            sender,
                            receiver,
                            isSender: sender == walletAddress,
                            signed: signed
                        });
                    }


                }

                else if (message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" && message.message.msg.includes("redeem_and_transfer")) {
                    const { sender, contract, msg, funds } = message.message;

                    let parsedMsg = null;
                    let recipient = null;
                    let added = false;

                    try {
                        parsedMsg = JSON.parse(msg);
                        recipient = parsedMsg.redeem_and_transfer?.recipient || null;
                    } catch (error) {
                        console.error("Failed to parse the contract message:", error);
                    }

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const actionAttribute = event.attributes.find(attr => attr.key === "action" && attr.value === "transfer");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const fromAttribute = event.attributes.find(attr => attr.key === "from");
                                const toAttribute = event.attributes.find(attr => attr.key === "to");
                                const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;

                                if (
                                    actionAttribute &&
                                    amountAttribute &&
                                    fromAttribute &&
                                    toAttribute &&
                                    msgIndexAttribute !== undefined &&
                                    parseInt(msgIndexAttribute) === index
                                ) {
                                    added = true;

                                    taxData.push({
                                        type: "Mito LP Withdrawal",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contract: contract,
                                        recipient: recipient,
                                        amount: amountAttribute.value,
                                        from: fromAttribute.value,
                                        to: toAttribute.value,
                                        funds: funds,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching LP withdrawal log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (message.type === "/ibc.applications.transfer.v1.MsgTransfer") {
                    const { source_port, source_channel, token, sender, receiver, timeout_height, timeout_timestamp } = message.message;

                    let added = false;

                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach(event => {
                            if (event.type === "ibc_transfer") {
                                const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const denomAttribute = event.attributes.find(attr => attr.key === "denom");
                                const memoAttribute = event.attributes.find(attr => attr.key === "memo");

                                if (
                                    senderAttribute &&
                                    receiverAttribute &&
                                    amountAttribute &&
                                    denomAttribute &&
                                    parseInt(msgIndex) === index
                                ) {
                                    added = true;

                                    taxData.push({
                                        type: "IBC Token Transfer",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sourcePort: source_port,
                                        sourceChannel: source_channel,
                                        sender: senderAttribute.value,
                                        isSender: sender == walletAddress,
                                        receiver: receiverAttribute.value,
                                        denom: denomAttribute.value,
                                        amount: amountAttribute.value,
                                        timeoutHeight: timeout_height,
                                        timeoutTimestamp: timeout_timestamp,
                                        memo: memoAttribute ? memoAttribute.value : null,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        added = true;

                        taxData.push({
                            type: "IBC Token Transfer",
                            blockNumber: transaction.blockNumber,
                            blockTimestamp: transaction.blockTimestamp,
                            transactionHash: transaction.hash,
                            sourcePort: source_port,
                            sourceChannel: source_channel,
                            sender: sender,
                            isSender: sender == walletAddress,
                            receiver: receiver,
                            denom: token.denom,
                            amount: token.amount,
                            timeoutHeight: timeout_height,
                            timeoutTimestamp: timeout_timestamp,
                            signed: signed
                        });
                    }

                    if (!added) {
                        console.warn("No matching IBC token transfer log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg.includes("{\"send\":{\"contract\":\"inj14ejqjyq8um4p3xfqj74yld5waqljf88f9eneuk\"")
                ) {
                    const { sender, contract, msg, funds } = message.message;

                    let added = false;

                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const fromAttribute = event.attributes.find(attr => attr.key === "from");
                                const toAttribute = event.attributes.find(attr => attr.key === "to");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;


                                if (
                                    fromAttribute &&
                                    toAttribute &&
                                    amountAttribute &&
                                    actionAttribute?.value === "send" &&
                                    msgIndexAttribute !== undefined &&
                                    parseInt(msgIndexAttribute) === index
                                ) {
                                    added = true;

                                    const factoryTokenEvent = log.events.find(
                                        e => e.type === "injective.tokenfactory.v1beta1.EventMintTFDenom"
                                    );
                                    const factoryTokenDetails = factoryTokenEvent?.attributes.find(attr => attr.key === "amount");

                                    taxData.push({
                                        type: "CW20 to Factory Token Conversion",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: fromAttribute.value,
                                        receiver: toAttribute.value,
                                        adapterContract: contract,
                                        originalTokenAmount: amountAttribute.value,
                                        factoryToken: factoryTokenDetails ? JSON.parse(factoryTokenDetails.value) : null,
                                        fundsTransferred: funds,
                                        signed: signed,
                                    });
                                }

                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching CW20 to Factory Token conversion log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg.includes("\"provide_liquidity\"")
                ) {
                    const { sender, contract, msg, funds } = message.message;

                    let added = false;

                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                const senderAttribute = event.attributes.find(attr => attr.key === "sender");
                                const receiverAttribute = event.attributes.find(attr => attr.key === "receiver");
                                const assetsAttribute = event.attributes.find(attr => attr.key === "assets");
                                const shareAttribute = event.attributes.find(attr => attr.key === "share");
                                const refundAssetsAttribute = event.attributes.find(attr => attr.key === "refund_assets");

                                if (
                                    actionAttribute?.value === "provide_liquidity" &&
                                    senderAttribute &&
                                    receiverAttribute &&
                                    assetsAttribute &&
                                    shareAttribute &&
                                    parseInt(msgIndex) === index
                                ) {
                                    added = true;

                                    taxData.push({
                                        type: "Provide Liquidity",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: senderAttribute.value,
                                        receiver: receiverAttribute.value,
                                        contractAddress: contract,
                                        providedAssets: assetsAttribute.value.split(", "),
                                        liquidityShare: shareAttribute.value,
                                        refundAssets: refundAssetsAttribute?.value.split(", ") || [],
                                        fundsTransferred: funds,
                                        signed: signed,
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching liquidity provision log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (
                    (
                        message.type === "/cosmwasm.wasm.v1.MsgExecuteContract" ||
                        message.type === "/injective.wasmx.v1.MsgExecuteContractCompat"
                    ) &&
                    (
                        (typeof message.message.msg === "object" && message.message.msg.hasOwnProperty("transfer")) ||
                        (typeof message.message.msg === "string" && message.message.msg.includes("\"transfer\""))
                    )
                ) {
                    const { sender } = message.message;

                    let added = false;

                    // Iterate through transaction logs
                    transaction.logs.forEach(log => {
                        const msgIndex = log.msg_index
                        log.events.forEach(event => {
                            if (event.type === "wasm") {
                                const actionAttribute = event.attributes.find(attr => attr.key === "action");
                                const fromAttribute = event.attributes.find(attr => attr.key === "from");
                                const toAttribute = event.attributes.find(attr => attr.key === "to");
                                const amountAttribute = event.attributes.find(attr => attr.key === "amount");
                                const contractAddressAttribute = event.attributes.find(attr => attr.key === "_contract_address");

                                if (
                                    actionAttribute?.value === "transfer" &&
                                    fromAttribute &&
                                    toAttribute &&
                                    amountAttribute &&
                                    contractAddressAttribute &&
                                    parseInt(msgIndex) === index
                                ) {
                                    added = true;

                                    taxData.push({
                                        type: "CW20 Token Transfer",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        isSender: sender == walletAddress,
                                        sender: fromAttribute.value,
                                        recipient: toAttribute.value,
                                        contractAddress: contractAddressAttribute.value,
                                        amount: amountAttribute.value,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching CW20 token transfer log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg.includes("market_make")
                ) {
                    const { sender, contract } = message.message;

                    let added = false;

                    added = true;

                    taxData.push({
                        type: "Mito Market Make",
                        blockNumber: transaction.blockNumber,
                        blockTimestamp: transaction.blockTimestamp,
                        transactionHash: transaction.hash,
                        sender: sender,
                        contractAddress: contract,
                        signed: signed
                    });

                    if (!added) {
                        console.warn("No matching market make log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }


                else if (
                    message.type === "/injective.wasmx.v1.MsgExecuteContractCompat" &&
                    message.message.msg.includes("\"update_vault_config\"")
                ) {
                    const { sender, contract, msg } = message.message;

                    let vaultConfig;
                    try {
                        vaultConfig = JSON.parse(msg).update_vault_config;
                    } catch (error) {
                        console.error("Failed to parse msg for update_vault_config:", msg, error);
                        breakLoop = true;
                        return;
                    }

                    let added = false;

                    // Iterate through transaction logs
                    transaction.logs.forEach(log => {
                        log.events.forEach(event => {
                            if (event.type === "wasm-vault_config_updated") {
                                const contractAddressAttribute = event.attributes.find(attr => attr.key === "_contract_address");
                                const orderDensityAttribute = event.attributes.find(attr => attr.key === "order_density");
                                const maxInvariantSensitivityAttribute = event.attributes.find(attr => attr.key === "max_invariant_sensitivity_bps");
                                const maxPriceSensitivityAttribute = event.attributes.find(attr => attr.key === "max_price_sensitivity_bps");
                                const pricingStrategyAttribute = event.attributes.find(attr => attr.key === "pricing_strategy");
                                const feeBpsAttribute = event.attributes.find(attr => attr.key === "fee_bps");
                                const orderTypeAttribute = event.attributes.find(attr => attr.key === "order_type");
                                const notionalValueCapAttribute = event.attributes.find(attr => attr.key === "notional_value_cap");
                                const contractTypeAttribute = event.attributes.find(attr => attr.key === "contract_type");
                                const msgIndexAttribute = event.attributes.find(attr => attr.key === "msg_index")?.value || 0;

                                if (
                                    contractAddressAttribute &&
                                    msgIndexAttribute !== undefined &&
                                    parseInt(msgIndexAttribute) === index
                                ) {
                                    added = true;

                                    taxData.push({
                                        type: "Vault Config Update",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contractAddress: contract,
                                        owner: vaultConfig.owner,
                                        masterAddress: vaultConfig.master_address,
                                        subaccountId: vaultConfig.subaccount_id,
                                        feeRecipient: vaultConfig.fee_recipient,
                                        marketId: vaultConfig.market_id,
                                        orderDensity: orderDensityAttribute ? parseInt(orderDensityAttribute.value) : vaultConfig.order_density,
                                        notionalValueCap: notionalValueCapAttribute ? notionalValueCapAttribute.value : vaultConfig.notional_value_cap,
                                        pricingStrategy: pricingStrategyAttribute ? pricingStrategyAttribute.value : vaultConfig.pricing_strategy,
                                        maxInvariantSensitivityBps: maxInvariantSensitivityAttribute ? maxInvariantSensitivityAttribute.value : vaultConfig.max_invariant_sensitivity_bps,
                                        maxPriceSensitivityBps: maxPriceSensitivityAttribute ? maxPriceSensitivityAttribute.value : vaultConfig.max_price_sensitivity_bps,
                                        feeBps: feeBpsAttribute ? parseInt(feeBpsAttribute.value) : vaultConfig.fee_bps,
                                        orderType: orderTypeAttribute ? orderTypeAttribute.value : vaultConfig.order_type,
                                        contractType: contractTypeAttribute ? contractTypeAttribute.value : null,
                                        signed: signed
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching vault config update log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (message.type === "/injective.exchange.v1beta1.MsgDeposit") {
                    const { sender, subaccount_id, amount } = message.message;

                    let added = false;

                    transaction.logs.forEach((log) => {
                        const msgIndex = log.msg_index || 0
                        log.events.forEach((event) => {
                            if (event.type === "injective.exchange.v1beta1.EventSubaccountDeposit") {
                                const amountAttribute = event.attributes.find((attr) => attr.key === "amount");
                                const subaccountIdAttribute = event.attributes.find((attr) => attr.key === "subaccount_id");
                                const srcAddressAttribute = event.attributes.find((attr) => attr.key === "src_address");

                                if (parseInt(msgIndex) === index) {
                                    added = true;

                                    taxData.push({
                                        type: "Bank Sub Account Deposit",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        subaccountId: subaccount_id,
                                        amount: amount.amount,
                                        denom: amount.denom,
                                        sourceAddress: srcAddressAttribute ? JSON.parse(srcAddressAttribute.value) : sender,
                                        confirmedSubaccountId: subaccountIdAttribute ? JSON.parse(subaccountIdAttribute.value) : subaccount_id,
                                        signed: signed,
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching deposit log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }

                else if (message.type === "/injective.exchange.v1beta1.MsgExternalTransfer") {
                    const { sender, source_subaccount_id, destination_subaccount_id, amount } = message.message;

                    let added = false;

                    transaction.logs.forEach((log) => {
                        log.events.forEach((event) => {
                            if (event.type === "injective.exchange.v1beta1.EventSubaccountBalanceTransfer") {
                                const amountAttribute = event.attributes.find((attr) => attr.key === "amount");
                                const srcSubaccountIdAttribute = event.attributes.find((attr) => attr.key === "src_subaccount_id");
                                const dstSubaccountIdAttribute = event.attributes.find((attr) => attr.key === "dst_subaccount_id");
                                const msgIndexAttribute = event.attributes.find((attr) => attr.key === "msg_index")?.value;

                                if (msgIndexAttribute && parseInt(msgIndexAttribute) === index) {
                                    added = true;

                                    taxData.push({
                                        type: "Bank External Transfer",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        sourceSubaccountId: srcSubaccountIdAttribute ? JSON.parse(srcSubaccountIdAttribute.value) : source_subaccount_id,
                                        destinationSubaccountId: dstSubaccountIdAttribute ? JSON.parse(dstSubaccountIdAttribute.value) : destination_subaccount_id,
                                        amount: amount.amount,
                                        denom: amount.denom,
                                        signed: signed,
                                    });
                                }
                            }
                        });
                    });

                    if (!added) {
                        console.warn("No matching external transfer log found for the given message.");
                        console.log(JSON.stringify(transaction.hash, null, 2));

                        breakLoop = true;
                    }
                }
                else if (message.type === "/injective.peggy.v1.MsgSendToEth") {
                    let added = false;
                    try {
                        const sendToEthData = message.message;
                        const sender = sendToEthData.sender;
                        const ethDest = sendToEthData.eth_dest;
                        const denom = sendToEthData.amount.denom;
                        const amount = Number(sendToEthData.amount.amount);
                        const bridgeFee = Number(sendToEthData.bridge_fee.amount);

                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "injective.peggy.v1.EventSendToEth") {
                                    const outgoingTxIdAttr = event.attributes.find(attr => attr.key === "outgoing_tx_id");
                                    const outgoingTxId = outgoingTxIdAttr ? outgoingTxIdAttr.value.replace(/"/g, "") : null;

                                    const receiverAttr = event.attributes.find(attr => attr.key === "receiver");
                                    const receiver = receiverAttr ? receiverAttr.value.replace(/"/g, "") : ethDest;

                                    added = true;
                                    taxData.push({
                                        type: "Send to Ethereum",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        receiver: receiver,
                                        contractAddress: message.message.contract || null,
                                        denom: denom,
                                        amount: amount,
                                        bridgeFee: bridgeFee,
                                        outgoingTxId: outgoingTxId,
                                        signed: signed,
                                    });
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse send to Ethereum transaction:", error);
                    }

                    if (!added) {
                        console.log("Send to Ethereum - Unprocessed Transaction");
                        console.log(JSON.stringify(transaction, null, 2));
                    }
                }

                else if (message.type === "/injective.exchange.v1beta1.MsgPrivilegedExecuteContract" && message.message.data.includes("subscribe")) {
                    let added = false;
                    try {
                        const messageData = message.message;
                        const sender = messageData.sender;
                        const contractAddress = messageData.contract_address;
                        const fundsRaw = messageData.funds;
                        const data = JSON.parse(messageData.data);

                        const vaultSubaccountId = data.args?.vault_subaccount_id || null;
                        const traderSubaccountId = data.args?.trader_subaccount_id || null;
                        const slippageMaxPenalty = data.args?.msg?.subscribe?.slippage?.max_penalty || null;


                        // Extract additional details from logs
                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "wasm-lp_balance_changed") {
                                    const mintAmount = event.attributes.find(attr => attr.key === "mint_amount")?.value;
                                    const subscribedFundsRaw = event.attributes.find(attr => attr.key === "subscribed_funds")?.value;

                                    const subscribedFunds = subscribedFundsRaw
                                        ? JSON.parse(subscribedFundsRaw).map(fund => ({
                                            denom: fund.denom,
                                            amount: Number(fund.amount),
                                        }))
                                        : null;

                                    const lpRecievedEvent = log.events.find(x => x.type == "coin_received" && x.attributes.find(att => att.key == "receiver" && att.value == walletAddress))
                                    const lpRecieved = lpRecievedEvent.attributes.find(att => att.key == "amount").value
                                    const lpDenom = lpRecieved.split("factory")[1]

                                    added = true;
                                    taxData.push({
                                        type: "Mito Vault Subscription",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        contractAddress: contractAddress,
                                        vaultSubaccountId: vaultSubaccountId,
                                        traderSubaccountId: traderSubaccountId,
                                        slippageMaxPenalty: slippageMaxPenalty,
                                        returnAmount: mintAmount ? Number(mintAmount) : null,
                                        subscribedFunds: subscribedFunds,
                                        returnAsset: "factory" + lpDenom,
                                        signed: signed,
                                    });
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse vault subscription transaction:", error);
                    }

                    if (!added) {
                        console.log("Vault Subscription - Unprocessed Transaction");
                        console.log(JSON.stringify(transaction, null, 2));
                    }
                }

                else if (message.type === "/injective.exchange.v1beta1.MsgCancelSpotOrder") {
                    let added = false;
                    try {
                        const messageData = message.message;
                        const sender = messageData.sender;
                        const marketId = messageData.market_id;
                        const subaccountId = messageData.subaccount_id;
                        const orderHash = messageData.order_hash;

                        let returnAsset, returnAmount

                        // Parse logs to extract order details
                        transaction.logs.forEach(log => {
                            log.events.forEach(event => {
                                if (event.type === "injective.exchange.v1beta1.EventCancelSpotOrder") {
                                    const orderDetailsAttr = event.attributes.find(attr => attr.key === "order");
                                    const marketIdAttr = event.attributes.find(attr => attr.key === "market_id");

                                    let orderDetails = null;
                                    if (orderDetailsAttr) {
                                        orderDetails = JSON.parse(orderDetailsAttr.value);
                                    }

                                    const marketIdFromLog = marketIdAttr ? marketIdAttr.value.replace(/"/g, '') : null;

                                    const coinRecievedEvent = log.events.find(x => x.type == "coin_received" && x.attributes.find(att => att.key == "receiver" && att.value == walletAddress))
                                    if (coinRecievedEvent) {
                                        const amountReceived = coinRecievedEvent.attributes.find(att => att.key == "amount").value
                                        returnAsset = amountReceived.replace(/^\d+/, '').trim();
                                        returnAmount = Number(amountReceived.match(/^\d+/)[0])
                                    }


                                    added = true;
                                    taxData.push({
                                        type: "Cancel Spot Order",
                                        blockNumber: transaction.blockNumber,
                                        blockTimestamp: transaction.blockTimestamp,
                                        transactionHash: transaction.hash,
                                        sender: sender,
                                        marketId: marketId || marketIdFromLog,
                                        subaccountId: subaccountId,
                                        orderHash: orderHash,
                                        orderDetails: orderDetails,
                                        returnAsset: returnAsset,
                                        returnAmount: returnAmount,
                                        signed: signed,
                                    });
                                }
                            });
                        });
                    } catch (error) {
                        console.error("Failed to parse cancel spot order transaction:", error);
                    }

                    if (!added) {
                        console.log("Cancel Spot Order - Unprocessed Transaction");
                        console.log(JSON.stringify(transaction.hash, null, 2));
                    }
                }



                else if (message.type === "/ibc.core.client.v1.MsgUpdateClient") {
                    // TODO
                }


                else {
                    console.log("unprocessed tx")
                    console.log(JSON.stringify(transaction.hash, null, 2))

                    // breakLoop = true
                }
            }
            catch (e) {
                console.log(e)
                console.log(JSON.stringify(transaction.hash, null, 2))
                breakLoop = true
            }

        });

        if (breakLoop) {
            throw 'break'
        }
    });

    return taxData
}


