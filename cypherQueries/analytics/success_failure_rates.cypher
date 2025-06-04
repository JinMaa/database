// Query: Success/Failure Rates
// Analyzes ratio of successful vs. failed events by type
// Identifies addresses with highest failure rates (potential problematic implementations)

// Match all events with success/failure flags
MATCH (e:event)
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e)
MATCH (caller:alkane)-[:caller]->(e)
OPTIONAL MATCH (e)-[:myself]->(myself:alkane)

// Determine success or failure status
WITH 
    caller.id AS caller_id,
    CASE WHEN myself IS NOT NULL THEN myself.id ELSE NULL END AS myself_id,
    e.event_type AS event_type,
    e.success AS success_flag,  // If your data model has explicit success flag
    // If there's no explicit flag, use this logic (adjust as needed):
    CASE 
        WHEN e.error_message IS NOT NULL AND e.error_message <> '' THEN false
        WHEN (e.event_type = 'invoke' OR e.event_type = 'create') AND myself IS NULL THEN false
        ELSE true
    END AS inferred_success,
    tx.txid AS txid,
    p.vout AS vout

// Use explicit success flag if available, otherwise use inferred success
WITH
    caller_id,
    myself_id,
    event_type,
    CASE
        WHEN success_flag IS NOT NULL THEN success_flag
        ELSE inferred_success
    END AS is_successful,
    txid,
    vout

// Group by caller and event type
WITH 
    caller_id,
    event_type,
    count(*) AS total_events,
    sum(CASE WHEN is_successful THEN 1 ELSE 0 END) AS successful_events,
    sum(CASE WHEN NOT is_successful THEN 1 ELSE 0 END) AS failed_events,
    collect({txid: txid, vout: vout})[0..5] AS sample_events
WHERE total_events > 5  // Only consider callers with sufficient event sample

// Calculate success and failure rates
WITH 
    caller_id,
    event_type,
    total_events,
    successful_events,
    failed_events,
    sample_events,
    round(100.0 * successful_events / total_events, 2) AS success_rate_pct,
    round(100.0 * failed_events / total_events, 2) AS failure_rate_pct
WHERE failed_events > 0  // Only show records with at least one failure

// Return the success/failure metrics
RETURN 
    caller_id,
    event_type,
    total_events,
    successful_events,
    failed_events,
    success_rate_pct,
    failure_rate_pct,
    sample_events
ORDER BY failure_rate_pct DESC, total_events DESC
LIMIT 50
