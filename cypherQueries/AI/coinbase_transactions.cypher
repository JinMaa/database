// Coinbase Transaction Analysis
// This query analyzes coinbase transactions and their outputs in the blockchain

// Find all coinbase transactions and their details
MATCH (block:block)<-[:inc]-(tx:tx)<-[:in]-(coinbase:output:coinbase)
WITH block, tx, coinbase
MATCH (tx)-[:out]->(output)
WITH 
    block.height AS blockHeight,
    block.hash AS blockHash,
    tx.txid AS transactionId,
    coinbase.coinbase_script AS coinbaseScript,
    collect(output) AS outputs,
    sum(output.value) AS totalBlockReward
RETURN 
    blockHeight,
    blockHash,
    transactionId,
    coinbaseScript,
    size(outputs) AS outputCount,
    totalBlockReward,
    [output IN outputs | {
        vout: output.n, 
        value: output.value,
        hasAddress: exists((output)-[:locked]->(:address))
    }] AS outputDetails
ORDER BY blockHeight
LIMIT 50;
