// Query: Protocol Adoption Metrics
// Measures growth rate of new alkanes and protocol usage over time
// Tracks percentage of transactions containing protostones vs. regular transactions

// Get block-by-block metrics of alkane creation
MATCH (b:block)
OPTIONAL MATCH (tx:tx)-[:inc]->(b)
OPTIONAL MATCH (tx)-[:shadow_out]->(p:protostone)
OPTIONAL MATCH (p)-[:trace]->(e:event {event_type: "create"})-[:creates]->(a:alkane)

// Group metrics by block
WITH 
    b.height AS block_height,
    b.time AS block_time,
    count(DISTINCT tx) AS total_txs,
    count(DISTINCT p) AS protostones_count,
    count(DISTINCT a) AS new_alkanes_count

// Group by time periods (daily)
WITH 
    toInteger(block_time) / 86400 AS day_timestamp,
    min(block_height) AS first_block_in_period,
    max(block_height) AS last_block_in_period,
    sum(total_txs) AS total_transactions,
    sum(protostones_count) AS total_protostones,
    sum(new_alkanes_count) AS total_new_alkanes,
    count(*) AS blocks_in_period
    
// Calculate protocol adoption metrics
WITH 
    toString(datetime({epochSeconds: day_timestamp * 86400})) AS day,
    day_timestamp,
    first_block_in_period,
    last_block_in_period,
    blocks_in_period,
    total_transactions,
    total_protostones,
    total_new_alkanes,
    CASE 
        WHEN total_transactions > 0
        THEN round(100.0 * total_protostones / total_transactions, 2)
        ELSE 0
    END AS protostone_tx_percentage,
    round(1.0 * total_new_alkanes / blocks_in_period, 2) AS new_alkanes_per_block,
    round(1.0 * total_protostones / blocks_in_period, 2) AS protostones_per_block

// Calculate cumulative metrics across all previous days
WITH day, day_timestamp, first_block_in_period, last_block_in_period, blocks_in_period,
     total_transactions, total_protostones, total_new_alkanes,
     protostone_tx_percentage, new_alkanes_per_block, protostones_per_block
ORDER BY day_timestamp

// Return protocol adoption metrics
RETURN 
    day,
    first_block_in_period,
    last_block_in_period,
    blocks_in_period,
    total_transactions,
    total_protostones,
    total_new_alkanes,
    protostone_tx_percentage,
    new_alkanes_per_block,
    protostones_per_block,
    // Calculate growth rates compared to previous periods
    CASE 
        WHEN LAG(total_new_alkanes, 1) OVER (ORDER BY day_timestamp) > 0
        THEN round(100.0 * (total_new_alkanes - LAG(total_new_alkanes, 1) OVER (ORDER BY day_timestamp)) / 
                  LAG(total_new_alkanes, 1) OVER (ORDER BY day_timestamp), 2)
        ELSE null
    END AS alkane_growth_rate_pct
ORDER BY day_timestamp DESC
LIMIT 30
