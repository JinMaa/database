import { BlockApi } from '../api/blockApi';
import { TraceApi } from '../api/traceApi';
import { Network } from '../api/config';
import { processBlock, getBlockTimestamp } from '../parsers/protostone';
import { processTracesFromProtostones } from '../parsers/trace';
import { FileStorage } from '../storage/fileStorage';
import { neo4jStorage } from '../storage/neo4j-storage';
import { Storage } from '../storage/storage';
import { Logger } from './logger';
import { ProcessedBlock } from '../types/protostone';
import { ProcessedTraceBlock } from '../parsers/trace';
import { Block } from '../types/block';
import { ProtostoneTransaction } from '../types/protostone';
import path from 'path';
import * as alkanes from 'alkanes';

export interface ProcessorOptions {
  startBlockHeight: number;
  endBlockHeight?: number;
  network: Network;
  outputDir: string;
  batchSize?: number;
  continueFromLastProcessed?: boolean;
  processTraces?: boolean;
  storeInNeo4j?: boolean;
}

export interface ProcessingResult {
  blockData: {
    hash: string;
    height: number;
    prevBlock?: string;
    merkleRoot?: string;
    time: number;
    bits?: string;
    nonce?: number;
    size?: number;
    transactions?: any[];
    version?: number;
  };
  protostones: ProcessedBlock;
  traces?: ProcessedTraceBlock;
}

export interface ProcessedBlockData {
  blockHash: string;
  blockHeight: number;
  timestamp: number;
  protostones: ProcessedBlock;
  traces?: ProcessedTraceBlock;
}

export interface ProcessorConfig {
  network: Network | string;
  startHeight: number;
  endHeight: number;
  batchSize: number;
  delayMs: number;
  skipExisting: boolean;
  retryFailed: boolean;
  force: boolean;
}

export class ProtostoneProcessor {
  private blockApi: BlockApi;
  private traceApi: TraceApi;
  private fileStorage: FileStorage;
  private neo4jStorage: Storage;
  private options: ProcessorOptions;
  private isProcessing: boolean = false;

  constructor(options: ProcessorOptions) {
    this.options = {
      batchSize: 10,
      continueFromLastProcessed: false,
      processTraces: true,
      storeInNeo4j: false,
      ...options
    };

    this.blockApi = new BlockApi(this.options.network);
    this.traceApi = new TraceApi(this.options.network);
    this.fileStorage = new FileStorage(this.options.outputDir);
    this.neo4jStorage = neo4jStorage;
  }

  /**
   * Process blocks from startBlockHeight to endBlockHeight
   * @returns Number of blocks processed
   */
  public async processBlocks(): Promise<number> {
    if (this.isProcessing) {
      Logger.warn('Block processing already in progress');
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
          Logger.info(`Continuing from last processed block: ${lastProcessedHeight}`);
        }
      }

      // Determine end block height
      const endHeight = this.options.endBlockHeight || Number.MAX_SAFE_INTEGER;

      Logger.info(`Starting block processing from height ${currentBlockHeight} to ${endHeight === Number.MAX_SAFE_INTEGER ? 'latest' : endHeight}`);
      Logger.info(`Process traces: ${this.options.processTraces ? 'YES' : 'NO'}`);
      Logger.info(`Store in Neo4j: ${this.options.storeInNeo4j ? 'YES' : 'NO'}`);

      // Process blocks in batches
      while (currentBlockHeight <= endHeight) {
        const batchEnd = Math.min(currentBlockHeight + (this.options.batchSize || 1) - 1, endHeight);
        Logger.info(`Processing batch from ${currentBlockHeight} to ${batchEnd}`);

        // Process blocks in current batch
        for (let height = currentBlockHeight; height <= batchEnd; height++) {
          const isProcessed = await this.fileStorage.isBlockProcessed(height);
          
          if (isProcessed) {
            Logger.info(`Block ${height} already processed, skipping`);
            continue;
          }

          try {
            await this.processBlock(height);
            blocksProcessed++;
          } catch (error: any) {
            Logger.error(`Error processing block ${height}: ${error.message}`);
            
            // If we hit an error that might indicate we've reached the chain tip,
            // break out of the loop
            if (error.message.includes('Block not found') || error.message.includes('Hash not found')) {
              Logger.info('Reached chain tip or block not found, stopping processing');
              break;
            }
          }
        }

        // Move to next batch
        currentBlockHeight = batchEnd + 1;
        
        // Check if we've reached the chain tip
        if (blocksProcessed === 0 && currentBlockHeight > endHeight) {
          Logger.info('Reached specified end height, stopping processing');
          break;
        }
      }

