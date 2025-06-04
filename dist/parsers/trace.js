"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTxVoutPairsFromProtostones = extractTxVoutPairsFromProtostones;
exports.processTracesFromProtostones = processTracesFromProtostones;
const traceApi_1 = require("../api/traceApi");
const logger_1 = require("../utils/logger");
const config_1 = require("../api/config");
/**
 * Process a block to extract transaction-vout pairs from protostones
 * @param protostoneTxs Array of transactions with protostones
 * @returns Array of {txid, vout} pairs for trace API calls
 */
function extractTxVoutPairsFromProtostones(protostoneTxs) {
    const pairs = [];
    for (const tx of protostoneTxs) {
        // For each protostone in the transaction, create a txid-vout pair
        for (const protostone of tx.protostones) {
            if (protostone.vout) {
                pairs.push({
                    txid: tx.txid,
                    vout: protostone.vout
                });
            }
        }
    }
    return pairs;
}
/**
 * Fetch and process trace data for transactions with protostones
 * @param blockHash Block hash
 * @param blockHeight Block height
 * @param timestamp Block timestamp
 * @param protostoneTxs Transactions with protostones
 * @param network Network to use for API calls
 * @returns Processed block with trace data
 */
async function processTracesFromProtostones(blockHash, blockHeight, timestamp, protostoneTxs, network = config_1.Network.MAINNET) {
    logger_1.Logger.info(`Processing traces for ${protostoneTxs.length} protostone transactions in block ${blockHeight}`);
    // Extract txid-vout pairs from transactions with protostones
    const txVoutPairs = extractTxVoutPairsFromProtostones(protostoneTxs);
    if (txVoutPairs.length === 0) {
        logger_1.Logger.info(`No protostones found in block ${blockHeight}, skipping trace processing`);
        return {
            blockHash,
            blockHeight,
            timestamp,
            traces: []
        };
    }
    // Create trace API client
    const traceApi = new traceApi_1.TraceApi(network);
    // Fetch trace data for protostone transactions
    logger_1.Logger.info(`Fetching trace data for ${txVoutPairs.length} protostones in block ${blockHeight}`);
    const traceResults = await traceApi.getBlockTraces(txVoutPairs);
    // Count transactions with trace data
    const traceTxCount = Object.keys(traceResults).length;
    logger_1.Logger.info(`Found ${traceTxCount} protostones with trace data in block ${blockHeight}`);
    // Format the trace data
    const traces = [];
    for (const [key, traceData] of Object.entries(traceResults)) {
        // Key format is "txid:vout"
        const [txid, voutStr] = key.split(':');
        const vout = parseInt(voutStr, 10);
        traces.push({
            txid,
            vout,
            traces: traceData
        });
    }
    return {
        blockHash,
        blockHeight,
        timestamp,
        traces
    };
}
