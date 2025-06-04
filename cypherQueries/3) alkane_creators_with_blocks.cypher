// Query: Alkane Creators With Block Details
// Shows all created alkanes with their creator addresses and block information
MATCH (m:alkane)<-[:creates]-(e)
MATCH (p:protostone)-[:trace]->(e)
MATCH (t:tx)-[:shadow_out]->(p)
OPTIONAL MATCH (t)-[:out {vout:0.0}]->(o:output)-[:locked]->(a:address)
MATCH (t)-[:inc]->(b:block)
RETURN m.id AS alkane_id, t.txid AS txid, a.address AS address, b.height AS block_height
ORDER BY b.height DESC
