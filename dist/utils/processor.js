"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtostoneProcessor = void 0;
exports.syncBlocksToNeo4j = syncBlocksToNeo4j;
const blockApi_1 = require("../api/blockApi");
const traceApi_1 = require("../api/traceApi");
const protostone_1 = require("../parsers/protostone");
const trace_1 = require("../parsers/trace");
const fileStorage_1 = require("../storage/fileStorage");
const neo4j_storage_1 = require("../storage/neo4j-storage");
const logger_1 = require("./logger");
const path_1 = __importDefault(require("path"));
class ProtostoneProcessor {
    constructor(options) {
        this.isProcessing = false;
        this.options = {
            batchSize: 10,
            continueFromLastProcessed: false,
            processTraces: true,
            storeInNeo4j: false,
            ...options
        };
        this.blockApi = new blockApi_1.BlockApi(this.options.network);
        this.traceApi = new traceApi_1.TraceApi(this.options.network);
        this.fileStorage = new fileStorage_1.FileStorage(this.options.outputDir);
        this.neo4jStorage = neo4j_storage_1.neo4jStorage;
    }
    /**
     * Process blocks from startBlockHeight to endBlockHeight
     * @returns Number of blocks processed
     */
    async processBlocks() {
        if (this.isProcessing) {
            logger_1.Logger.warn('Block processing already in progress');
            return 0;
        }
        this.isProcessing = true;
        let blocksProcessed = 0;
        try {
            // Determine start block height
            let currentBlockHeight = this.options.startBlockHeight;
            if (this.options.continueFromLastProcessed) {
                const lastProcessedHeight = await this.fileStorage.getHighestProcessedBlockHeight();
                if (lastProcessedHeight >= 0) {
                    currentBlockHeight = lastProcessedHeight + 1;
                    logger_1.Logger.info(`Continuing from last processed block: ${lastProcessedHeight}`);
                }
            }
            // Determine end block height
            const endHeight = this.options.endBlockHeight || Number.MAX_SAFE_INTEGER;
            logger_1.Logger.info(`Starting block processing from height ${currentBlockHeight} to ${endHeight === Number.MAX_SAFE_INTEGER ? 'latest' : endHeight}`);
            logger_1.Logger.info(`Process traces: ${this.options.processTraces ? 'YES' : 'NO'}`);
            logger_1.Logger.info(`Store in Neo4j: ${this.options.storeInNeo4j ? 'YES' : 'NO'}`);
            // Process blocks in batches
            while (currentBlockHeight <= endHeight) {
                const batchEnd = Math.min(currentBlockHeight + (this.options.batchSize || 1) - 1, endHeight);
                logger_1.Logger.info(`Processing batch from ${currentBlockHeight} to ${batchEnd}`);
                // Process blocks in current batch
                for (let height = currentBlockHeight; height <= batchEnd; height++) {
                    const isProcessed = await this.fileStorage.isBlockProcessed(height);
                    if (isProcessed) {
                        logger_1.Logger.info(`Block ${height} already processed, skipping`);
                        continue;
                    }
                    try {
                        await this.processBlock(height);
                        blocksProcessed++;
                    }
                    catch (error) {
                        logger_1.Logger.error(`Error processing block ${height}: ${error.message}`);
                        // If we hit an error that might indicate we've reached the chain tip,
                        // break out of the loop
                        if (error.message.includes('Block not found') || error.message.includes('Hash not found')) {
                            logger_1.Logger.info('Reached chain tip or block not found, stopping processing');
                            break;
                        }
                    }
                }
                // Move to next batch
                currentBlockHeight = batchEnd + 1;
                // Check if we've reached the chain tip
                if (blocksProcessed === 0 && currentBlockHeight > endHeight) {
                    logger_1.Logger.info('Reached specified end height, stopping processing');
                    break;
                }
            }
            logger_1.Logger.info(`Block processing complete. Processed ${blocksProcessed} blocks.`);
            return blocksProcessed;
        }
        catch (error) {
            logger_1.Logger.error(`Error in block processing: ${error.message}`);
            throw error;
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Process a single block
     * @param blockHeight Block height to process
     * @returns Processed block data
     */
    async processBlock(blockHeight) {
        logger_1.Logger.info(`Processing block ${blockHeight}`);
        // Get block hash
        const blockHash = await this.blockApi.getBlockHashByHeight(blockHeight);
        logger_1.Logger.debug(`Block ${blockHeight} hash: ${blockHash}`);
        // Get block data for timestamp
        const blockData = await this.blockApi.getBlockByHash(blockHash, 1);
        const timestamp = (0, protostone_1.getBlockTimestamp)(blockData);
        // Get block hex for protostone parsing
        const blockHex = await this.blockApi.getBlockHexByHash(blockHash);
        // Always process block and extract protostones
        logger_1.Logger.info(`Processing protostones for block ${blockHeight}`);
        const protostoneData = (0, protostone_1.processBlock)(blockHex, blockHash, blockHeight, timestamp);
        logger_1.Logger.info(`Found ${protostoneData.transactions.length} transactions with protostones in block ${blockHeight}`);
        // Initialize result object
        const processedBlockData = {
            blockHash,
            blockHeight,
            timestamp,
            protostones: protostoneData
        };
        // Process traces if enabled and there are protostone transactions
        if (this.options.processTraces && protostoneData.transactions.length > 0) {
            logger_1.Logger.info(`Processing traces for ${protostoneData.transactions.length} protostone transactions in block ${blockHeight}`);
            processedBlockData.traces = await (0, trace_1.processTracesFromProtostones)(blockHash, blockHeight, timestamp, protostoneData.transactions, this.options.network);
            logger_1.Logger.info(`Found ${processedBlockData.traces?.traces.length || 0} transactions with traces in block ${blockHeight}`);
        }
        else if (this.options.processTraces) {
            logger_1.Logger.info(`No protostones found in block ${blockHeight}, skipping trace processing`);
        }
        // Save processed block
        const filePath = await this.saveProcessedData(processedBlockData);
        logger_1.Logger.info(`Block ${blockHeight} processed and saved to ${filePath}`);
        // Save the trace data if present
        if (processedBlockData.traces) {
            const traceResults = {};
            // Format trace data for storage
            for (const traceData of processedBlockData.traces.traces) {
                traceResults[`${traceData.txid}:${traceData.vout}`] = {
                    txid: traceData.txid,
                    status: "success",
                    message: "Trace completed",
                    result: traceData.traces
                };
            }
            // Store trace data in Neo4j
            if (Object.keys(traceResults).length > 0) {
                await this.neo4jStorage.storeTraceData(traceResults);
            }
        }
        // Store the block and protostones in Neo4j
        if (processedBlockData.protostones && processedBlockData.protostones.transactions.length > 0) {
            const blockData = await this.blockApi.getBlockByHash(processedBlockData.blockHash);
            if (blockData) {
                await this.neo4jStorage.storeBlock(blockData, processedBlockData.protostones.transactions);
            }
        }
        return processedBlockData;
    }
    /**
     * Save processed block data to files
     * @param data Processed block data
     * @returns Path to the saved file
     */
    async saveProcessedData(data) {
        // Create a directory for this block
        const blockDir = path_1.default.join(this.options.outputDir, `block_${data.blockHeight}`);
        await this.fileStorage.ensureDir(blockDir);
        // Save combined data
        const combinedPath = path_1.default.join(blockDir, 'combined.json');
        await this.fileStorage.saveJson(combinedPath, data);
        // Save protostones separately
        const prostonesPath = path_1.default.join(blockDir, 'protostones.json');
        await this.fileStorage.saveJson(prostonesPath, data.protostones);
        // Save traces separately if present
        if (data.traces) {
            const tracesPath = path_1.default.join(blockDir, 'traces.json');
            await this.fileStorage.saveJson(tracesPath, data.traces);
        }
        return blockDir;
    }
    /**
     * Extract protostones from a block using alkanes library
     * @param block Block to extract protostones from
     * @returns Array of protostone transactions
     */
    getProtostonesFromBlock(block) {
        try {
            // For now, since we don't have direct alkanes integration, we'll extract from tx data
            if (!block.tx || block.tx.length === 0) {
                logger_1.Logger.warn(`Block ${block.height} does not have transaction data, cannot extract protostones`);
                return [];
            }
            // Process the block to find transactions with protostones
            // Create a block hex from the block data if available
            const blockHex = block.hex ? block.hex : '';
            const blockHash = block.hash;
            const blockHeight = block.height;
            const timestamp = block.time;
            const processedData = (0, protostone_1.processBlock)(blockHex, blockHash, blockHeight, timestamp);
            return processedData.transactions || [];
        }
        catch (error) {
            logger_1.Logger.error(`Error extracting protostones from block ${block.height}:`, error);
            return [];
        }
    }
    /**
     * Sync blocks to Neo4j
     * @param startHeight Starting block height
     * @param endHeight Ending block height
     * @param neo4jStorage Neo4j storage instance
     * @param blockApi Block API instance
     * @param traceApi Trace API instance
     */
    async syncBlocksToNeo4j(startHeight, endHeight, neo4jStorage, blockApi, traceApi) {
        // Process blocks in batches
        while (startHeight <= endHeight) {
            const batchEnd = Math.min(startHeight + 100 - 1, endHeight);
            logger_1.Logger.info(`Processing batch from ${startHeight} to ${batchEnd}`);
            // Process blocks in current batch
            for (let height = startHeight; height <= batchEnd; height++) {
                try {
                    // Get block data
                    const blockData = await blockApi.getBlockByHeight(height);
                    if (!blockData) {
                        logger_1.Logger.error(`Block ${height} not found`);
                        continue;
                    }
                    // Get block hash
                    const blockHash = blockData.hash;
                    // Get block hex for protostone parsing
                    const blockHex = await blockApi.getBlockHexByHash(blockHash);
                    // Always process block and extract protostones
                    logger_1.Logger.info(`Processing protostones for block ${height}`);
                    const protostoneData = (0, protostone_1.processBlock)(blockHex, blockHash, height, blockData.time);
                    logger_1.Logger.info(`Found ${protostoneData.transactions.length} transactions with protostones in block ${height}`);
                    // Store the block and protostones in Neo4j
                    if (protostoneData && protostoneData.transactions.length > 0) {
                        await neo4jStorage.storeBlock(blockData, protostoneData.transactions);
                    }
                }
                catch (error) {
                    logger_1.Logger.error(`Error processing block ${height}: ${error.message}`);
                }
            }
            // Move to next batch
            startHeight = batchEnd + 1;
        }
    }
}
exports.ProtostoneProcessor = ProtostoneProcessor;
/**
 * Sync blocks to Neo4j storage using the provided configuration
 * @param config Processor configuration
 */
async function syncBlocksToNeo4j(config) {
    try {
        // Initialize services
        const blockApi = new blockApi_1.BlockApi(config.network);
        const traceApi = new traceApi_1.TraceApi();
        const storage = new Neo4jStorage();
        // Sleep function for rate limiting
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        // Verify Neo4j connection
        const neo4jService = Neo4jService.getInstance();
        await neo4jService.verifyConnection();
        console.log('✅ Neo4j connection verified');
        // Create processor instance
        const processor = new ProtostoneProcessor(blockApi);
        // Process blocks from start to end height
        for (let height = config.startHeight; height <= config.endHeight; height += config.batchSize) {
            const batchEnd = Math.min(height + config.batchSize - 1, config.endHeight);
            console.log(`\n----- Processing blocks ${height} to ${batchEnd} -----`);
            // Process each block in batch
            for (let blockHeight = height; blockHeight <= batchEnd; blockHeight++) {
                // Check if we should skip this block
                if (config.skipExisting && !config.force) {
                    const repo = new ProtostoneRepository();
                    const exists = await repo.blockExists(blockHeight);
                    if (exists) {
                        console.log(`Block ${blockHeight} already exists, skipping`);
                        continue;
                    }
                }
                try {
                    // Process the block
                    console.log(`Processing block ${blockHeight}...`);
                    // Get block hash
                    const blockHash = await blockApi.getBlockHash(blockHeight);
                    // Get block with transactions
                    const blockData = await blockApi.getBlock(blockHash, 2);
                    // Get raw block hex
                    const blockHex = await blockApi.getBlockHex(blockHash);
                    // Extract protostones
                    console.log(`Extracting protostones from block ${blockHeight}...`);
                    const protostoneData = (0, protostone_1.processBlock)(blockHex, blockHash, blockHeight, blockData.time);
                    // Process trace data if available
                    if (protostoneData && protostoneData.transactions.length > 0) {
                        console.log(`Found ${protostoneData.transactions.length} transactions with protostones`);
                        // Store block and protostones
                        await storage.storeBlock(blockData, protostoneData.transactions);
                        console.log(`✅ Block ${blockHeight} processed successfully`);
                    }
                    else {
                        console.log(`No protostones found in block ${blockHeight}`);
                        // Store just the block
                        await storage.storeBlock(blockData, []);
                    }
                }
                catch (error) {
                    console.error(`Error processing block ${blockHeight}:`, error);
                    if (config.retryFailed) {
                        console.log(`\n🔄 Retrying block ${blockHeight}...`);
                        await sleep(config.delayMs * 2); // Double delay for retries
                        try {
                            // Process the block again
                            const blockHash = await blockApi.getBlockHash(blockHeight);
                            const blockData = await blockApi.getBlock(blockHash, 2);
                            const blockHex = await blockApi.getBlockHex(blockHash);
                            const protostoneData = (0, protostone_1.processBlock)(blockHex, blockHash, blockHeight, blockData.time);
                            if (protostoneData && protostoneData.transactions.length > 0) {
                                await storage.storeBlock(blockData, protostoneData.transactions);
                                console.log(`✅ Retry successful for block ${blockHeight}`);
                            }
                            else {
                                await storage.storeBlock(blockData, []);
                                console.log(`✅ Retry successful for block ${blockHeight} (no protostones)`);
                            }
                        }
                        catch (retryError) {
                            console.error(`❌ Retry failed for block ${blockHeight}:`, retryError);
                        }
                    }
                }
                // Add delay between blocks
                await sleep(config.delayMs);
            }
        }
        console.log('✅ Sync completed successfully');
    }
    catch (error) {
        console.error('Error in sync process:', error);
        throw error;
    }
}
