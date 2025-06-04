// Protostone Event Timeline Analysis
// This query analyzes event timeline by block height to see the evolution of different event types over time
// Helps identify trends and patterns in protostone activity

MATCH (b:block)<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e:event)
WITH b.height AS blockHeight, b.time AS blockTime, e.type AS eventType, count(e) AS eventCount
ORDER BY blockHeight

// Group by height ranges for a clearer trend view - adjust interval as needed
WITH 
    floor(blockHeight/100)*100 AS heightBucket, 
    eventType,
    sum(eventCount) AS totalEvents,
    min(blockTime) AS startTime,
    max(blockTime) AS endTime
    
RETURN 
    heightBucket AS blockHeightRange, 
    toString(heightBucket) + '-' + toString(heightBucket + 99) AS heightRange,
    eventType,
    totalEvents,
    startTime,
    endTime,
    datetime({epochSeconds: startTime}) AS startDateTime,
    datetime({epochSeconds: endTime}) AS endDateTime
ORDER BY heightBucket, totalEvents DESC;
