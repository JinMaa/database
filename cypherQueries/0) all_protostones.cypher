// Query: Protostone Analysis with Events
// Shows protostones with their event counts and types
MATCH (tx:tx)-[:shadow_out]->(p:protostone)
OPTIONAL MATCH (e:event)
WHERE tx.txid = split(e.protostone_txid, ":")[1] AND p.vout = toInteger(split(e.protostone_txid, ":")[2])
WITH 
    p,
    tx.txid AS txid,
    p.vout AS vout,
    p.protocol_tag AS protocol_tag,
    count(e) AS event_count,
    collect(DISTINCT e.event_type) AS event_types
MATCH (b:block)<-[:inc]-(tx:tx {txid: txid})
RETURN 
    txid,
    vout,
    protocol_tag,
    b.height AS block_height,
    event_count,
    event_types,
    p.raw_data AS raw_data
ORDER BY b.height DESC, txid, vout
