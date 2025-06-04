// Co-occurring Event Patterns
// This query identifies which event types commonly occur together in the same protostone
// Useful for understanding related Alkanes operations and protocol patterns

MATCH (p:protostone)-[:trace]->(e1:event)
MATCH (p)-[:trace]->(e2:event)
WHERE e1.type < e2.type  // Prevent counting the same pair twice
WITH e1.type AS event1, e2.type AS event2, count(p) AS coOccurrenceCount
WHERE coOccurrenceCount > 1

// Create a co-occurrence matrix
RETURN 
    event1,
    event2,
    coOccurrenceCount,
    // Calculate how often these events occur individually
    {
      WITH (MATCH (p:protostone)-[:trace]->(e:event) WHERE e.type = event1 RETURN count(e)) AS event1Count,
           (MATCH (p:protostone)-[:trace]->(e:event) WHERE e.type = event2 RETURN count(e)) AS event2Count
      RETURN {
        event1Total: event1Count[0],
        event2Total: event2Count[0],
        percentOfEvent1: toFloat(coOccurrenceCount) / event1Count[0] * 100,
        percentOfEvent2: toFloat(coOccurrenceCount) / event2Count[0] * 100
      }
    } AS statistics
ORDER BY coOccurrenceCount DESC
LIMIT 25;
