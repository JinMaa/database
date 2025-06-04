// Protostone and Event Relationships Analysis
// This query shows how protostones connect to transactions, outputs and events

// Find all protostones and their related events in the graph
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e:event)
WITH p, tx, collect(e) AS events

// Get block information
MATCH (b:block)<-[:inc]-(tx)

// Get any related real outputs if they exist
OPTIONAL MATCH (tx)-[:out]->(output:output)

RETURN 
    b.height AS blockHeight,
    b.hash AS blockHash,
    tx.txid AS transactionId,
    p.txid AS protostone_txid,
    p.vout AS protostone_vout,
    p.event_count AS eventCount,
    p.event_types AS eventTypesList,
    [event in events | event.event_type] AS eventTypes,
    COUNT(output) AS realOutputCount
ORDER BY blockHeight DESC, eventCount DESC
LIMIT 50;
