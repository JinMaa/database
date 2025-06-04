import { Block } from '../types/block';
import { Storage } from './storage';
import { ProtostoneTransaction } from '../types/protostone';
/**
 * Storage adapter for Neo4j
 */
export declare class Neo4jStorage implements Storage {
    private protostoneRepository;
    constructor();
    /**
     * Store a block with its protostones in Neo4j
     * @param block Block data
     * @param protostoneTransactions Protostone transactions
     */
    storeBlock(block: Block, protostoneTransactions: ProtostoneTransaction[]): Promise<void>;
    /**
     * Store trace data for protostones
     * @param traceResults Map of transaction ID + vout to trace results
     * @returns Promise<number> Number of traces stored
     */
    storeTraceData(traceResults: Record<string, any>): Promise<number>;
}
export declare const neo4jStorage: Neo4jStorage;
