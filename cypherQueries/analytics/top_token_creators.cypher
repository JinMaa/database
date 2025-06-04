// Query: Top Token Creators
// Identifies addresses that have created the most alkanes
// Shows block information and creation patterns

// Find all creation events with their source addresses
MATCH (caller:alkane)-[:caller]->(e:event {event_type: "create"})-[:creates]->(created:alkane)
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e)
MATCH (tx)-[:inc]->(b:block)
OPTIONAL MATCH (tx)-[:out]->(o:output)-[:locked]->(addr:address)
WHERE o.n = 0  // Primary output address

// Collect results by creator addresses
WITH 
    CASE 
        WHEN addr IS NOT NULL THEN addr.address
        ELSE 'Unknown Address'
    END AS creator_address,
    caller.id AS caller_id,
    created.id AS created_id,
    b.height AS block_height,
    b.time AS block_timestamp,
    tx.txid AS transaction_id
    
// Group by creator address
WITH 
    creator_address,
    count(DISTINCT created_id) AS total_creations,
    collect(DISTINCT created_id) AS created_alkanes,
    min(block_height) AS first_creation_block,
    max(block_height) AS latest_creation_block,
    count(DISTINCT block_height) AS unique_blocks_created_in
WHERE total_creations > 0

// Calculate dateTime metrics from timestamps if available
WITH
    creator_address,
    total_creations,
    created_alkanes[0..5] AS sample_created_alkanes,  // Show only a sample of alkanes
    first_creation_block,
    latest_creation_block,
    unique_blocks_created_in,
    CASE 
        WHEN latest_creation_block > first_creation_block
        THEN round(1.0 * total_creations / (latest_creation_block - first_creation_block), 4)
        ELSE total_creations
    END AS creations_per_block

// Return the summary data
RETURN 
    creator_address,
    total_creations,
    sample_created_alkanes,
    size(sample_created_alkanes) AS total_sample_size,
    first_creation_block,
    latest_creation_block,
    unique_blocks_created_in,
    creations_per_block,
    unique_blocks_created_in * 100.0 / (latest_creation_block - first_creation_block + 1) AS block_coverage_percentage
ORDER BY total_creations DESC
LIMIT 25
