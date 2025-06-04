MATCH (a:alkane {tx:"21568"}) 
MATCH (invoke:event {event_type:"invoke"})-[:myself]->(a)
WHERE invoke.i0="103"
    MATCH (invoke)<-[:trace]-(p:protostone)
    MATCH (p)-[:trace]->(outcome:event)
    MATCH (tx:tx)-[:shadow_out]->(p)
    MATCH (tx)-[:inc]->(b:block)
    MATCH (out:output)<-[:out {vout:0.0}]-(tx)
    OPTIONAL MATCH (out)-[:locked]-(address:address)
    WITH b, address, outcome
    WHERE address.address="bc1p4r54cegkrunztcpenh2kx8gqmffdnl08vfhqazm57m9a375yfypsln2t5a"
RETURN b.height, address.address, outcome.clock_in_count
ORDER BY outcome.clock_in_count
