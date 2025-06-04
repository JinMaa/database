MATCH (a:alkane {tx:"21568"}) 
MATCH (invoke:event {event_type:"invoke"})-[:myself]->(a)
WHERE invoke.i0="103"
    MATCH (invoke)<-[:trace]-(p:protostone)
    MATCH (p)-[:trace]->(outcome:event)
    MATCH (tx:tx)-[:shadow_out]->(p)
    MATCH (tx)-[:inc]->(b:block)
    MATCH (out:output)<-[:out {vout:0.0}]-(tx)
    OPTIONAL MATCH (out)-[:locked]-(address:address)
WITH tx.txid as txid, 
     b.height as block_height, 
     address.address as address,
     outcome.clock_in_count as clock_in_count
WHERE clock_in_count IS NOT NULL
RETURN txid, block_height, address, clock_in_count
ORDER BY clock_in_count