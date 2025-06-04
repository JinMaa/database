// UTXO (Unspent Transaction Output) Analysis
// This query provides insights into the current UTXO set

// Find all unspent outputs and their details
MATCH (tx:tx)-[:out]->(output:output:unspent)
OPTIONAL MATCH (output)-[:locked]->(address:address)
WITH 
    output,
    tx,
    address,
    CASE WHEN output:coinbase THEN true ELSE false END AS isCoinbase
    
RETURN 
    tx.txid AS transactionId,
    output.index AS outputIndex,
    output.value AS value,
    isCoinbase AS isCoinbaseOutput,
    address.address AS bitcoinAddress,
    EXISTS((tx)<-[:inc]-(:block {height: 0})) AS isGenesisBlock,
    // Check if this unspent output is associated with a protostone
    EXISTS((tx)-[:shadow_out]->(:protostone)) AS hasProtostone
ORDER BY output.value DESC
LIMIT 100;

// Get UTXO set distribution by address
MATCH (output:output:unspent)-[:locked]->(address:address)
WITH 
    address.address AS bitcoinAddress,
    count(output) AS utxoCount,
    sum(output.value) AS totalValue
WHERE utxoCount > 0
RETURN 
    bitcoinAddress,
    utxoCount,
    totalValue,
    // Find the highest value UTXO for this address
    [(output:output:unspent)-[:locked]->(address {address: bitcoinAddress}) | output.value][-1] AS highestValueUtxo
ORDER BY totalValue DESC
LIMIT 20;

// Get UTXO age distribution (by block height)
MATCH (block:block)<-[:inc]-(tx:tx)-[:out]->(output:output:unspent)
WITH 
    block.height AS blockHeight,
    count(output) AS utxoCount,
    sum(output.value) AS totalValue
WITH blockHeight, utxoCount, totalValue,
     toFloat(utxoCount * 100.0) / toFloat((MATCH (o:output:unspent) RETURN count(o))[0]) AS percentOfTotalUtxos
RETURN 
    blockHeight,
    utxoCount,
    totalValue,
    percentOfTotalUtxos
ORDER BY blockHeight DESC
LIMIT 50;
