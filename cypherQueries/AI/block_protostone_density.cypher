// Block Protostone Density Analysis
// Identifies blocks with the highest concentration of protostone activity
// Useful for finding "hotspots" of Alkanes protocol usage

MATCH (b:block)<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)
WITH 
    b,
    count(DISTINCT tx) AS txWithProtostonesCount,
    count(p) AS protostoneCount,
    collect(p) AS protostones
    
// Get the total transaction count for the block
MATCH (b)<-[:inc]-(allTx:tx)
WITH 
    b,
    count(allTx) AS totalTxCount,
    txWithProtostonesCount,
    protostoneCount,
    protostones
    
// Calculate event data
MATCH (p:protostone)-[:trace]->(e:event)
WHERE p IN protostones
WITH 
    b,
    totalTxCount,
    txWithProtostonesCount,
    protostoneCount,
    count(e) AS eventCount,
    collect(DISTINCT e.type) AS eventTypes
    
RETURN 
    b.height AS blockHeight,
    b.hash AS blockHash,
    datetime({epochSeconds: b.time}) AS blockTime,
    totalTxCount,
    txWithProtostonesCount,
    (toFloat(txWithProtostonesCount) / totalTxCount * 100) AS percentTxWithProtostones,
    protostoneCount,
    (toFloat(protostoneCount) / totalTxCount) AS protosonesPerTx,
    eventCount,
    (toFloat(eventCount) / protostoneCount) AS eventsPerProtostone,
    eventTypes
ORDER BY protostoneCount DESC
LIMIT 25;
