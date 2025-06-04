// First, get all blocks and their total transaction counts
MATCH (b:block)
WHERE b.height >= 898422
OPTIONAL MATCH (all_tx:tx)-[:inc]->(b)
WITH b.height as block_height, count(all_tx) as total_tx_count

// Then get clock-in transactions by category
MATCH (a:alkane {tx:"21568"}) 
MATCH (invoke:event {event_type:"invoke"})-[:myself]->(a)
WHERE invoke.i0="103"
MATCH (invoke)<-[:trace]-(p:protostone)
MATCH (p)-[:trace]->(outcome:event)
MATCH (tx:tx)-[:shadow_out]->(p)
MATCH (tx)-[:inc]->(b:block)
WHERE b.height IN [block_height]
OPTIONAL MATCH (out2:output)<-[:out {vout:2.0}]-(tx)
OPTIONAL MATCH (out2)-[:locked]-(address2:address)
WITH block_height, total_tx_count, address2.address as feeaddress, outcome.clock_in_count as clock_in_count,
     CASE 
         WHEN address2.address IN ["bc1q43r9txp3t5x4m335mfjk73me8f3cn9u84fyz4s", "bc1qmlxyq75mwqzpersvrczt27zmekvhf8jku8vumd", 
                                  "bc1qfy3hetg6ctvqy7lzfc42t8xqpanjhmg4zadv0e", "bc1q7hgfu6v5lmhht9p6n3wks6ptny47r2z6xupjk3", 
                                  "bc1qq5rpmmpr4rn3d8w0s3plzzmzsj7mjv3hhmmx4g", "bc1qc2ksammzyrg055lwqnzrjun78rha826x5hk4wc", 
                                  "bc1qrnhgykwy3986jexh85pfun5t2gw4mhf5frjju6", "bc1qh45canh90054hl736ewc738zpx7vfjsc8tpqpp", "bc1qfavxp4hyzczg5u8r6x7vcz96nrxkh6d7nn4j9m"] THEN "ordiscan"
         WHEN address2.address = "bc1q79m7f72fxyrc0hd7sgly3jnsqvpcj349lae76d" THEN "oyl"
         ELSE "other_clock_in"
     END as category
WHERE clock_in_count IS NOT NULL

// Group by block height and category
WITH block_height, total_tx_count, category, COUNT(*) as count

// Aggregate the counts by category for each block
WITH block_height, total_tx_count,
     SUM(CASE WHEN category = 'oyl' THEN count ELSE 0 END) as oyl_count,
     SUM(CASE WHEN category = 'ordiscan' THEN count ELSE 0 END) as ordiscan_count,
     SUM(CASE WHEN category = 'other_clock_in' THEN count ELSE 0 END) as other_clock_in_count

// Calculate the total clock-in count
WITH block_height, total_tx_count, oyl_count, ordiscan_count, other_clock_in_count,
     (oyl_count + ordiscan_count + other_clock_in_count) as total_clock_in_count

// Return the final results
RETURN block_height, 
       oyl_count,
       ordiscan_count,
       other_clock_in_count,
       total_clock_in_count,
       total_tx_count
ORDER BY block_height
