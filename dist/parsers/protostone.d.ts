import { ProtostoneTransaction, Protostone, ProcessedBlock } from '../types/protostone';
/**
 * Parse protostone data from transaction
 * @param tx BitcoinJS transaction object
 * @returns Array of protostone objects
 */
export declare function tryParseProtostonesFromTransaction(tx: any): (Protostone | null)[];
/**
 * Parse protostones from a block hex string
 * @param blockHex Block hex string
 * @returns Array of transactions containing protostones
 */
export declare function parseProtostonesFromBlock(blockHex: string): ProtostoneTransaction[];
/**
 * Process a block and extract protostone data
 * @param blockHex Block hex data
 * @param blockHash Block hash
 * @param blockHeight Block height
 * @param timestamp Block timestamp
 * @returns Processed block with protostone data
 */
export declare function processBlock(blockHex: string, blockHash: string, blockHeight: number, timestamp: number): ProcessedBlock;
/**
 * Extract timestamp from block data
 * @param blockData Block data
 * @returns Timestamp in seconds
 */
export declare function getBlockTimestamp(blockData: any): number;
