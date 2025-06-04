import { Block } from '../types/block';
/**
 * Repository for storing and querying protostones, blocks, transactions, and outputs in Neo4j
 */
export declare class ProtostoneRepository {
    private neo4jService;
    constructor();
    /**
     * Creates Neo4j constraints and indexes if they don't exist
     */
    setupDatabase(): Promise<void>;
    /**
     * Clears all protostone data from the database (for testing)
     */
    clearProtostoneData(): Promise<void>;
    /**
     * Store a block and all its transactions, inputs, outputs, and protostones in Neo4j
     */
    storeBlock(block: Block): Promise<void>;
    /**
     * Extract transaction properties for storage
     */
    private getTxProperties;
    /**
     * Store a coinbase transaction with its outputs
     */
    private storeCoinbaseTransaction;
    /**
     * Store a regular transaction with its inputs and outputs
     */
    private storeTransaction;
    /**
     * Store a transaction output and link it to address if applicable
     */
    private storeOutput;
    /**
     * Store protostones as shadow outputs (virtual outputs) for a transaction
     */
    private storeProtostones;
    /**
     * Deep process an object to handle BigInt and other problematic types
     */
    private deepProcessObject;
    /**
     * Safely stringify a JSON object, handling circular references and BigInt values
     */
    private safeJsonStringify;
    /**
     * Query for protostones by transaction ID
     */
    getProtostonesByTxid(txid: string): Promise<any[]>;
    /**
     * Query for blocks with protostones
     */
    getBlocksWithProtostones(limit?: number, skip?: number): Promise<any[]>;
    /**
     * Query for transactions containing protostones in a specific block
     */
    getProtostoneTransactionsByBlock(blockHash: string): Promise<any[]>;
    /**
     * Get protostone protocols with counts
     */
    getProtostoneProtocols(): Promise<any[]>;
    /**
     * Verify the graph model by retrieving counts of different node types
     */
    verifyGraphModel(): Promise<{
        blockCount: number;
        txCount: number;
        outputCount: number;
        protostoneCount: number;
        addressCount: number;
    }>;
    /**
     * Check if a block exists in the database
     * @param height Block height
     * @returns True if the block exists
     */
    blockExists(height: number): Promise<boolean>;
    /**
     * Get the range of block heights
     * @returns Object with min and max block heights
     */
    getBlockHeightRange(): Promise<{
        min: number;
        max: number;
    }>;
    /**
     * Find missing blocks in a range
     * @param startHeight Start height
     * @param endHeight End height
     * @returns Array of missing block heights
     */
    findMissingBlocks(startHeight: number, endHeight: number): Promise<number[]>;
    /**
     * Get top blocks by protostone count
     * @param limit Number of blocks to return
     * @returns Array of blocks with their protostone counts
     */
    getProtostonesPerBlock(limit?: number): Promise<Array<{
        height: number;
        hash: string;
        count: number;
    }>>;
    /**
     * Get top blocks by transaction count
     * @param limit Number of blocks to return
     * @returns Array of blocks with their transaction counts
     */
    getTransactionsPerBlock(limit?: number): Promise<Array<{
        height: number;
        hash: string;
        count: number;
    }>>;
    /**
     * Clear all data from the database
     */
    clearAllData(): Promise<void>;
    /**
     * Fix incorrect coinbase transaction relationships
     * This removes all [:in] relationships from :coinbase outputs to transactions
     */
    fixCoinbaseRelationships(): Promise<{
        removed: number;
    }>;
    /**
     * Processes and stores trace data for a protostone, creating event nodes
     * connected to the protostone node
     *
     * @param txid Transaction ID
     * @param vout Virtual output index
     * @param traceData Trace event data from the API
     * @returns Number of trace events stored
     */
    storeProtostoneTraceEvents(txid: string, vout: number, traceData: any): Promise<number>;
    /**
     * Processes and stores trace data for multiple protostones
     *
     * @param traceResults Map of transaction ID + vout to trace results
     * @returns Number of protostones with trace events stored
     */
    storeMultipleProtostoneTraces(traceResults: Record<string, any>): Promise<number>;
}
