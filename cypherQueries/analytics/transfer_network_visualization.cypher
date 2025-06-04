// Query: Transfer Network Visualization
// Creates a graph showing value flow between alkanes
// Helps identify central "hub" alkanes that facilitate many transfers

// Match all transfer events between alkanes
MATCH (source:alkane)-[:caller]->(e:event {event_type: "transfer"})-[:transfer]->(target:alkane)
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e)

// Group transfers by source and target alkanes
WITH 
    source.id AS source_id,
    target.id AS target_id,
    count(*) AS transfer_count,
    collect(e.value) AS transfer_values,
    collect(tx.txid) AS transaction_ids

// Calculate total and average transfer values where available
WITH 
    source_id,
    target_id,
    transfer_count,
    [val IN transfer_values WHERE val IS NOT NULL] AS numeric_values,
    transaction_ids[0..5] AS sample_transactions
    
// Sum up values and prepare for visualization
WITH 
    source_id,
    target_id,
    transfer_count,
    CASE 
        WHEN size(numeric_values) > 0 
        THEN reduce(s = 0, v IN numeric_values | s + toInteger(v)) 
        ELSE 0 
    END AS total_value,
    sample_transactions

// Calculate metrics for visualization
RETURN 
    source_id AS source,
    target_id AS target,
    transfer_count,
    total_value,
    sample_transactions,
    CASE
        WHEN total_value > 0 
        THEN round(1.0 * total_value / transfer_count, 2)
        ELSE 0
    END AS avg_transfer_value,
    // Logarithmic scaling for visualization (1-10 scale)
    CASE 
        WHEN transfer_count = 0 THEN 1
        WHEN transfer_count = 1 THEN 2
        WHEN transfer_count <= 3 THEN 3
        WHEN transfer_count <= 5 THEN 4
        WHEN transfer_count <= 10 THEN 5
        WHEN transfer_count <= 20 THEN 6
        WHEN transfer_count <= 50 THEN 7
        WHEN transfer_count <= 100 THEN 8
        WHEN transfer_count <= 200 THEN 9
        ELSE 10
    END AS edge_weight
ORDER BY transfer_count DESC
LIMIT 250
