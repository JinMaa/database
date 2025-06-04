import { BlockApi } from '../api/blockApi';
import { TraceApi } from '../api/traceApi';
import { Network } from '../api/config';
import { Storage } from '../storage/storage';
import { ProcessedBlock } from '../types/protostone';
import { ProcessedTraceBlock } from '../parsers/trace';
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
export declare class ProtostoneProcessor {
    private blockApi;
    private traceApi;
    private fileStorage;
    private neo4jStorage;
    private options;
    private isProcessing;
    constructor(options: ProcessorOptions);
    /**
     * Process blocks from startBlockHeight to endBlockHeight
     * @returns Number of blocks processed
     */
    processBlocks(): Promise<number>;
    /**
     * Process a single block
     * @param blockHeight Block height to process
     * @returns Processed block data
     */
    private processBlock;
    /**
     * Save processed block data to files
     * @param data Processed block data
     * @returns Path to the saved file
     */
    private saveProcessedData;
    /**
     * Extract protostones from a block using alkanes library
     * @param block Block to extract protostones from
     * @returns Array of protostone transactions
     */
    private getProtostonesFromBlock;
    /**
     * Sync blocks to Neo4j
     * @param startHeight Starting block height
     * @param endHeight Ending block height
     * @param neo4jStorage Neo4j storage instance
     * @param blockApi Block API instance
     * @param traceApi Trace API instance
     */
    syncBlocksToNeo4j(startHeight: number, endHeight: number, neo4jStorage: Storage, blockApi: BlockApi, traceApi: TraceApi): Promise<void>;
}
/**
 * Sync blocks to Neo4j storage using the provided configuration
 * @param config Processor configuration
 */
export declare function syncBlocksToNeo4j(config: ProcessorConfig): Promise<void>;
