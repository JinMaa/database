// Query: Alkane Lifecycle Analysis
// Analyzes the lifespan of alkanes from creation to last activity
// Measures creation complexity and subsequent usage patterns

// Find all alkanes and their creation events
MATCH (a:alkane)
OPTIONAL MATCH (creator:alkane)-[:caller]->(create_event:event {event_type: "create"})-[:creates]->(a)
OPTIONAL MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(create_event)
OPTIONAL MATCH (tx)-[:inc]->(create_block:block)

// Now find all events that interact with this alkane
OPTIONAL MATCH (a)<-[:myself]-(e:event)
OPTIONAL MATCH (tx2:tx)-[:shadow_out]->(p2:protostone)-[:trace]->(e)
OPTIONAL MATCH (tx2)-[:inc]->(event_block:block)

// Aggregate events and timestamps by alkane
WITH 
    a.id AS alkane_id,
    creator.id AS creator_id,
    create_block.height AS creation_block,
    create_block.time AS creation_time,
    count(e) AS total_events,
    collect(e.event_type) AS event_types,
    collect(DISTINCT event_block.height) AS interaction_blocks,
    min(event_block.height) AS first_interaction_block,
    max(event_block.height) AS last_interaction_block,
    collect(e.fuel) AS fuel_consumptions
WHERE creation_block IS NOT NULL

// Calculate lifecycle metrics
WITH 
    alkane_id,
    creator_id,
    creation_block,
    creation_time,
    total_events,
    size(apoc.coll.toSet(event_types)) AS unique_event_types,
    CASE WHEN size(interaction_blocks) > 0 
         THEN last_interaction_block - creation_block 
         ELSE 0 
    END AS block_lifespan,
    total_events AS interaction_count,
    size(apoc.coll.toSet(interaction_blocks)) AS active_blocks,
    [fuel IN fuel_consumptions WHERE fuel IS NOT NULL] AS valid_fuel_values

// Calculate average fuel where applicable
WITH 
    alkane_id,
    creator_id,
    creation_block,
    creation_time,
    toString(datetime({epochSeconds: toInteger(creation_time)})) AS creation_datetime,
    total_events,
    unique_event_types,
    block_lifespan,
    interaction_count,
    active_blocks,
    CASE 
        WHEN size(valid_fuel_values) > 0 
        THEN reduce(s = 0, f IN valid_fuel_values | s + toInteger(f)) / size(valid_fuel_values)
        ELSE 0
    END AS avg_fuel_consumption
WHERE block_lifespan >= 0

// Return the lifecycle metrics
RETURN 
    alkane_id,
    creator_id,
    creation_block,
    creation_datetime,
    block_lifespan,
    interaction_count,
    active_blocks,
    CASE 
        WHEN block_lifespan > 0 
        THEN round(1.0 * interaction_count / block_lifespan, 4) 
        ELSE NULL 
    END AS interactions_per_block_lifespan,
    CASE 
        WHEN block_lifespan > 0 
        THEN round(100.0 * active_blocks / block_lifespan, 2)
        ELSE NULL 
    END AS activity_density_percentage,
    unique_event_types,
    avg_fuel_consumption
ORDER BY block_lifespan DESC
LIMIT 50
