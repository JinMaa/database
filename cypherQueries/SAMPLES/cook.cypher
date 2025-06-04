MATCH (n:protostone)<-[:shadow_out]-(m:tx)
MATCH (m)-[txindex:inc]->(b:block)
WHERE b.height >= 910 AND b.height <= 1000
WITH m, b,txindex, COUNT(n) as shadow_out_count
WHERE shadow_out_count = 2
MATCH (n:protostone)<-[:shadow_out]-(m)
RETURN n, m, b, txindex ORDER BY b.height