"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.robustSync = robustSync;
const blockApi_1 = require("../api/blockApi");
const traceApi_1 = require("../api/traceApi");
const neo4j_storage_1 = require("../storage/neo4j-storage");
const neo4j_service_1 = require("../db/neo4j-service");
const protostone_repository_1 = require("../db/protostone-repository");
const protostone_1 = require("../parsers/protostone");
const config_1 = require("../api/config");
// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
/**
 * A more robust implementation of the blockchain syncing process with improved
 * error handling and resilience. This version uses our approach of storing
 * only event types instead of full trace data.
 *
 * @param startHeight Start block height
 * @param endHeight End block height
 * @param batchSize Number of blocks to process in each batch
 * @param delayMs Delay between API requests
 * @param skipExisting Skip blocks that are already in the database
 * @returns Promise that resolves when sync is complete
 */
async function robustSync(startHeight, endHeight, batchSize = 5, delayMs = 2000, skipExisting = false) {
    console.log(`Starting robust sync from block ${startHeight} to ${endHeight}`);
    console.log(`Using batch size: ${batchSize}, delay: ${delayMs}ms`);
    // Initialize services
    const blockApi = new blockApi_1.BlockApi(config_1.Network.OYLNET);
    const traceApi = new traceApi_1.TraceApi();
    const storage = new neo4j_storage_1.Neo4jStorage();
    const repository = new protostone_repository_1.ProtostoneRepository();
    try {
        // Verify Neo4j connection
        const neo4jService = neo4j_service_1.Neo4jService.getInstance();
        await neo4jService.verifyConnection();
        console.log('✅ Neo4j connection verified');
        // Initialize tracking variables
        let processedBlocks = 0;
        let successfulBlocks = 0;
        let skippedBlocks = 0;
        let failedBlocks = 0;
        let protostonesProcessed = 0;
        // Process blocks in batches
        for (let height = startHeight; height <= endHeight; height += batchSize) {
            const batchEnd = Math.min(height + batchSize - 1, endHeight);
            console.log(`\n----- Processing batch: blocks ${height} to ${batchEnd} -----`);
            // Process each block in the batch
            for (let blockHeight = height; blockHeight <= batchEnd; blockHeight++) {
                try {
                    // Check if we should skip this block
                    if (skipExisting) {
                        const exists = await repository.blockExists(blockHeight);
                        if (exists) {
                            console.log(`Block ${blockHeight} already exists, skipping`);
                            skippedBlocks++;
                            processedBlocks++;
                            continue;
                        }
                    }
                    console.log(`\nProcessing block ${blockHeight}...`);
                    // Step 1: Get block data
                    const blockHash = await blockApi.getBlockHash(blockHeight);
                    if (!blockHash) {
                        console.error(`❌ Could not get hash for block at height ${blockHeight}`);
                        failedBlocks++;
                        processedBlocks++;
                        continue;
                    }
                    const blockData = await blockApi.getBlock(blockHash, 2);
                    if (!blockData) {
                        console.error(`❌ Could not get data for block at hash ${blockHash}`);
                        failedBlocks++;
                        processedBlocks++;
                        continue;
                    }
                    // Step 2: Get raw block hex for protostone extraction
                    const blockHex = await blockApi.getBlockHex(blockHash);
                    if (!blockHex) {
                        console.error(`❌ Could not get block hex data for ${blockHash}`);
                        failedBlocks++;
                        processedBlocks++;
                        continue;
                    }
                    // Step 3: Extract protostones from block
                    console.log(`Extracting protostones from block ${blockHeight}...`);
                    const protostoneTransactions = (0, protostone_1.parseProtostonesFromBlock)(blockHex);
                    let protostoneCount = 0;
                    if (protostoneTransactions && protostoneTransactions.length > 0) {
                        // Count total protostones
                        for (const tx of protostoneTransactions) {
                            protostoneCount += tx.protostones?.length || 0;
                        }
                        console.log(`Found ${protostoneTransactions.length} transactions with ${protostoneCount} protostones`);
                    }
                    else {
                        console.log(`No protostones found in block ${blockHeight}`);
                    }
                    // Step 4: Process trace data if we have protostones
                    if (protostoneCount > 0) {
                        console.log(`Fetching trace data for ${protostoneCount} protostones...`);
                        for (const tx of protostoneTransactions) {
                            const txid = tx.txid;
                            for (const protostone of tx.protostones) {
                                try {
                                    const vout = protostone.vout;
                                    console.log(`Fetching trace for ${txid}:${vout}...`);
                                    // Call trace API
                                    const traceResult = await traceApi.getTransactionTrace(txid, vout);
                                    if (traceResult && traceResult.result && traceResult.result.length > 0) {
                                        // Store event types directly on the protostone node
                                        await repository.storeProtostoneTraceEvents(txid, vout, traceResult);
                                        console.log(`✅ Trace data processed for ${txid}:${vout}`);
                                    }
                                    else {
                                        console.log(`No trace events found for ${txid}:${vout}`);
                                    }
                                    // Add a small delay between trace API calls
                                    await sleep(500);
                                }
                                catch (error) {
                                    console.warn(`Error processing trace for ${txid}:${protostone.vout}:`, error);
                                    // Continue with next protostone - don't fail the entire batch
                                }
                            }
                        }
                        protostonesProcessed += protostoneCount;
                    }
                    // Step 5: Store the block with its protostones
                    console.log(`Storing block ${blockHeight} in Neo4j...`);
                    // Create a clean copy of the block without hex data
                    const blockForStorage = { ...blockData };
                    delete blockForStorage.hex;
                    await storage.storeBlock(blockForStorage, protostoneTransactions);
                    console.log(`✅ Block ${blockHeight} successfully processed and stored`);
                    successfulBlocks++;
                    processedBlocks++;
                }
                catch (error) {
                    console.error(`❌ Error processing block ${blockHeight}:`, error);
                    failedBlocks++;
                    processedBlocks++;
                }
                // Add delay between blocks
                await sleep(delayMs);
            }
            // Report progress after each batch
            console.log(`\n----- Batch progress report -----`);
            console.log(`Processed ${processedBlocks}/${endHeight - startHeight + 1} blocks`);
            console.log(`✅ Successful: ${successfulBlocks}`);
            console.log(`⏭️ Skipped: ${skippedBlocks}`);
            console.log(`❌ Failed: ${failedBlocks}`);
            console.log(`🗿 Protostones processed: ${protostonesProcessed}`);
        }
        // Final verification
        try {
            const stats = await repository.verifyGraphModel();
            console.log('\n📊 Final graph model statistics:');
            console.log(`- Blocks: ${stats.blockCount}`);
            console.log(`- Transactions: ${stats.txCount}`);
            console.log(`- Outputs: ${stats.outputCount}`);
            console.log(`- Protostones: ${stats.protostoneCount}`);
            console.log(`- Addresses: ${stats.addressCount}`);
            console.log(`\n✅ Sync completed successfully!`);
        }
        catch (error) {
            console.error('Error verifying final graph model:', error);
        }
    }
    catch (error) {
        console.error('Fatal error during sync:', error);
        throw error;
    }
}
