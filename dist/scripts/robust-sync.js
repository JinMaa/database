"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const neo4j_service_1 = require("../db/neo4j-service");
const protostone_repository_1 = require("../db/protostone-repository");
const blockApi_1 = require("../api/blockApi");
const traceApi_1 = require("../api/traceApi");
const protostone_1 = require("../parsers/protostone");
const neo4j_storage_1 = require("../storage/neo4j-storage");
const config_1 = require("../api/config");
// Load environment variables
dotenv_1.default.config();
/**
 * A more robust sync implementation with careful error handling and data processing
 */
async function robustSync(startHeight, endHeight) {
    console.log(`Starting robust sync from block ${startHeight} to ${endHeight}`);
    // Initialize services
    const blockApi = new blockApi_1.BlockApi(config_1.Network.OYLNET);
    const traceApi = new traceApi_1.TraceApi();
    const storage = new neo4j_storage_1.Neo4jStorage();
    try {
        // Verify Neo4j connection
        const neo4jService = neo4j_service_1.Neo4jService.getInstance();
        await neo4jService.verifyConnection();
        console.log('✅ Neo4j connection verified');
        // Process blocks one at a time for better error isolation
        for (let height = startHeight; height <= endHeight; height++) {
            try {
                console.log(`\n----- Processing block ${height} -----`);
                // 1. Get block data
                console.log(`Fetching block at height ${height}...`);
                const blockHash = await blockApi.getBlockHash(height);
                if (!blockHash) {
                    console.error(`❌ Could not get hash for block at height ${height}`);
                    continue;
                }
                const blockData = await blockApi.getBlock(blockHash, 2);
                if (!blockData) {
                    console.error(`❌ Could not get data for block at hash ${blockHash}`);
                    continue;
                }
                console.log(`Fetched block ${blockHash} at height ${height}`);
                // 2. Get raw block hex for protostone extraction
                const blockHex = await blockApi.getBlockHex(blockHash);
                if (!blockHex) {
                    console.error('❌ Could not get block hex data required for protostone extraction');
                    continue;
                }
                // 3. Extract protostones from block
                const block = blockData;
                block.hex = blockHex; // Add hex to block for internal use
                console.log('Extracting protostones from block...');
                const protostoneTransactions = (0, protostone_1.parseProtostonesFromBlock)(blockHex);
                if (!protostoneTransactions || protostoneTransactions.length === 0) {
                    console.log('No protostones found in this block, storing just the block data');
                    // Still store the block even with no protostones
                    const blockForStorage = { ...block };
                    delete blockForStorage.hex; // Remove hex before storage
                    await storage.storeBlock(blockForStorage, []);
                    console.log(`✅ Block ${height} stored without protostones`);
                    continue;
                }
                console.log(`Found ${protostoneTransactions.length} transactions with protostones`);
                // 4. Get trace data for each protostone - but handle each individually
                console.log('Collecting trace data for protostones...');
                const traceResults = {};
                // Process each transaction's protostones one by one
                for (const tx of protostoneTransactions) {
                    const txid = tx.txid;
                    console.log(`Processing protostones in transaction ${txid}...`);
                    for (const protostone of tx.protostones) {
                        try {
                            // Get the proper vout from the protostone data
                            const vout = protostone.vout;
                            console.log(`Fetching trace data for ${txid}:${vout}...`);
                            // Call trace API
                            const traceResult = await traceApi.getTransactionTrace(txid, vout);
                            if (!traceResult || !traceResult.result) {
                                console.log(`No trace data found for ${txid}:${vout}`);
                                continue;
                            }
                            console.log(`Found ${traceResult.result.length} trace events for ${txid}:${vout}`);
                            // Store in results map with key in format "txid:vout"
                            traceResults[`${txid}:${vout}`] = traceResult;
                        }
                        catch (error) {
                            console.error(`Error fetching trace for protostone at ${txid}:${protostone.vout}:`, error);
                            // Continue with next protostone
                        }
                    }
                }
                // 5. Store trace data in Neo4j if we have any
                if (Object.keys(traceResults).length > 0) {
                    console.log(`Storing trace data for ${Object.keys(traceResults).length} protostones...`);
                    try {
                        const repo = new protostone_repository_1.ProtostoneRepository();
                        const storedCount = await repo.storeMultipleProtostoneTraces(traceResults);
                        console.log(`✅ Successfully stored trace data for ${storedCount} protostones`);
                    }
                    catch (error) {
                        console.error('Error storing trace data:', error);
                        // Continue with block storage even if trace storage fails
                    }
                }
                else {
                    console.log('No trace data to store');
                }
                // 6. Store the block with its protostones
                console.log('Storing block and protostones in Neo4j...');
                const blockForStorage = { ...block };
                delete blockForStorage.hex; // Remove hex before storage
                await storage.storeBlock(blockForStorage, protostoneTransactions);
                console.log(`✅ Successfully processed and stored block ${height}`);
            }
            catch (error) {
                console.error(`Error processing block ${height}:`, error);
                // Continue with next block
            }
        }
        console.log(`\n✅ Completed robust sync from block ${startHeight} to ${endHeight}`);
    }
    catch (error) {
        console.error('Fatal error in sync process:', error);
    }
    finally {
        // Close Neo4j connection
        await neo4j_service_1.Neo4jService.getInstance().close();
        console.log('Neo4j connection closed');
    }
}
// Execute robust sync - adjust these parameters as needed
const startBlock = 680;
const endBlock = 685;
robustSync(startBlock, endBlock)
    .then(() => console.log('Robust sync completed'))
    .catch(error => console.error('Robust sync failed:', error));
