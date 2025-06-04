"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const neo4j_service_1 = require("../db/neo4j-service");
const blockApi_1 = require("../api/blockApi");
const protostone_1 = require("../parsers/protostone");
const neo4j_storage_1 = require("../storage/neo4j-storage");
const config_1 = require("../api/config");
// Load environment variables
dotenv_1.default.config();
async function syncSingleBlock(height) {
    console.log(`Starting sync for block at height ${height}`);
    // Initialize services
    const api = new blockApi_1.BlockApi(config_1.Network.OYLNET);
    const storage = new neo4j_storage_1.Neo4jStorage();
    try {
        // Verify Neo4j connection
        const neo4jService = neo4j_service_1.Neo4jService.getInstance();
        await neo4jService.verifyConnection();
        console.log('✅ Neo4j connection verified');
        // Get block data
        console.log(`Fetching block at height ${height}...`);
        const blockHash = await api.getBlockHash(height);
        if (!blockHash) {
            console.error(`❌ Could not get hash for block at height ${height}`);
            return;
        }
        // Get block with full transaction data (verbosity=2)
        const blockData = await api.getBlock(blockHash, 2);
        if (!blockData) {
            console.error(`❌ Could not get data for block at hash ${blockHash}`);
            return;
        }
        console.log(`✅ Retrieved block ${blockHash} at height ${height}`);
        // Process the block data
        const block = blockData;
        // Get raw block hex for protostone extraction
        console.log('Fetching raw block hex for protostone extraction...');
        const blockHex = await api.getBlockHex(blockHash);
        if (!blockHex) {
            console.error('❌ Could not get block hex data required for protostone extraction');
            return;
        }
        // Save hex to block for extraction but remove it before storage
        block.hex = blockHex;
        // Parse protostones from block
        console.log('Extracting protostones from block...');
        // Use hex to extract protostones using our parser
        const protostoneTransactions = (0, protostone_1.parseProtostonesFromBlock)(blockHex);
        console.log(`✅ Found ${protostoneTransactions.length} transactions with protostones`);
        // Clear out hex from the block before storing to avoid Neo4j type errors
        const blockForStorage = { ...block };
        delete blockForStorage.hex;
        // Store the block with its protostones - without trace data for this test
        console.log('Storing block in Neo4j (without trace data)...');
        await storage.storeBlock(blockForStorage, protostoneTransactions);
        console.log(`✅ Successfully processed and stored block ${height}`);
    }
    catch (error) {
        console.error('Error syncing block:', error);
    }
    finally {
        // Close Neo4j connection
        await neo4j_service_1.Neo4jService.getInstance().close();
        console.log('Neo4j connection closed');
    }
}
// Execute sync for a single block (use a block known to have protostones)
syncSingleBlock(1000)
    .then(() => console.log('Single block sync completed'))
    .catch(error => console.error('Failed to sync single block:', error));
