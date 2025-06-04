#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { Network } from './api/config';
import { Neo4jRepository } from './db/neo4j-repository';
import { Neo4jService } from './db/neo4j-service';

// Load environment variables from .env file
dotenv.config();

const program = new Command();

// Create base program
program
  .name('protostone-processor')
  .description('Command-line interface for processing and syncing protostone data to Neo4j')
  .version('0.1.0');

// Sync command
program
  .command('sync')
  .description('Sync blockchain data to Neo4j')
  .option('-n, --network <network>', 'Network to use (mainnet or oylnet)', 'oylnet')
  .option('-s, --start <height>', 'Start block height', '0')
  .option('-e, --end <height>', 'End block height', '1000')
  .option('-b, --batch <size>', 'Batch size for processing', '10')
  .option('--skip-existing', 'Skip blocks that are already in the database', true)
  .action(async (options) => {
    try {
      // Call the sync-neo4j script
      const { syncToNeo4j } = await import('./scripts/neo4j-sync');
      
      // Parse options
      const startHeight = parseInt(options.start, 10);
      const endHeight = parseInt(options.end, 10);
      const batchSize = parseInt(options.batch, 10);
      const network = options.network.toUpperCase() === 'MAINNET' ? Network.MAINNET : Network.OYLNET;
      const skipExisting = options.skipExisting;
      
      console.log(`Syncing blocks ${startHeight}-${endHeight} with ${network} network`);
      console.log(`Using batch size: ${batchSize}`);
      
      await syncToNeo4j(startHeight, endHeight, batchSize, skipExisting, network);
      
      console.log('✅ Sync completed');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      // Close Neo4j connection
      await Neo4jService.getInstance().close();
    }
  });

// Stats command
program
  .command('stats')
  .description('Display Neo4j graph database statistics')
  .action(async () => {
    try {
      const repo = new Neo4jRepository();
      const stats = await repo.getGraphStats();
      
      console.log('\n📊 Graph model statistics:');
      console.log(`- Blocks: ${stats.blockCount}`);
      console.log(`- Transactions: ${stats.txCount}`);
      console.log(`- Outputs: ${stats.outputCount}`);
      console.log(`- Protostones: ${stats.protostoneCount}`);
      console.log(`- Addresses: ${stats.addressCount}`);
      console.log(`- Events: ${stats.eventCount}`);
    } catch (error) {
      console.error('❌ Stats failed:', error);
    } finally {
      await Neo4jService.getInstance().close();
    }
  });

// Clear command
program
  .command('clear')
  .description('Clear all data from Neo4j')
  .option('--confirm', 'Confirm deletion without prompt', false)
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.log('❌ Use --confirm flag to confirm deletion');
        process.exit(1);
      }
      
      console.log('🗑️ Clearing all data from Neo4j...');
      
      const repo = new Neo4jRepository();
      await repo.clearAllData();
      console.log('✅ All data cleared from Neo4j');
      
      await repo.setupDatabase();
      console.log('✅ Neo4j database schema initialized');
      
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
    } finally {
      await Neo4jService.getInstance().close();
    }
  });

// Parse command line arguments
if (process.argv.length <= 2) {
  program.help();
} else {
  program.parse(process.argv);
}
