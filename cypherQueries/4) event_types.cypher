// Query: Event Types Distribution
// Shows the distribution of different event types in the graph
MATCH (e:event)
WITH e.event_type AS event_type, count(e) AS count
WITH collect({event_type: event_type, count: count}) AS rows, sum(count) AS total
UNWIND rows AS row
RETURN 
    row.event_type AS event_type,
    row.count AS count,
    round(100.0 * row.count / total, 2) AS percentage
ORDER BY row.count DESC
