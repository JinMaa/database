#!/usr/bin/env node

/**
 * Sync Interval Blocks Script
 * 
 * This script syncs blocks at 144-block intervals starting from block 897413
 * and continuing until reaching the current blockchain height.
 */

const { execSync } = require('child_process');
const { Neo4jRepository } = require('./dist/db/neo4j-repository');
const { Neo4jService } = require('./dist/db/neo4j-service');
const { BlockApi } = require('./dist/api/blockApi');
const { Network } = require('./dist/api/config');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
let specifiedCurrentHeight = null;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  // Check for --current-height argument
  if (args[i] === '--current-height' && i + 1 < args.length) {
    specifiedCurrentHeight = parseInt(args[i + 1], 10);
    if (isNaN(specifiedCurrentHeight)) {
      console.error('Invalid current height number');
      process.exit(1);
    }
    console.log(`Using specified current height: ${specifiedCurrentHeight}`);
  }
}

// Configuration
const STARTING_BLOCK = 897413;  // The first block to sync
const BLOCK_INTERVAL = 144;     // Interval between blocks to sync
const NETWORK = 'mainnet';      // Use mainnet data

// Helper function to add delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Map string network name to enum
const getNetworkEnum = (networkName) => {
  const networkMap = {
    'mainnet': Network.MAINNET,
    'testnet': Network.TESTNET,
    'regtest': Network.REGTEST,
    'oylnet': Network.OYLNET
  };
  return networkMap[networkName.toLowerCase()] || Network.MAINNET;
};

// Function to sync a single block
async function syncSingleBlock(blockHeight) {
  console.log(`\n----- Syncing block ${blockHeight} -----`);
  try {
    const command = `npm run sync -- --network mainnet --batch 1 --skip-existing --start ${blockHeight} --end ${blockHeight}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, { stdio: 'inherit' });
    
    console.log(`✅ Block ${blockHeight} synced successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error syncing block ${blockHeight}:`);
    console.error(error.message || error);
    return false;
  }
}

// Main function to sync blocks at intervals
async function syncIntervalBlocks() {
  try {
    console.log('Initializing Neo4j connection...');
    const neo4jService = Neo4jService.getInstance();
    await neo4jService.verifyConnection();
    console.log('✅ Neo4j connection verified');

    // Initialize BlockApi to get current height
    const networkEnum = getNetworkEnum(NETWORK);
    const blockApi = new BlockApi(networkEnum);
    
    // Get current blockchain height
    let currentHeight;
    
    if (specifiedCurrentHeight !== null) {
      // Use the height specified in the command line
      currentHeight = specifiedCurrentHeight;
    } else {
      console.log('Fetching current blockchain height...');
      try {
        currentHeight = await blockApi.getBlockCount();
        console.log(`Current blockchain height: ${currentHeight}`);
      } catch (error) {
        console.error('Error fetching current height:', error.message);
        console.error('Please specify the current height using --current-height parameter');
        process.exit(1);
      }
    }
    
    // Calculate blocks to sync
    const blocksToSync = [];
    let blockHeight = STARTING_BLOCK;
    
    while (blockHeight <= currentHeight) {
      blocksToSync.push(blockHeight);
      blockHeight += BLOCK_INTERVAL;
    }
    
    console.log(`Will sync ${blocksToSync.length} blocks at ${BLOCK_INTERVAL}-block intervals`);
    console.log(`Blocks to sync: ${blocksToSync.join(', ')}`);
    
    // Sync each block one by one
    let successCount = 0;
    let failureCount = 0;
    
    for (const block of blocksToSync) {
      const success = await syncSingleBlock(block);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Add a delay between blocks to avoid rate limiting
      if (block !== blocksToSync[blocksToSync.length - 1]) {
        console.log('Waiting 3 seconds before next block...');
        await sleep(3000);
      }
    }
    
    console.log('\n===== Sync Summary =====');
    console.log(`Total blocks attempted: ${blocksToSync.length}`);
    console.log(`Successfully synced: ${successCount}`);
    console.log(`Failed to sync: ${failureCount}`);
    
    if (failureCount === 0) {
      console.log('✅ All blocks synced successfully');
    } else {
      console.log('⚠️ Some blocks failed to sync. Check the logs for details.');
    }
    
  } catch (error) {
    console.error('Error during sync process:', error);
    process.exit(1);
  } finally {
    // Close Neo4j connection
    try {
      await Neo4jService.getInstance().close();
      console.log('Neo4j connection closed');
    } catch (err) {
      console.error('Error closing Neo4j connection:', err);
    }
  }
}

// Run the script
syncIntervalBlocks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
