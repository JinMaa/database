// Event Type Distribution
// Analyzes the frequency of different event types in the graph
// Useful for identifying the most common protostone actions

// Get all event types and their counts
MATCH (e:event)
WITH e.type AS eventType, count(*) AS frequency
WHERE eventType IS NOT NULL

// Return sorted by frequency
RETURN 
    eventType,
    frequency,
    toFloat(frequency) / toFloat((MATCH (e:event) RETURN count(e))[0]) * 100 AS percentageOfAllEvents
ORDER BY frequency DESC;
