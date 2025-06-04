// Query: Protostone Execution Flow with Call Stack
// Shows protostones ordered by block height and tx index, with detailed event execution flow and alkane relationships

MATCH (p:protostone)<-[:shadow_out]-(tx:tx)-[inc:inc]->(b:block)
MATCH (p)-[:trace]->(e:event)

// Get all alkane relationships
OPTIONAL MATCH (source:alkane)-[caller_rel:caller]->(e)
OPTIONAL MATCH (e)-[transfer_rel:transfer]->(target:alkane)
OPTIONAL MATCH (e)-[creates_rel:creates]->(created:alkane)
OPTIONAL MATCH (e)-[myself_rel:myself]->(myself:alkane)
OPTIONAL MATCH (e)-[return_rel:return_transfer]->(returnTo:alkane)

// Collect all related alkanes with their relationship types
WITH 
    b.height AS block_height,
    inc.i AS tx_index,
    tx.txid AS txid,
    p.vout AS vout,
    p.protocol_tag AS protocol_tag,
    e.event_type AS event_type,
    e.data_type AS data_type,
    e.status AS status,
    e.fuel AS fuel,
    e.index AS event_index,
    e.raw_data AS event_data,
    p.id AS protostone_id,
    
    // Collect source alkanes with caller relationship
    collect(DISTINCT {
        type: "caller",
        alkane_id: source.id,
        relationship: "caller"
    }) AS source_alkanes,
    
    // Collect target alkanes with transfer relationship and value
    collect(DISTINCT {
        type: "transfer",
        alkane_id: target.id,
        relationship: "transfer",
        value: transfer_rel.value
    }) AS target_alkanes,
    
    // Collect created alkanes
    collect(DISTINCT {
        type: "creates", 
        alkane_id: created.id,
        relationship: "creates"
    }) AS created_alkanes,
    
    // Collect myself alkanes
    collect(DISTINCT {
        type: "myself",
        alkane_id: myself.id,
        relationship: "myself"
    }) AS myself_alkanes,
    
    // Collect return transfer alkanes with value
    collect(DISTINCT {
        type: "return_transfer",
        alkane_id: returnTo.id, 
        relationship: "return_transfer",
        value: return_rel.value
    }) AS return_alkanes

// Group everything by the protostone, tx, and event
ORDER BY block_height DESC, tx_index, event_index

// Return the fields
RETURN 
    block_height,
    tx_index,
    txid,
    vout,
    protocol_tag,
    event_type,
    data_type,
    status,
    fuel,
    event_index,
    
    // Format the alkane relationships for display using CASE WHEN instead of ternary operators
    [a IN source_alkanes WHERE a.alkane_id IS NOT NULL | a.alkane_id + " (" + a.relationship + ")"] AS source_alkanes,
    [a IN target_alkanes WHERE a.alkane_id IS NOT NULL | a.alkane_id + " (" + a.relationship + 
        CASE WHEN a.value IS NOT NULL THEN ", value: " + a.value ELSE "" END + ")"] AS target_alkanes,
    [a IN created_alkanes WHERE a.alkane_id IS NOT NULL | a.alkane_id + " (" + a.relationship + ")"] AS created_alkanes,
    [a IN myself_alkanes WHERE a.alkane_id IS NOT NULL | a.alkane_id + " (" + a.relationship + ")"] AS myself_alkanes,
    [a IN return_alkanes WHERE a.alkane_id IS NOT NULL | a.alkane_id + " (" + a.relationship + 
        CASE WHEN a.value IS NOT NULL THEN ", value: " + a.value ELSE "" END + ")"] AS return_alkanes,
    
    // Include raw event data for detailed inspection
    event_data
