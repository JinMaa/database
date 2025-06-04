// Raw Protostone Data Query
// Finds protostones with raw data and returns basic information about them
// Useful for verifying that raw protostone data is being correctly stored

// Find all protostones with raw data
MATCH (p:protostone)
WHERE p.raw_data IS NOT NULL
RETURN 
    p.txid AS txid,
    p.vout AS vout,
    p.protocol_tag AS protocolTag,
    p.raw_data AS rawData,
    size(p.raw_data) AS dataSizeBytes
ORDER BY dataSizeBytes DESC
LIMIT 10;

// Count protostones by protocol tag
MATCH (p:protostone)
WHERE p.raw_data IS NOT NULL
WITH p.protocol_tag AS protocolTag, count(*) AS count
RETURN 
    protocolTag,
    count
ORDER BY count DESC;

// Find protostones with the largest raw data size
MATCH (p:protostone)
WHERE p.raw_data IS NOT NULL
WITH p, size(p.raw_data) AS dataSize
ORDER BY dataSize DESC
LIMIT 5
MATCH (tx:tx {txid: p.txid})
MATCH (tx)-[:inc]->(block:block)
RETURN 
    p.txid AS txid,
    p.vout AS vout,
    p.protocol_tag AS protocolTag,
    dataSize AS rawDataSizeBytes,
    block.height AS blockHeight
ORDER BY dataSize DESC;

// Advanced: Find specific field values in raw data 
// (requires APOC procedures to parse JSON)
// Note: This query must be customized based on the actual data structure
// This is just an example structure
MATCH (p:protostone)
WHERE p.raw_data IS NOT NULL
CALL apoc.convert.fromJsonMap(p.raw_data) YIELD value
RETURN 
    p.txid AS txid,
    p.vout AS vout,
    p.protocol_tag AS protocolTag,
    value.fieldName AS fieldValue
LIMIT 10;
