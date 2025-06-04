const express = require('express');
const router = express.Router();
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

// Create a Neo4j driver instance
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

router.get('/', async (req, res) => {
  const session = driver.session();
  
  try {
    // Read the Cypher query from file
    const queryPath = path.join(process.cwd(), '..', 'cypherQueries', '0000) clock_in_ordered_market.cypher');
    const query = fs.readFileSync(queryPath, 'utf8');
    
    // Execute the query
    const result = await session.run(query);
    
    console.log(`Query returned ${result.records.length} records`);
    if (result.records.length > 0) {
      console.log('First record keys:', result.records[0].keys);
      console.log('First record sample:', JSON.stringify(result.records[0].toObject()));
    } else {
      console.log('No records returned from query');
    }
    
    // Process the results
    const blockData = result.records.map(record => {
      // Safely convert values to numbers
      const blockHeight = parseInt(record.get('block_height').toString());
      const oylCount = parseInt(record.get('oyl_count').toString());
      const ordiscanCount = parseInt(record.get('ordiscan_count').toString());
      const otherClockInCount = parseInt(record.get('other_clock_in_count').toString());
      const totalClockInCount = parseInt(record.get('total_clock_in_count').toString());
      const totalTxCount = parseInt(record.get('total_tx_count').toString());
      
      // Calculate percentages for clock-ins
      const oylPercentage = totalClockInCount > 0 ? (oylCount / totalClockInCount) * 100 : 0;
      const ordiscanPercentage = totalClockInCount > 0 ? (ordiscanCount / totalClockInCount) * 100 : 0;
      const otherClockInPercentage = totalClockInCount > 0 ? (otherClockInCount / totalClockInCount) * 100 : 0;
      
      // Calculate non-clock-in count and percentage
      const nonClockInCount = totalTxCount - totalClockInCount;
      const clockInPercentage = totalTxCount > 0 ? (totalClockInCount / totalTxCount) * 100 : 0;
      const nonClockInPercentage = totalTxCount > 0 ? (nonClockInCount / totalTxCount) * 100 : 0;
      
      return {
        blockHeight,
        oylCount,
        ordiscanCount,
        otherClockInCount,
        totalClockInCount,
        totalTxCount,
        nonClockInCount,
        oylPercentage,
        ordiscanPercentage,
        otherClockInPercentage,
        clockInPercentage,
        nonClockInPercentage
      };
    });
    
    // Find the maximum count across all blocks
    const maxCount = Math.max(...blockData.map(block => block.totalTxCount));
    
    res.json({
      success: true,
      data: {
        blockData,
        globalMaxCount: maxCount
      }
    });
  } catch (error) {
    console.error('Error fetching market share data:', error);
    res.json({
      success: false,
      error: error.message
    });
  } finally {
    await session.close();
  }
});

module.exports = router;
