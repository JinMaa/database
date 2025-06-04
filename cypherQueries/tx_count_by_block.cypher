// Query to get transaction count by block height
// Using $blockHeights parameter which is an array of block height integers
MATCH (b:block)
WHERE b.height IN $blockHeights
MATCH (b)<-[:inc]-(tx:tx)
RETURN b.height as block_height, COUNT(tx) as tx_count
ORDER BY b.height
