import { Block } from '../types/block';
import { ProtostoneTransaction } from '../types/protostone';
/**
 * Base Storage interface for storing blockchain data
 */
export interface Storage {
    /**
     * Store a block with its protostones in the storage
     * @param block Block data to store
     * @param protostoneTransactions Protostone transactions in the block
     */
    storeBlock(block: Block, protostoneTransactions: ProtostoneTransaction[]): Promise<void>;
    /**
     * Store trace data for protostones
     * @param traceResults Map of transaction ID + vout to trace results
     * @returns Number of trace events stored
     */
    storeTraceData(traceResults: Record<string, any>): Promise<number>;
}
