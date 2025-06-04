#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const processor_1 = require("./utils/processor");
const config_1 = require("./api/config");
const logger_1 = require("./utils/logger");
const neo4j_service_1 = require("./db/neo4j-service");
// Load environment variables
dotenv_1.default.config();
// Setup CLI
const program = new commander_1.Command();
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
            logger_1.Logger.setLogLevel(logger_1.LogLevel.DEBUG);
        }
        // Validate network
        let network;
        if (options.network === 'mainnet') {
            network = config_1.Network.MAINNET;
        }
        else if (options.network === 'oylnet') {
            network = config_1.Network.OYLNET;
        }
        else {
            logger_1.Logger.error(`Invalid network: ${options.network}. Must be 'mainnet' or 'oylnet'`);
            process.exit(1);
        }
        // Determine whether to process traces
        const processTraces = options.traces !== false;
        // Check Neo4j connection if --neo4j is specified
        const useNeo4j = !!options.neo4j;
        if (useNeo4j) {
            try {
                logger_1.Logger.info('Verifying Neo4j connection...');
                const connected = await neo4j_service_1.neo4jService.verifyConnection();
                if (!connected) {
                    logger_1.Logger.error('Failed to connect to Neo4j database. Check your .env configuration.');
                    process.exit(1);
                }
                logger_1.Logger.info('Neo4j connection verified successfully.');
            }
            catch (error) {
                logger_1.Logger.error(`Neo4j connection error: ${error.message}`);
                logger_1.Logger.error('Make sure Neo4j is running and check your .env configuration.');
                process.exit(1);
            }
        }
        // Create output directory path
        const outputDir = path_1.default.resolve(options.output);
        // Log configuration
        logger_1.Logger.info(`Starting protostone processor with configuration:`);
        logger_1.Logger.info(`- Network: ${network}`);
        logger_1.Logger.info(`- Start block: ${options.start}`);
        logger_1.Logger.info(`- End block: ${options.end || 'latest'}`);
        logger_1.Logger.info(`- Output directory: ${outputDir}`);
        logger_1.Logger.info(`- Batch size: ${options.batchSize}`);
        logger_1.Logger.info(`- Continue from last: ${options.continue ? 'yes' : 'no'}`);
        logger_1.Logger.info(`- Process traces: ${processTraces ? 'yes' : 'no'}`);
        logger_1.Logger.info(`- Store in Neo4j: ${useNeo4j ? 'yes' : 'no'}`);
        // Create processor
        const processor = new processor_1.ProtostoneProcessor({
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
        logger_1.Logger.info(`Processing complete. Processed ${processed} blocks.`);
        // Close Neo4j connection if it was used
        if (useNeo4j) {
            await neo4j_service_1.neo4jService.close();
        }
    }
    catch (error) {
        logger_1.Logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
});
// Parse command line arguments
program.parse();
// If no command is provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
