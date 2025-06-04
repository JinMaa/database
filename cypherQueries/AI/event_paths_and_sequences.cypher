// Event Paths and Sequences
// This query finds common sequences of events in protostones
// Helps identify protocol execution patterns in Alkanes

// First calculate the total count of protostones with multiple events
MATCH (p:protostone)
WHERE COUNT { (p)-[:trace]->() } > 1
WITH count(p) AS totalMultiEventProtostones

// Find protostones with multiple events
MATCH (p:protostone)-[:trace]->(e:event)
WITH p, collect(e.type) AS eventTypes, totalMultiEventProtostones
WHERE size(eventTypes) > 1

// For clearer results, we'll look for the most common event type combinations
WITH eventTypes, count(*) AS frequency, totalMultiEventProtostones
WHERE frequency > 1

// Sort events alphabetically within each combination for consistent grouping
WITH apoc.coll.sort(eventTypes) AS sortedEvents, frequency, totalMultiEventProtostones

RETURN 
    sortedEvents AS eventSequence,
    frequency AS occurrences,
    // Calculate what percentage of multi-event protostones have this pattern
    toFloat(frequency) / toFloat(totalMultiEventProtostones) * 100 AS percentageOfMultiEventProtostones
ORDER BY frequency DESC
LIMIT 20;
