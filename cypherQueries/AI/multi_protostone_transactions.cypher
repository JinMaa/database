// Find transactions with multiple protostones
// This helps identify complex transactions that create multiple Alkanes protostones
// The results show which transactions have the most protostones and their block context

MATCH (tx:tx)-[:shadow_out]->(p:protostone)
WITH tx, collect(p) AS protostones, count(p) AS protostoneCount
WHERE protostoneCount > 1
MATCH (b:block)<-[:inc]-(tx)
RETURN 
    b.height AS blockHeight,
    b.time AS blockTime,
    tx.txid AS transactionId,
    protostoneCount,
    [p IN protostones | {vout: p.vout, eventCount: size((p)-[:trace]->())}] AS protostoneDetails
ORDER BY protostoneCount DESC, blockHeight DESC
LIMIT 20;
