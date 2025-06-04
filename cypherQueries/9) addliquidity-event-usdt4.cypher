MATCH (n:tx {txid:"4d7ae03fbb63c9eedf0e32311307d00e81d48e4593a182711ef6bbe95ddcb3fe"})
MATCH (n)-[:shadow_out]->(p:protostone)
MATCH (p)-[:trace]->(e:event)
MATCH (e)<-[]-(a:alkane)

RETURN n,p,e,a