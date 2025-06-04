// Find protostones with the most events
// This query returns protostones sorted by number of event nodes connected to them

MATCH (p:protostone)-[:trace]->(e:event)
WITH p, count(e) AS eventCount
RETURN 
    p.txid AS txid,
    p.vout AS vout,
    p.eventTypes AS eventTypesList,
    eventCount AS numberOfEvents
ORDER BY eventCount DESC
LIMIT 20;

// To also include the full list of event types for each protostone:
MATCH (p:protostone)-[:trace]->(e:event)
WITH p, collect(e.type) AS eventTypes, count(e) AS eventCount
RETURN 
    p.txid AS txid,
    p.vout AS vout,
    eventTypes,
    eventCount AS numberOfEvents
ORDER BY eventCount DESC
LIMIT 20;
