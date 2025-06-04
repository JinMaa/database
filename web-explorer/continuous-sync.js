#!/usr/bin/env node

// To run this script: node continuous-sync.js

/**
 * Continuous Sync Service
 * 
 * This script periodically checks the Metashrew API for new blocks and
 * triggers the sync process to keep the Neo4j graph database up-to-date.
 * It polls the metashrew_height method every minute and syncs any new blocks.
 */

const MetashrewApi = require('./api');
const { syncToNeo4j } = require('../dist/scripts/neo4j-sync');
const { Neo4jRepository } = require('../dist/db/neo4j-repository');
const { Neo4jService } = require('../dist/db/neo4j-service');
const { Network } = require('../dist/api/config');
require('dotenv').config();

// Configuration
const CHECK_INTERVAL_MS = 60000; // 1 minute
const BATCH_SIZE = 10; // Number of blocks to sync at once
const NETWORK = process.env.NETWORK || 'oylnet';

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

class ContinuousSyncService {
  constructor() {
    // Initialize API client
    this.api = new MetashrewApi(process.env.METASHREW_API_URL);
    this.repository = new Neo4jRepository();
    this.networkEnum = getNetworkEnum(NETWORK);
    this.lastSyncedHeight = -1;
    this.isRunning = false;
    this.isSyncing = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      // Verify Neo4j connection
      const neo4jService = Neo4jService.getInstance();
      await neo4jService.verifyConnection();
      console.log('✅ Neo4j connection verified');
      
      // Setup database schema if needed
      await this.repository.setupDatabase();
      console.log('✅ Database schema initialized');
      
      // Get the last synced block height from the database
      const stats = await this.repository.getGraphStats();
      if (stats && stats.blockCount > 0) {
        // Get the highest block in the database using a custom query
        const neo4jService = Neo4jService.getInstance();
        const session = neo4jService.getSession();
        try {
          const result = await session.run('MATCH (b:block) RETURN max(b.height) as maxHeight');
          const maxHeight = result.records[0].get('maxHeight');
          this.lastSyncedHeight = maxHeight ? maxHeight.toNumber() : -1;
          console.log(`Last synced block height: ${this.lastSyncedHeight}`);
        } catch (error) {
          console.error('Error getting highest block height:', error);
          this.lastSyncedHeight = -1;
        } finally {
          await session.close();
        }
      } else {
        console.log('No blocks found in database, starting from scratch');
        this.lastSyncedHeight = -1;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize continuous sync service:', error);
      return false;
    }
  }

  /**
   * Check for new blocks and trigger sync if needed
   */
  async checkAndSync() {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping this check');
      return;
    }

    try {
      this.isSyncing = true;
      
      // Get current blockchain height from Metashrew API
      const currentHeight = await this.api.getHeight();
      console.log(`Current blockchain height: ${currentHeight}`);
      
      // Calculate blocks to sync
      if (currentHeight > this.lastSyncedHeight) {
        const startHeight = this.lastSyncedHeight + 1;
        console.log(`New blocks detected! Syncing from ${startHeight} to ${currentHeight}`);
        
        // Sync blocks in batches
        await syncToNeo4j(
          startHeight,
          currentHeight,
          BATCH_SIZE,
          true, // Skip existing blocks
          this.networkEnum
        );
        
        // Update last synced height
        this.lastSyncedHeight = currentHeight;
        console.log(`Sync completed. Last synced height updated to ${this.lastSyncedHeight}`);
      } else {
        console.log(`No new blocks to sync. Database is up-to-date at height ${this.lastSyncedHeight}`);
      }
    } catch (error) {
      console.error('Error during sync check:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start the continuous sync service
   */
  async start() {
    if (this.isRunning) {
      console.log('Service is already running');
      return;
    }

    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Failed to initialize service, exiting');
      process.exit(1);
    }

    console.log(`Starting continuous sync service with ${CHECK_INTERVAL_MS/1000} second interval`);
    this.isRunning = true;
    
    // Perform initial sync check
    await this.checkAndSync();
    
    // Set up interval for periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndSync().catch(error => {
        console.error('Error in periodic sync check:', error);
      });
    }, CHECK_INTERVAL_MS);
    
    console.log('Continuous sync service started');
  }

  /**
   * Stop the continuous sync service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('Stopping continuous sync service');
    clearInterval(this.intervalId);
    this.isRunning = false;
    
    // Close Neo4j connection
    await Neo4jService.getInstance().close();
    console.log('Neo4j connection closed');
    console.log('Continuous sync service stopped');
  }
}

// Run the script if executed directly
if (require.main === module) {
  const service = new ContinuousSyncService();
  
  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await service.stop();
    process.exit(0);
  };
  
  // Register shutdown handlers
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Start the service
  service.start().catch(error => {
    console.error('Failed to start continuous sync service:', error);
    process.exit(1);
  });
}

module.exports = ContinuousSyncService;
