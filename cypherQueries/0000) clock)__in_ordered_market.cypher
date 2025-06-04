MATCH (a:alkane {tx:"21568"}) 
MATCH (invoke:event {event_type:"invoke"})-[:myself]->(a)
WHERE invoke.i0="103"
    MATCH (invoke)<-[:trace]-(p:protostone)
    MATCH (p)-[:trace]->(outcome:event)
    MATCH (tx:tx)-[:shadow_out]->(p)
    MATCH (tx)-[:inc]->(b:block)
    MATCH (out:output)<-[:out {vout:0.0}]-(tx)
    MATCH (out2:output)<-[:out {vout:2.0}]-(tx)
    OPTIONAL MATCH (out2)-[:locked]-(address2:address)
    OPTIONAL MATCH (out)-[:locked]-(address:address)
WITH tx.txid as txid, 
     b.height as block_height, 
     address.address as address, 
     address2.address as feeaddress,
     outcome.clock_in_count as clock_in_count,
     CASE 
         WHEN address2.address IN ["bc1q43r9txp3t5x4m335mfjk73me8f3cn9u84fyz4s", "bc1qmlxyq75mwqzpersvrczt27zmekvhf8jku8vumd"] THEN "ordiscan"
         WHEN address2.address = "bc1q79m7f72fxyrc0hd7sgly3jnsqvpcj349lae76d" THEN "oyl"
         ELSE "other"
     END as category
WHERE clock_in_count IS NOT NULL
RETURN txid, block_height, address, feeaddress, category, clock_in_count
ORDER BY clock_in_count