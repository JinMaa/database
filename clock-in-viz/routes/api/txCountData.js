const express = require('express');
const router = express.Router();
const { driver } = require('../../config/db');
const fs = require('fs');
const path = require('path');

// Get combined clock-in and transaction count data
router.get('/tx-count-data', async (req, res) => {
  const session = driver.session();
  
  try {
    // Read the clock-in Cypher query from file
    const clockInQueryPath = path.join(__dirname, '../../../cypherQueries/00) clock_in_ordered.cypher');
    const clockInQuery = fs.readFileSync(clockInQueryPath, 'utf8');
    
    // Execute clock-in query
    const clockInResult = await session.run(clockInQuery);
    
    // Process clock-in results
    const rawRecords = clockInResult.records.map(record => {
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
    
    // Get unique block heights for tx count query
    const blockHeights = Object.keys(blockData).map(h => parseInt(h));
    
    // Read the tx count Cypher query from file
    const txCountQueryPath = path.join(__dirname, '../../../cypherQueries/tx_count_by_block.cypher');
    const txCountQuery = fs.readFileSync(txCountQueryPath, 'utf8');
    
    // Execute tx count query with block heights parameter
    const txCountResult = await session.run(
      txCountQuery,
      { blockHeights: blockHeights }
    );
    
    // Process tx count results and add to block data
    txCountResult.records.forEach(record => {
      const blockHeight = parseInt(record.get('block_height'));
      const txCount = parseInt(record.get('tx_count'));
      
      if (blockData[blockHeight]) {
        blockData[blockHeight].txCount = txCount;
      }
    });
    
    // Calculate max per block and prepare final records
    const records = [];
    Object.values(blockData).forEach(block => {
      const blockMaxClockIn = Math.max(...block.clockInCounts);
      block.maxClockIn = blockMaxClockIn;
      
      // Calculate clock-in percentage if txCount is available
      if (block.txCount) {
        block.clockInPercentage = (block.transactions.length / block.txCount) * 100;
      } else {
        block.clockInPercentage = 0;
      }
      
      delete block.clockInCounts; // Clean up the temporary array
      
      // Add blockMaxClockIn, globalMaxClockIn, and txCount to each record
      block.transactions.forEach(tx => {
        records.push({
          txid: tx.txid,
          blockHeight: block.height,
          address: tx.address,
          clockInCount: tx.clockInCount,
          blockMaxClockIn: blockMaxClockIn,
          globalMaxClockIn: globalMaxClockIn,
          blockTxCount: block.txCount || 0
        });
      });
    });
    
    // Convert to array for easier frontend processing
    const blockArray = Object.values(blockData).sort((a, b) => a.height - b.height);
    
    // Calculate global max tx count for visualization scaling
    const globalMaxTxCount = Math.max(...blockArray.map(b => b.txCount || 0));
    
    res.json({
      success: true,
      data: {
        records: records.sort((a, b) => a.clockInCount - b.clockInCount),
        blockData: blockArray,
        globalMaxClockIn: globalMaxClockIn,
        globalMaxTxCount: globalMaxTxCount
      }
    });
  } catch (error) {
    console.error('Error fetching combined data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await session.close();
  }
});

module.exports = router;
