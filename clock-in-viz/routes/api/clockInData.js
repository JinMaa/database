const express = require('express');
const router = express.Router();
const { driver } = require('../../config/db');
const fs = require('fs');
const path = require('path');

// Get the clock-in data with the original working query
router.get('/clock-in-data', async (req, res) => {
  const session = driver.session();
  
  try {
    // Read the Cypher query from file
    const queryPath = path.join(__dirname, '../../../cypherQueries/00) clock_in_ordered.cypher');
    const query = fs.readFileSync(queryPath, 'utf8');
    
    // Execute query
    const result = await session.run(query);
    
    // Process results - no need to filter null values as the query does this
    const rawRecords = result.records.map(record => {
      return {
        txid: record.get('txid'),
        blockHeight: parseInt(record.get('block_height')),
        address: record.get('address'),
        clockInCount: parseInt(record.get('clock_in_count'))
      };
    });
    
    // Calculate global max clock-in count
    const globalMaxClockIn = Math.max(...rawRecords.map(r => r.clockInCount));
    
    // Group by block height and calculate max per block
    const blockData = {};
    rawRecords.forEach(record => {
      if (!blockData[record.blockHeight]) {
        blockData[record.blockHeight] = {
          height: record.blockHeight,
          transactions: [],
          clockInCounts: []
        };
      }
      blockData[record.blockHeight].transactions.push({
        txid: record.txid,
        address: record.address,
        clockInCount: record.clockInCount
      });
      blockData[record.blockHeight].clockInCounts.push(record.clockInCount);
    });
    
    // Calculate max per block and prepare final records
    const records = [];
    Object.values(blockData).forEach(block => {
      const blockMaxClockIn = Math.max(...block.clockInCounts);
      block.maxClockIn = blockMaxClockIn;
      delete block.clockInCounts; // Clean up the temporary array
      
      // Add blockMaxClockIn and globalMaxClockIn to each record
      block.transactions.forEach(tx => {
        records.push({
          txid: tx.txid,
          blockHeight: block.height,
          address: tx.address,
          clockInCount: tx.clockInCount,
          blockMaxClockIn: blockMaxClockIn,
          globalMaxClockIn: globalMaxClockIn
        });
      });
    });
    
    // Convert to array for easier frontend processing
    const blockArray = Object.values(blockData).sort((a, b) => a.height - b.height);
    
    res.json({
      success: true,
      data: {
        records: records.sort((a, b) => a.clockInCount - b.clockInCount),
        blockData: blockArray,
        globalMaxClockIn: globalMaxClockIn
      }
    });
  } catch (error) {
    console.error('Error fetching clock-in data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await session.close();
  }
});

module.exports = router;
