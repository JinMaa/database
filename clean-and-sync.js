#!/usr/bin/env node

/**
 * Clean and Sync Script
 * 
 * This script clears the Neo4j database and starts a fresh sync from block 0
 */

const { Neo4jRepository } = require('./dist/db/neo4j-repository');
const { Neo4jService } = require('./dist/db/neo4j-service');
const { syncToNeo4j } = require('./dist/scripts/neo4j-sync');
const { Network } = require('./dist/api/config');
require('dotenv').config();

// Configuration
const START_BLOCK = 880000;
const END_BLOCK = 896300; // Sync to block 896300
const BATCH_SIZE = 20;
const NETWORK = 'mainnet'; // Use mainnet data

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

async function cleanAndSync() {
  try {
    console.log('Initializing Neo4j connection...');
    const neo4jService = Neo4jService.getInstance();
    await neo4jService.verifyConnection();
    console.log('✅ Neo4j connection verified');

    // Create repository
    const repository = new Neo4jRepository();
    
    // Clear all data
    console.log('Clearing all data from Neo4j database...');
    await repository.clearAllData();
    console.log('✅ Database cleared successfully');
    
    // Setup database schema
    console.log('Setting up database schema...');
    await repository.setupDatabase();
    console.log('✅ Database schema initialized');
    
    // Start sync process
    console.log(`Starting sync from block ${START_BLOCK} to ${END_BLOCK} with batch size ${BATCH_SIZE}...`);
    await syncToNeo4j(
      START_BLOCK,
      END_BLOCK,
      BATCH_SIZE,
      true, // Skip existing blocks
      getNetworkEnum(NETWORK)
    );
    
    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.error('Error during clean and sync:', error);
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
cleanAndSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
