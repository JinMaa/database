"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.neo4jStorage = exports.Neo4jStorage = void 0;
const protostone_repository_1 = require("../db/protostone-repository");
const logger_1 = require("../utils/logger");
/**
 * Storage adapter for Neo4j
 */
class Neo4jStorage {
    constructor() {
        this.protostoneRepository = new protostone_repository_1.ProtostoneRepository();
    }
    /**
     * Store a block with its protostones in Neo4j
     * @param block Block data
     * @param protostoneTransactions Protostone transactions
     */
    async storeBlock(block, protostoneTransactions) {
        try {
            const blockData = block;
            const protostoneData = { transactions: protostoneTransactions };
            // Skip if no data
            if (!blockData || !protostoneData || protostoneData.transactions.length === 0) {
                logger_1.Logger.info('No data to store in Neo4j');
                return;
            }
            // Create a Neo4j-formatted block object
            const neo4jBlock = {
                hash: blockData.hash,
                height: blockData.height,
                previousblockhash: blockData.previousblockhash,
                merkleroot: blockData.merkleroot,
                time: blockData.time,
                bits: blockData.bits,
                nonce: blockData.nonce,
                size: blockData.size,
                tx: blockData.tx || protostoneData.transactions.map(tx => tx.txid),
                version: blockData.version
            };
            // Explicitly ensure hex data is not included (it's too large for Neo4j)
            // @ts-ignore
            if (neo4jBlock.hex)
                delete neo4jBlock.hex;
            // Add protostones to the block
            if (protostoneData && protostoneData.transactions) {
                const txMap = new Map();
                // First, create a map of all transactions in the block
                if (blockData.tx) {
                    for (const tx of blockData.tx) {
                        if (typeof tx === 'object' && tx.txid) {
                            txMap.set(tx.txid, tx);
                        }
                    }
                }
                // Now, merge protostone data into the corresponding transactions
                for (const protostoneTx of protostoneData.transactions) {
                    const txid = protostoneTx.txid;
                    if (txMap.has(txid)) {
                        const tx = txMap.get(txid);
                        tx.protostones = protostoneTx.protostones;
                    }
                    else {
                        // If the transaction doesn't exist in the block, add it
                        txMap.set(txid, protostoneTx);
                    }
                }
                // Convert the map back to an array
                neo4jBlock.tx = Array.from(txMap.values());
            }
            // Store the block with all its transactions and protostones
            await this.protostoneRepository.storeBlock(neo4jBlock);
            logger_1.Logger.info(`Successfully stored block ${blockData.hash} in Neo4j`);
        }
        catch (error) {
            logger_1.Logger.error('Error storing data in Neo4j:', error);
            throw error;
        }
    }
    /**
     * Store trace data for protostones
     * @param traceResults Map of transaction ID + vout to trace results
     * @returns Promise<number> Number of traces stored
     */
    async storeTraceData(traceResults) {
        if (!traceResults || Object.keys(traceResults).length === 0) {
            logger_1.Logger.warn('No trace results provided to store');
            return 0;
        }
        try {
            // Use repository to store trace data
            const storedCount = await this.protostoneRepository.storeMultipleProtostoneTraces(traceResults);
            return storedCount;
        }
        catch (error) {
            logger_1.Logger.error('Error storing trace data in Neo4j:', error);
            throw error;
        }
    }
}
exports.Neo4jStorage = Neo4jStorage;
exports.neo4jStorage = new Neo4jStorage();
