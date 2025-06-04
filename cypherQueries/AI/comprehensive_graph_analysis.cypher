// Comprehensive Graph Analysis
// This query provides a complete overview of your Neo4j Alkanes graph
// Combines multiple metrics for a holistic view of the data

// Part 1: Global Statistics
CALL {
    MATCH (b:block) RETURN count(b) AS blockCount
}

CALL {
    MATCH (tx:tx) RETURN count(tx) AS txCount
}

CALL {
    MATCH (o:output) RETURN count(o) AS outputCount
}

CALL {
    MATCH (a:address) RETURN count(a) AS addressCount
}

CALL {
    MATCH (p:protostone) RETURN count(p) AS protostoneCount
}

CALL {
    MATCH (e:event) RETURN count(e) AS eventCount
}

// Part 2: Protostone Analysis
CALL {
    MATCH (p:protostone)
    WITH count(p) AS totalProtostones
    MATCH (p:protostone)-[:trace]->(e:event)
    WITH totalProtostones, count(DISTINCT p) AS protosonesWithEvents
    RETURN 
        totalProtostones,
        protosonesWithEvents,
        totalProtostones - protosonesWithEvents AS protosonesWithoutEvents,
        toFloat(protosonesWithEvents) / totalProtostones * 100 AS percentWithEvents
}

// Part 3: Top Blocks by Protostone Count
CALL {
    MATCH (b:block)<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)
    WITH b, count(p) AS protostoneCount
    ORDER BY protostoneCount DESC
    LIMIT 5
    RETURN collect({height: b.height, hash: b.hash, time: datetime({epochSeconds: b.time}), protostoneCount: protostoneCount}) AS topBlocks
}

// Part 4: Top Event Types
CALL {
    MATCH (e:event)
    WITH e.type AS eventType, count(e) AS count
    ORDER BY count DESC
    LIMIT 10
    RETURN collect({type: eventType, count: count}) AS topEventTypes
}

// Part 5: Network Growth
CALL {
    MATCH (b:block)<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)
    WITH b.height AS height, count(p) AS protostones
    ORDER BY height
    WITH collect({height: height, protostones: protostones}) AS growthByBlock
    
    WITH growthByBlock, floor(size(growthByBlock)/5) AS bucketSize
    UNWIND range(0, 4) AS bucket
    WITH bucket, growthByBlock, bucketSize
    
    WITH bucket,
         bucket * bucketSize AS startIndex,
         (bucket + 1) * bucketSize - 1 AS endIndex,
         growthByBlock
    
    WITH bucket,
         growthByBlock[startIndex].height AS startHeight,
         growthByBlock[min(endIndex, size(growthByBlock)-1)].height AS endHeight,
         [i IN range(startIndex, min(endIndex, size(growthByBlock)-1)) | growthByBlock[i].protostones] AS protosonesInBucket
    
    RETURN collect({
        heightRange: startHeight + '-' + endHeight,
        totalProtostones: reduce(total = 0, p IN protosonesInBucket | total + p)
    }) AS growthDistribution
}

// Return the combined results
RETURN
    blockCount,
    txCount, 
    outputCount,
    addressCount,
    protostoneCount,
    eventCount,
    toFloat(protostoneCount) / txCount * 100 AS percentTxWithProtostones,
    toFloat(eventCount) / protostoneCount AS avgEventsPerProtostone,
    topBlocks,
    topEventTypes,
    growthDistribution;
