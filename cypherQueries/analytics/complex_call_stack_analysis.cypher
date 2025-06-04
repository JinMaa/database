// Query: Complex Call Stack Analysis
// Identifies and analyzes the deepest call stacks in the network
// Correlates call stack depth with success rate and execution patterns

// Find all events and their relationships
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e:event)
MATCH (tx)-[:inc]->(b:block)
OPTIONAL MATCH (caller:alkane)-[:caller]->(e)

// Trace the call stack path for each event
OPTIONAL MATCH call_path = (root:alkane)-[:caller*]->(e1:event)-[:myself*0..1]->(caller)
WHERE NOT ((:alkane)-[:caller]->(:event)-[:myself]->(root))

// Calculate call stack metrics
WITH 
    tx.txid AS txid,
    p.vout AS vout,
    b.height AS block_height,
    e.event_type AS event_type,
    e.index AS event_index,
    CASE 
        WHEN call_path IS NULL THEN 1
        ELSE length(call_path) + 1
    END AS call_stack_depth,
    e.success AS success_flag,
    // If there's no explicit success flag, infer from event data (adjust as needed)
    CASE 
        WHEN e.error_message IS NOT NULL AND e.error_message <> '' THEN false
        WHEN e.event_type = 'invoke' AND NOT (e)-[:myself]->(:alkane) THEN false
        ELSE true
    END AS inferred_success

// Use explicit success flag if available, otherwise use inferred success
WITH
    txid,
    vout,
    block_height,
    event_type,
    event_index,
    call_stack_depth,
    CASE
        WHEN success_flag IS NOT NULL THEN success_flag
        ELSE inferred_success
    END AS is_successful

// Group events by protostone call stack
WITH 
    txid,
    vout,
    block_height,
    collect({
        event_type: event_type,
        event_index: event_index,
        call_stack_depth: call_stack_depth,
        is_successful: is_successful
    }) AS events,
    max(call_stack_depth) AS max_stack_depth,
    count(*) AS total_events,
    sum(CASE WHEN is_successful THEN 1 ELSE 0 END) AS successful_events
WHERE max_stack_depth > 1  // Only interested in actual call stacks

// Calculate success rate and other metrics
WITH 
    txid,
    vout,
    block_height,
    events,
    max_stack_depth,
    total_events,
    successful_events,
    round(100.0 * successful_events / total_events, 2) AS success_rate_pct,
    count(CASE WHEN events.event_type = 'invoke' THEN 1 END) AS invoke_count,
    count(CASE WHEN events.event_type = 'create' THEN 1 END) AS create_count,
    count(CASE WHEN events.event_type = 'transfer' THEN 1 END) AS transfer_count

// Return the complex call stack analysis
RETURN 
    txid,
    vout,
    block_height,
    max_stack_depth,
    total_events,
    success_rate_pct,
    invoke_count,
    create_count,
    transfer_count,
    events[0..10] AS sample_events,  // Show only first 10 events in stack
    CASE 
        WHEN max_stack_depth > 0 AND total_events > 0
        THEN round(1.0 * total_events / max_stack_depth, 2)
        ELSE 0
    END AS events_per_stack_level
ORDER BY max_stack_depth DESC, total_events DESC
LIMIT 50
