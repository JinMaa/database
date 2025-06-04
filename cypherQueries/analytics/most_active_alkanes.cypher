// Query: Most Active Alkanes
// Identifies alkanes with the highest frequency of interactions (incoming and outgoing)
// Ranks them by total activity and breaks down by interaction types

// Find all alkanes and count their various interaction types
MATCH (a:alkane)
OPTIONAL MATCH (a)-[:caller]->(e:event)
WITH a, count(e) AS outgoing_calls

OPTIONAL MATCH (e:event)-[:transfer]->(a)
WITH a, outgoing_calls, count(e) AS incoming_transfers

OPTIONAL MATCH (e:event)-[:creates]->(a)
WITH a, outgoing_calls, incoming_transfers, count(e) AS creation_events

OPTIONAL MATCH (e:event)-[:myself]->(a)
WITH a, outgoing_calls, incoming_transfers, creation_events, count(e) AS self_references

OPTIONAL MATCH (e:event)-[:return_transfer]->(a)
WITH a, outgoing_calls, incoming_transfers, creation_events, self_references, count(e) AS return_transfers

// Calculate total activity and filter out inactive alkanes
WITH 
    a.id AS alkane_id,
    outgoing_calls,
    incoming_transfers,
    creation_events,
    self_references,
    return_transfers,
    (outgoing_calls + incoming_transfers + creation_events + self_references + return_transfers) AS total_activity
WHERE total_activity > 0

// Extract block and tx information from the alkane ID
WITH 
    alkane_id,
    split(alkane_id, ":")[0] AS block_height,
    split(alkane_id, ":")[1] AS tx_id,
    outgoing_calls,
    incoming_transfers,
    creation_events,
    self_references,
    return_transfers,
    total_activity

// Return results ordered by total activity
RETURN 
    alkane_id,
    toInteger(block_height) AS block_height,
    tx_id,
    outgoing_calls,
    incoming_transfers,
    creation_events,
    self_references,
    return_transfers,
    total_activity,
    round(100.0 * outgoing_calls / total_activity, 2) AS caller_percentage,
    round(100.0 * incoming_transfers / total_activity, 2) AS transfer_target_percentage
ORDER BY total_activity DESC
LIMIT 50
