// Query: All Alkanes by Block Height
// Returns all alkanes sorted by block height
MATCH (a:alkane)
OPTIONAL MATCH (a)<-[rel]-(e:event)
WITH a, count(e) AS event_count
RETURN 
    a.id AS alkane_id,
    a.block AS block_height,
    a.tx AS tx_id,
    event_count
ORDER BY a.block DESC
