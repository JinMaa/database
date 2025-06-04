#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dotenv_1 = __importDefault(require("dotenv"));
const config_1 = require("./api/config");
const neo4j_repository_1 = require("./db/neo4j-repository");
const neo4j_service_1 = require("./db/neo4j-service");
// Load environment variables from .env file
dotenv_1.default.config();
const program = new commander_1.Command();
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
        const { syncToNeo4j } = await Promise.resolve().then(() => __importStar(require('./scripts/neo4j-sync')));
        // Parse options
        const startHeight = parseInt(options.start, 10);
        const endHeight = parseInt(options.end, 10);
        const batchSize = parseInt(options.batch, 10);
        const network = options.network.toUpperCase() === 'MAINNET' ? config_1.Network.MAINNET : config_1.Network.OYLNET;
        const skipExisting = options.skipExisting;
        console.log(`Syncing blocks ${startHeight}-${endHeight} with ${network} network`);
        console.log(`Using batch size: ${batchSize}`);
        await syncToNeo4j(startHeight, endHeight, batchSize, skipExisting, network);
        console.log('✅ Sync completed');
    }
    catch (error) {
        console.error('❌ Sync failed:', error);
    }
    finally {
        // Close Neo4j connection
        await neo4j_service_1.Neo4jService.getInstance().close();
    }
});
// Stats command
program
    .command('stats')
    .description('Display Neo4j graph database statistics')
    .action(async () => {
    try {
        const repo = new neo4j_repository_1.Neo4jRepository();
        const stats = await repo.getGraphStats();
        console.log('\n📊 Graph model statistics:');
        console.log(`- Blocks: ${stats.blockCount}`);
        console.log(`- Transactions: ${stats.txCount}`);
        console.log(`- Outputs: ${stats.outputCount}`);
        console.log(`- Protostones: ${stats.protostoneCount}`);
        console.log(`- Addresses: ${stats.addressCount}`);
        console.log(`- Events: ${stats.eventCount}`);
    }
    catch (error) {
        console.error('❌ Stats failed:', error);
    }
    finally {
        await neo4j_service_1.Neo4jService.getInstance().close();
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
        const repo = new neo4j_repository_1.Neo4jRepository();
        await repo.clearAllData();
        console.log('✅ All data cleared from Neo4j');
        await repo.setupDatabase();
        console.log('✅ Neo4j database schema initialized');
    }
    catch (error) {
        console.error('❌ Failed to clear data:', error);
    }
    finally {
        await neo4j_service_1.Neo4jService.getInstance().close();
    }
});
// Parse command line arguments
if (process.argv.length <= 2) {
    program.help();
}
else {
    program.parse(process.argv);
}
