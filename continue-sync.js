#!/usr/bin/env node

/**
 * Continue Sync Script
 * 
 * This script continues syncing from the highest block in the database
 * without clearing existing data
 */

const { Neo4jRepository } = require('./dist/db/neo4j-repository');
const { Neo4jService } = require('./dist/db/neo4j-service');
const { syncToNeo4j } = require('./dist/scripts/neo4j-sync');
const { Network } = require('./dist/api/config');
require('dotenv').config();

// Configuration
const DEFAULT_START_BLOCK = 880000; // Default starting block if not specified
const END_BLOCK = 896300; // Target end block
const BATCH_SIZE = 10; // Smaller batch size to reduce rate limiting
const NETWORK = 'mainnet'; // Use mainnet data

// Rate limiting configuration
const RATE_LIMIT_HANDLING = {
  enabled: true, // Set to false to disable rate limit handling
  delayBetweenBatchesMs: 2000, // 2 second delay between batches
  maxRetries: 100, // Very high retry count to ensure we never miss anything
  initialRetryDelayMs: 1000, // Start with 1 second delay
  maxRetryDelayMs: 60000 // Cap at 1 minute delay
};

// Parse command line arguments
const args = process.argv.slice(2);
let forcedStartBlock = null;
let disableRateLimitHandling = false;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  // Check for --start argument
  if (args[i] === '--start' && i + 1 < args.length) {
    forcedStartBlock = parseInt(args[i + 1], 10);
    if (isNaN(forcedStartBlock)) {
      console.error('Invalid start block number');
      process.exit(1);
    }
  }
  
  // Check for --no-rate-limit argument
  if (args[i] === '--no-rate-limit') {
    disableRateLimitHandling = true;
    console.log('Rate limit handling disabled');
  }
}

// Apply command line overrides
if (disableRateLimitHandling) {
  RATE_LIMIT_HANDLING.enabled = false;
}

// Make sure we're using the API URL from .env
process.env.MAINNET_API_URL = process.env.MAINNET_API_URL || 'https://mainnet.sandshrew.io/v4/oylcorpbtw';

// Map string network name to enum
const getNetworkEnum = (networkName) => {
  const networkMap = {
    'mainnet': Network.MAINNET,
    'testnet': Network.TESTNET,
    'regtest': Network.REGTEST,
    'oylnet': Network.OYLNET
  };
  return networkMap[networkName.toLowerCase()] || Network.OYLNET;
};

// Helper function to add delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Custom sync function with retries and delays
async function syncWithRetries(startBlock, endBlock, batchSize, skipExisting, network) {
  // Process blocks in smaller batches
  for (let batchStart = startBlock; batchStart <= endBlock; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, endBlock);
    console.log(`\n----- Processing batch: blocks ${batchStart} to ${batchEnd} -----`);
    
    if (!RATE_LIMIT_HANDLING.enabled) {
      // If rate limit handling is disabled, just sync the whole range at once
      await syncToNeo4j(
        batchStart,
        batchEnd,
        batchSize,
        skipExisting,
        network
      );
      continue;
    }
    
    // With rate limit handling enabled, use retries and delays
    let retries = 0;
    let success = false;
    
    while (!success && retries < RATE_LIMIT_HANDLING.maxRetries) {
      try {
        // Sync this batch
        await syncToNeo4j(
          batchStart,
          batchEnd,
          batchSize,
          skipExisting,
          network
        );
        success = true;
      } catch (error) {
        retries++;
        // Calculate delay with exponential backoff, but cap it
        const baseDelay = Math.min(
          RATE_LIMIT_HANDLING.initialRetryDelayMs * Math.pow(2, retries - 1),
          RATE_LIMIT_HANDLING.maxRetryDelayMs
        );
        // Add some randomness to avoid thundering herd
        const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15 multiplier
        const waitTime = Math.floor(baseDelay * jitter);
        
        console.error(`Error syncing batch ${batchStart}-${batchEnd} (attempt ${retries}/${RATE_LIMIT_HANDLING.maxRetries}):`);
        console.error(error.message || error);
        
        if (retries < RATE_LIMIT_HANDLING.maxRetries) {
          console.log(`Retrying in ${waitTime/1000} seconds...`);
          await sleep(waitTime);
        } else {
          console.error(`Failed to sync batch ${batchStart}-${batchEnd} after ${RATE_LIMIT_HANDLING.maxRetries} attempts`);
          throw error; // Rethrow after max retries
        }
      }
    }
    
    // Add delay between batches to avoid rate limiting
    if (RATE_LIMIT_HANDLING.enabled && batchStart + batchSize <= endBlock) {
      console.log(`Waiting ${RATE_LIMIT_HANDLING.delayBetweenBatchesMs/1000} seconds before next batch...`);
      await sleep(RATE_LIMIT_HANDLING.delayBetweenBatchesMs);
    }
  }
}

async function continueSync() {
  try {
    console.log('Initializing Neo4j connection...');
    const neo4jService = Neo4jService.getInstance();
    await neo4jService.verifyConnection();
    console.log('✅ Neo4j connection verified');

    // Create repository
    const repository = new Neo4jRepository();
    
    // Determine the starting block
    let startBlock;
    
    if (forcedStartBlock !== null) {
      // Use the block height specified in the command line
      startBlock = forcedStartBlock;
      console.log(`Using specified start block: ${startBlock}`);
    } else {
      // Get the highest block height from the database
      console.log('Finding the highest block in the database...');
      const session = neo4jService.getSession();
      
      try {
        const result = await session.run('MATCH (b:block) RETURN max(b.height) as maxHeight');
        const maxHeight = result.records[0].get('maxHeight');
        startBlock = maxHeight ? maxHeight.toNumber() + 1 : DEFAULT_START_BLOCK;
        console.log(`Found highest block in database: ${startBlock - 1}`);
      } catch (error) {
        console.error('Error getting highest block height:', error);
        startBlock = DEFAULT_START_BLOCK;
        console.log(`Using default start block: ${startBlock}`);
      } finally {
        await session.close();
      }
    }
    
    console.log(`Will continue syncing from block ${startBlock}`);
    
    if (startBlock >= END_BLOCK) {
      console.log(`Database is already synced to block ${startBlock - 1}, which is beyond the target block ${END_BLOCK}`);
      return;
    }
    
    // Start sync process with rate limit handling
    console.log(`Starting sync from block ${startBlock} to ${END_BLOCK} with batch size ${BATCH_SIZE}...`);
    console.log(`Rate limit handling: ${RATE_LIMIT_HANDLING.enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (RATE_LIMIT_HANDLING.enabled) {
      console.log(`- Max retries: ${RATE_LIMIT_HANDLING.maxRetries}`);
      console.log(`- Delay between batches: ${RATE_LIMIT_HANDLING.delayBetweenBatchesMs/1000} seconds`);
    }
    
    await syncWithRetries(
      startBlock,
      END_BLOCK,
      BATCH_SIZE,
      true, // Skip existing blocks
      getNetworkEnum(NETWORK)
    );
    
    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.error('Error during sync continuation:', error);
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
continueSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
