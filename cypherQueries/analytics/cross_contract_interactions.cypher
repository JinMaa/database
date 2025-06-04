// Query: Cross-Contract Interactions
// Analyzes how alkanes call each other and the depth of call stacks
// Correlates call depth with gas consumption patterns

// Find all invoke events between contracts and their call stacks
MATCH path = (caller:alkane)-[:caller]->(:event {event_type: "invoke"})-[:myself]->(receiver:alkane)
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e:event)
WHERE (caller)-[:caller]->(e)
OPTIONAL MATCH (tx)-[:inc]->(b:block)

// Get the call stack depth by following the caller chain
WITH 
    caller.id AS caller_id,
    receiver.id AS receiver_id,
    e.index AS event_index,
    e.fuel AS fuel_cost,
    b.height AS block_height,
    tx.txid AS txid,
    p.vout AS vout,
    length(path) AS path_length

// Calculate call stack depths
OPTIONAL MATCH caller_path = (root:alkane)-[:caller*]->(e2:event)-[:myself]->(caller)
WHERE NOT ((:alkane)-[:caller]->(:event)-[:myself]->(root))

// Calculate full path metrics
WITH 
    caller_id,
    receiver_id,
    event_index,
    fuel_cost,
    block_height,
    txid,
    vout,
    path_length,
    CASE 
        WHEN caller_path IS NULL THEN 1 
        ELSE length(caller_path) + 1
    END AS call_stack_depth

// Group by caller and receiver to see interaction patterns
WITH 
    caller_id,
    receiver_id,
    count(*) AS interaction_count,
    avg(call_stack_depth) AS avg_call_depth,
    max(call_stack_depth) AS max_call_depth,
    min(block_height) AS first_interaction_block,
    max(block_height) AS latest_interaction_block,
    collect({txid: txid, vout: vout, block: block_height})[0..5] AS sample_interactions,
    avg(CASE WHEN fuel_cost IS NOT NULL THEN toInteger(fuel_cost) ELSE 0 END) AS avg_fuel_cost
WHERE caller_id <> receiver_id  // Filter out self-calls

// Return the interaction data
RETURN 
    caller_id AS source_alkane,
    receiver_id AS target_alkane,
    interaction_count,
    round(avg_call_depth, 2) AS avg_call_depth,
    max_call_depth,
    first_interaction_block,
    latest_interaction_block,
    latest_interaction_block - first_interaction_block AS block_span,
    sample_interactions,
    round(avg_fuel_cost, 0) AS avg_fuel_cost,
    // Calculate correlation between call depth and fuel cost
    CASE 
        WHEN avg_call_depth > 1 AND avg_fuel_cost > 0
        THEN round(avg_fuel_cost / avg_call_depth, 2)
        ELSE 0
    END AS fuel_per_call_depth
ORDER BY interaction_count DESC
LIMIT 50
