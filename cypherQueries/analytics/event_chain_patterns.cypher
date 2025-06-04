// Query: Event Chain Patterns
// Identifies most common sequences of events within protostones
// Helps detect recurring patterns that might indicate specific contract behaviors

// Match all protostones with their events
MATCH (p:protostone)-[:trace]->(e:event)
MATCH (tx:tx)-[:shadow_out]->(p)
MATCH (tx)-[:inc]->(b:block)

// Order events by their index within each protostone
WITH p, b.height AS block_height, tx.txid AS txid, p.vout AS vout, 
     e.event_type AS event_type, e.index AS event_index
ORDER BY p, event_index

// Group events by protostone
WITH p, block_height, txid, vout, 
     collect(event_type) AS event_sequence

// Count total protostones for percentage calculation
WITH count(p) AS total_protostones
MATCH (p:protostone)-[:trace]->(e:event)
MATCH (tx:tx)-[:shadow_out]->(p)
MATCH (tx)-[:inc]->(b:block)

// Group events by protostone again to get the sequences
WITH total_protostones, p, b.height AS block_height, tx.txid AS txid, p.vout AS vout, 
     collect(e.event_type ORDER BY e.index) AS event_sequence

// Group identical event sequences
WITH total_protostones, event_sequence, 
     count(*) AS frequency, 
     collect({txid: txid, vout: vout, block: block_height}) AS occurrences
WHERE size(event_sequence) > 1  // Only interested in sequences with multiple events

// Calculate pattern metrics
WITH 
    total_protostones,
    event_sequence,
    frequency,
    occurrences[0..5] AS example_occurrences,  // Show only a few examples
    size(event_sequence) AS sequence_length,
    reduce(s = "", x IN event_sequence | s + (CASE WHEN s = "" THEN "" ELSE "→" END) + x) AS chain_pattern
    
// Return the results
RETURN 
    chain_pattern,
    frequency,
    sequence_length,
    example_occurrences,
    event_sequence,
    round(100.0 * frequency / total_protostones, 2) AS percentage_of_all_protostones
ORDER BY frequency DESC
LIMIT 30
