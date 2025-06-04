"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryParseProtostonesFromTransaction = tryParseProtostonesFromTransaction;
exports.parseProtostonesFromBlock = parseProtostonesFromBlock;
exports.processBlock = processBlock;
exports.getBlockTimestamp = getBlockTimestamp;
const block_1 = require("alkanes/lib/block");
/**
 * Parse protostone data from transaction
 * @param tx BitcoinJS transaction object
 * @returns Array of protostone objects
 */
function tryParseProtostonesFromTransaction(tx) {
    // Use the actual implementation from alkanes
    return (0, block_1.tryParseProtostonesFromTransaction)(tx);
}
/**
 * Parse protostones from a block hex string
 * @param blockHex Block hex string
 * @returns Array of transactions containing protostones
 */
function parseProtostonesFromBlock(blockHex) {
    // Use the actual implementation from alkanes
    return (0, block_1.parseProtostonesFromBlock)(blockHex);
}
/**
 * Process a block and extract protostone data
 * @param blockHex Block hex data
 * @param blockHash Block hash
 * @param blockHeight Block height
 * @param timestamp Block timestamp
 * @returns Processed block with protostone data
 */
function processBlock(blockHex, blockHash, blockHeight, timestamp) {
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
function getBlockTimestamp(blockData) {
    return blockData.time || Math.floor(Date.now() / 1000);
}
