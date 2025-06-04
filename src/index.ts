#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import dotenv from 'dotenv';
import { ProtostoneProcessor } from './utils/processor';
import { Network } from './api/config';
import { Logger, LogLevel } from './utils/logger';
import { neo4jService } from './db/neo4j-service';

// Load environment variables
dotenv.config();

// Setup CLI
const program = new Command();

program
  .name('protostone-processor')
  .description('Process and store Bitcoin protostones and traces from the blockchain')
  .version('0.1.0');

program
  .command('process')
  .description('Process blocks and extract protostone data with optional trace data')
  .requiredOption('-s, --start <height>', 'Starting block height', parseInt)
  .option('-e, --end <height>', 'Ending block height (optional)', parseInt)
  .option('-n, --network <network>', 'Network to use (mainnet or oylnet)', 'mainnet')
  .option('-o, --output <directory>', 'Output directory for processed blocks', './output')
  .option('-b, --batch-size <size>', 'Number of blocks to process in each batch', '10')
  .option('-c, --continue', 'Continue from the last processed block height')
  .option('--no-traces', 'Skip processing trace data')
  .option('--neo4j', 'Store processed data in Neo4j database')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      // Set log level
      if (options.verbose) {
        Logger.setLogLevel(LogLevel.DEBUG);
      }

      // Validate network
      let network: Network;
      if (options.network === 'mainnet') {
        network = Network.MAINNET;
      } else if (options.network === 'oylnet') {
        network = Network.OYLNET;
      } else {
        Logger.error(`Invalid network: ${options.network}. Must be 'mainnet' or 'oylnet'`);
        process.exit(1);
      }
      
      // Determine whether to process traces
      const processTraces = options.traces !== false;
      
      // Check Neo4j connection if --neo4j is specified
      const useNeo4j = !!options.neo4j;
      if (useNeo4j) {
        try {
          Logger.info('Verifying Neo4j connection...');
          const connected = await neo4jService.verifyConnection();
          if (!connected) {
            Logger.error('Failed to connect to Neo4j database. Check your .env configuration.');
            process.exit(1);
          }
          Logger.info('Neo4j connection verified successfully.');
        } catch (error: any) {
          Logger.error(`Neo4j connection error: ${error.message}`);
          Logger.error('Make sure Neo4j is running and check your .env configuration.');
          process.exit(1);
        }
      }

      // Create output directory path
      const outputDir = path.resolve(options.output);

      // Log configuration
      Logger.info(`Starting protostone processor with configuration:`);
      Logger.info(`- Network: ${network}`);
      Logger.info(`- Start block: ${options.start}`);
      Logger.info(`- End block: ${options.end || 'latest'}`);
      Logger.info(`- Output directory: ${outputDir}`);
      Logger.info(`- Batch size: ${options.batchSize}`);
      Logger.info(`- Continue from last: ${options.continue ? 'yes' : 'no'}`);
      Logger.info(`- Process traces: ${processTraces ? 'yes' : 'no'}`);
      Logger.info(`- Store in Neo4j: ${useNeo4j ? 'yes' : 'no'}`);

      // Create processor
      const processor = new ProtostoneProcessor({
        startBlockHeight: options.start,
        endBlockHeight: options.end,
        network,
        outputDir,
        batchSize: parseInt(options.batchSize, 10),
        continueFromLastProcessed: !!options.continue,
        processTraces,
        storeInNeo4j: useNeo4j
      });

      // Process blocks
      const processed = await processor.processBlocks();
      
      Logger.info(`Processing complete. Processed ${processed} blocks.`);
      
      // Close Neo4j connection if it was used
      if (useNeo4j) {
        await neo4jService.close();
      }
    } catch (error: any) {
      Logger.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