      Logger.info(`Block processing complete. Processed ${blocksProcessed} blocks.`);
      return blocksProcessed;
    } catch (error: any) {
      Logger.error(`Error in block processing: ${error.message}`);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single block
   * @param blockHeight Block height to process
   * @returns Processed block data
   */
  private async processBlock(blockHeight: number): Promise<ProcessedBlockData> {
    Logger.info(`Processing block ${blockHeight}`);

    // Get block hash
    const blockHash = await this.blockApi.getBlockHashByHeight(blockHeight);
    Logger.debug(`Block ${blockHeight} hash: ${blockHash}`);

    // Get block data for timestamp
    const blockData = await this.blockApi.getBlockByHash(blockHash, 1) as Block;
    const timestamp = getBlockTimestamp(blockData);
    
    // Get block hex for protostone parsing
    const blockHex = await this.blockApi.getBlockHexByHash(blockHash);
    
    // Always process block and extract protostones
    Logger.info(`Processing protostones for block ${blockHeight}`);
    const protostoneData = processBlock(blockHex, blockHash, blockHeight, timestamp);
    Logger.info(`Found ${protostoneData.transactions.length} transactions with protostones in block ${blockHeight}`);
    
    // Initialize result object
    const processedBlockData: ProcessedBlockData = {
      blockHash,
      blockHeight,
      timestamp,
      protostones: protostoneData
    };
    
    // Process traces if enabled and there are protostone transactions
    if (this.options.processTraces && protostoneData.transactions.length > 0) {
      Logger.info(`Processing traces for ${protostoneData.transactions.length} protostone transactions in block ${blockHeight}`);
      processedBlockData.traces = await processTracesFromProtostones(
        blockHash, 
        blockHeight, 
        timestamp,
        protostoneData.transactions, 
        this.options.network
      );
      Logger.info(`Found ${processedBlockData.traces?.traces.length || 0} transactions with traces in block ${blockHeight}`);
    } else if (this.options.processTraces) {
      Logger.info(`No protostones found in block ${blockHeight}, skipping trace processing`);
    }
    
    // Save processed block
    const filePath = await this.saveProcessedData(processedBlockData);
    Logger.info(`Block ${blockHeight} processed and saved to ${filePath}`);
    
    // Save the trace data if present
    if (processedBlockData.traces) {
      const traceResults: Record<string, any> = {};
      
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
        await this.neo4jStorage.storeBlock(blockData as Block, processedBlockData.protostones.transactions);
      }
    }
    
    return processedBlockData;
  }
  
  /**
   * Save processed block data to files
   * @param data Processed block data
   * @returns Path to the saved file
   */
  private async saveProcessedData(data: ProcessedBlockData): Promise<string> {
    // Create a directory for this block
    const blockDir = path.join(this.options.outputDir, `block_${data.blockHeight}`);
    await this.fileStorage.ensureDir(blockDir);
    
    // Save combined data
    const combinedPath = path.join(blockDir, 'combined.json');
    await this.fileStorage.saveJson(combinedPath, data);
    
    // Save protostones separately
    const prostonesPath = path.join(blockDir, 'protostones.json');
    await this.fileStorage.saveJson(prostonesPath, data.protostones);
    
    // Save traces separately if present
    if (data.traces) {
      const tracesPath = path.join(blockDir, 'traces.json');
      await this.fileStorage.saveJson(tracesPath, data.traces);
    }
    
    return blockDir;
  }

  /**
   * Extract protostones from a block using alkanes library
   * @param block Block to extract protostones from
   * @returns Array of protostone transactions
   */
  private getProtostonesFromBlock(block: Block): ProtostoneTransaction[] {
    try {
      // For now, since we don't have direct alkanes integration, we'll extract from tx data
      if (!block.tx || block.tx.length === 0) {
        Logger.warn(`Block ${block.height} does not have transaction data, cannot extract protostones`);
        return [];
      }
      
      // Process the block to find transactions with protostones
      // Create a block hex from the block data if available
      const blockHex = block.hex ? block.hex : '';
      const blockHash = block.hash;
      const blockHeight = block.height;
      const timestamp = block.time;
      
      const processedData = processBlock(blockHex, blockHash, blockHeight, timestamp);
      return processedData.transactions || [];
    } catch (error) {
      Logger.error(`Error extracting protostones from block ${block.height}:`, error);
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
  public async syncBlocksToNeo4j(startHeight: number, endHeight: number, neo4jStorage: Storage, blockApi: BlockApi, traceApi: TraceApi): Promise<void> {
    // Process blocks in batches
    while (startHeight <= endHeight) {
      const batchEnd = Math.min(startHeight + 100 - 1, endHeight);
      Logger.info(`Processing batch from ${startHeight} to ${batchEnd}`);

      // Process blocks in current batch
      for (let height = startHeight; height <= batchEnd; height++) {
        try {
          // Get block data
          const blockData = await blockApi.getBlockByHeight(height);
          if (!blockData) {
            Logger.error(`Block ${height} not found`);
            continue;
          }

          // Get block hash
          const blockHash = blockData.hash;

          // Get block hex for protostone parsing
          const blockHex = await blockApi.getBlockHexByHash(blockHash);

          // Always process block and extract protostones
          Logger.info(`Processing protostones for block ${height}`);
          const protostoneData = processBlock(blockHex, blockHash, height, blockData.time);
          Logger.info(`Found ${protostoneData.transactions.length} transactions with protostones in block ${height}`);

          // Store the block and protostones in Neo4j
          if (protostoneData && protostoneData.transactions.length > 0) {
            await neo4jStorage.storeBlock(blockData, protostoneData.transactions);
          }
        } catch (error: any) {
          Logger.error(`Error processing block ${height}: ${error.message}`);
        }
      }

      // Move to next batch
      startHeight = batchEnd + 1;
    }
  }
}

/**
 * Sync blocks to Neo4j storage using the provided configuration
 * @param config Processor configuration
 */
export async function syncBlocksToNeo4j(config: ProcessorConfig): Promise<void> {
  try {
    // Initialize services
    const blockApi = new BlockApi(config.network);
    const traceApi = new TraceApi();
    const storage = new Neo4jStorage();
    
    // Sleep function for rate limiting
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
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
          const blockData = await blockApi.getBlock(blockHash, 2) as Block;
          
          // Get raw block hex
          const blockHex = await blockApi.getBlockHex(blockHash);
          
          // Extract protostones
          console.log(`Extracting protostones from block ${blockHeight}...`);
          const protostoneData = processBlock(blockHex, blockHash, blockHeight, blockData.time);
          
          // Process trace data if available
          if (protostoneData && protostoneData.transactions.length > 0) {
            console.log(`Found ${protostoneData.transactions.length} transactions with protostones`);
            
            // Store block and protostones
            await storage.storeBlock(blockData, protostoneData.transactions);
            console.log(`✅ Block ${blockHeight} processed successfully`);
          } else {
            console.log(`No protostones found in block ${blockHeight}`);
            
            // Store just the block
            await storage.storeBlock(blockData, []);
          }
        } catch (error) {
          console.error(`Error processing block ${blockHeight}:`, error);
          
          if (config.retryFailed) {
            console.log(`\n🔄 Retrying block ${blockHeight}...`);
            await sleep(config.delayMs * 2); // Double delay for retries
            
            try {
              // Process the block again
              const blockHash = await blockApi.getBlockHash(blockHeight);
              const blockData = await blockApi.getBlock(blockHash, 2) as Block;
              const blockHex = await blockApi.getBlockHex(blockHash);
              
              const protostoneData = processBlock(blockHex, blockHash, blockHeight, blockData.time);
              
              if (protostoneData && protostoneData.transactions.length > 0) {
                await storage.storeBlock(blockData, protostoneData.transactions);
                console.log(`✅ Retry successful for block ${blockHeight}`);
              } else {
                await storage.storeBlock(blockData, []);
                console.log(`✅ Retry successful for block ${blockHeight} (no protostones)`);
              }
            } catch (retryError) {
              console.error(`❌ Retry failed for block ${blockHeight}:`, retryError);
            }
          }
        }
        
        // Add delay between blocks
        await sleep(config.delayMs);
      }
    }
    
    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.error('Error in sync process:', error);
    throw error;
  }
}
