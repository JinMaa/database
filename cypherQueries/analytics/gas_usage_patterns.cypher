// Query: Gas Usage Patterns
// Analyzes correlation between event types and fuel consumption
// Shows trends in fuel efficiency over time as contracts evolve

// Find all events with fuel consumption data
MATCH (e:event)
WHERE e.fuel IS NOT NULL
MATCH (tx:tx)-[:shadow_out]->(p:protostone)-[:trace]->(e)
MATCH (tx)-[:inc]->(b:block)

// Group events by type and calculate fuel metrics
WITH 
    e.event_type AS event_type,
    toInteger(e.fuel) AS fuel_amount,
    b.height AS block_height,
    b.time AS block_time
WHERE fuel_amount > 0

// Group by block time windows (daily)
WITH 
    event_type,
    toInteger(block_time) / 86400 AS day_timestamp,
    sum(fuel_amount) AS total_fuel,
    count(*) AS event_count,
    min(block_height) AS min_block_in_period,
    max(block_height) AS max_block_in_period
    
// Calculate average fuel per event
WITH 
    event_type,
    toString(datetime({epochSeconds: day_timestamp * 86400})) AS day,
    day_timestamp,
    total_fuel,
    event_count,
    round(1.0 * total_fuel / event_count, 2) AS avg_fuel_per_event,
    min_block_in_period,
    max_block_in_period
    
// Return time series data
RETURN 
    day,
    event_type,
    event_count,
    total_fuel,
    avg_fuel_per_event,
    min_block_in_period,
    max_block_in_period
ORDER BY day_timestamp DESC, total_fuel DESC
LIMIT 100

// UNION

// Global stats by event type (all time)
MATCH (e:event)
WHERE e.fuel IS NOT NULL
WITH 
    e.event_type AS event_type,
    toInteger(e.fuel) AS fuel_amount
WHERE fuel_amount > 0

WITH 
    event_type,
    count(*) AS event_count,
    sum(fuel_amount) AS total_fuel,
    avg(fuel_amount) AS avg_fuel,
    percentileDisc(fuel_amount, 0.5) AS median_fuel,
    min(fuel_amount) AS min_fuel,
    max(fuel_amount) AS max_fuel,
    stDev(fuel_amount) AS fuel_std_dev
    
RETURN 
    "ALL TIME" AS day,
    event_type,
    event_count,
    total_fuel,
    round(avg_fuel, 2) AS avg_fuel_per_event,
    null AS min_block_in_period,
    null AS max_block_in_period
ORDER BY total_fuel DESC
