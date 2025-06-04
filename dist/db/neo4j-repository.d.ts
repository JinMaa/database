import { Block } from '../types/block';
import { ProtostoneTransaction } from '../types/protostone';
/**
 * Lightweight Neo4j repository for storing block, transaction, and protostone data
 * with careful handling of property types to avoid Neo4j type errors
 */
export declare class Neo4jRepository {
    private neo4jService;
    constructor();
    /**
     * Set up database constraints and indexes
     */
    setupDatabase(): Promise<void>;
    /**
     * Clear all data from Neo4j
     */
    clearAllData(): Promise<void>;
    /**
     * Store a block without its transactions (minimal block data)
     */
    storeBlockMinimal(block: Block): Promise<void>;
    /**
     * Store a transaction with its inputs and outputs
     */
    storeTransaction(tx: any, blockHash: string, txIndex: number): Promise<void>;
    /**
     * Store a transaction's inputs and outputs
     */
    private storeTransactionInputsAndOutputs;
    /**
     * Store a transaction input
     */
    private storeInput;
    /**
     * Store a transaction output
     */
    storeOutput(txid: string, output: any, vout: number, isCoinbaseOutput?: boolean): Promise<void>;
    /**
     * Store a protostone with its basic properties
     */
    storeProtostone(txid: string, protostone: any): Promise<void>;
    /**
     * Store a block with its transactions and protostones
     */
    storeBlockWithProtostones(block: Block, protostoneTransactions: ProtostoneTransaction[]): Promise<void>;
    /**
     * Add trace event types to a protostone
     * @param txid Transaction ID
     * @param vout Output index
     * @param eventData Full trace data with all details (not just event types)
     */
    addEventTypesToProtostone(txid: string, vout: number, eventData: any[]): Promise<boolean>;
    /**
     * Check if a block exists
     */
    blockExists(height: number): Promise<boolean>;
    /**
     * Get stats about the graph
     * @returns Object with counts of various node types
     */
    getGraphStats(): Promise<{
        blockCount: number;
        txCount: number;
        outputCount: number;
        protostoneCount: number;
        addressCount: number;
        eventCount: number;
        alkaneCount: number;
    }>;
}
