import { Block } from 'bitcoinjs-lib';
import { parseProtostonesFromBlock as alkaneParseProtostones, tryParseProtostonesFromTransaction as alkaneTryParseProtostones } from 'alkanes/lib/block';
import { ProtostoneTransaction, Protostone, ProcessedBlock } from '../types/protostone';

/**
 * Parse protostone data from transaction
 * @param tx BitcoinJS transaction object
 * @returns Array of protostone objects
 */
export function tryParseProtostonesFromTransaction(tx: any): (Protostone | null)[] {
  // Use the actual implementation from alkanes
  return alkaneTryParseProtostones(tx);
}

/**
 * Parse protostones from a block hex string
 * @param blockHex Block hex string
 * @returns Array of transactions containing protostones
 */
export function parseProtostonesFromBlock(blockHex: string): ProtostoneTransaction[] {
  // Use the actual implementation from alkanes
  return alkaneParseProtostones(blockHex);
}

/**
 * Process a block and extract protostone data
 * @param blockHex Block hex data
 * @param blockHash Block hash
 * @param blockHeight Block height
 * @param timestamp Block timestamp
 * @returns Processed block with protostone data
 */
export function processBlock(
  blockHex: string,
  blockHash: string,
  blockHeight: number,
  timestamp: number
): ProcessedBlock {
  const transactions = parseProtostonesFromBlock(blockHex);
  
  return {
    blockHash,
    blockHeight,
    timestamp,
    transactions
  };
}

/**
 * Extract timestamp from block data
 * @param blockData Block data
 * @returns Timestamp in seconds
 */
export function getBlockTimestamp(blockData: any): number {
  return blockData.time || Math.floor(Date.now() / 1000);
}
