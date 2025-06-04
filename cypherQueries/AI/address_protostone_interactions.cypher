// Addresses with Most Protostone Interactions
// This query identifies which addresses are most frequently associated with protostones
// Shows potential Alkanes power users or contracts with high activity

// Find addresses connected to transactions that have protostones
MATCH (address:address)<-[:locked]-(output:output)<-[:out]-(tx:tx)-[:shadow_out]->(protostone:protostone)
WITH address, count(DISTINCT protostone) AS protostoneCount
WHERE protostoneCount > 0

// Get details about the address and its protostone interactions
RETURN 
    address.address AS bitcoinAddress,
    protostoneCount,
    // Find the most common event types associated with this address's protostones
    [(address)<-[:locked]-(output)<-[:out]-(tx)-[:shadow_out]->(p)-[:trace]->(e) |
        e.type] AS associatedEventTypes
ORDER BY protostoneCount DESC
LIMIT 20;
