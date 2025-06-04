// Query: Value Concentration
// Analyzes distribution of value transfers among different alkanes
// Helps identify "whale" addresses controlling large portions of tokens

// Find all value transfers between alkanes
MATCH (source:alkane)-[:caller]->(e:event {event_type: "transfer"})-[:transfer]->(target:alkane)
WHERE e.value IS NOT NULL

// Calculate total incoming and outgoing values per alkane
WITH target.id AS alkane_id, 
     sum(toInteger(e.value)) AS total_incoming_value
     
OPTIONAL MATCH (a:alkane {id: alkane_id})-[:caller]->(e2:event {event_type: "transfer"})-[:transfer]->(:alkane)
WHERE e2.value IS NOT NULL

WITH 
    alkane_id,
    total_incoming_value,
    sum(CASE WHEN e2.value IS NOT NULL THEN toInteger(e2.value) ELSE 0 END) AS total_outgoing_value

// Calculate net value (incoming - outgoing)
WITH 
    alkane_id,
    total_incoming_value,
    total_outgoing_value,
    total_incoming_value - total_outgoing_value AS net_value

// Get total value in the system for percentage calculations
WITH 
    alkane_id,
    total_incoming_value,
    total_outgoing_value,
    net_value,
    sum(total_incoming_value) OVER () AS system_total_incoming

// Calculate percentage metrics
RETURN 
    alkane_id,
    total_incoming_value,
    total_outgoing_value,
    net_value,
    round(100.0 * total_incoming_value / system_total_incoming, 4) AS percentage_of_total_value,
    CASE 
        WHEN total_incoming_value > 0 AND total_outgoing_value > 0
        THEN round(100.0 * total_outgoing_value / total_incoming_value, 2)
        ELSE 0
    END AS outgoing_percentage_of_incoming
ORDER BY total_incoming_value DESC
LIMIT 50
