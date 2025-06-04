import { TraceResult } from '../api/traceApi';
import { Network } from '../api/config';
import { ProtostoneTransaction } from '../types/protostone';
export interface TraceData {
    txid: string;
    vout: number;
    traces: TraceResult;
}
export interface ProcessedTraceBlock {
    blockHash: string;
    blockHeight: number;
    timestamp: number;
    traces: TraceData[];
}
/**
 * Process a block to extract transaction-vout pairs from protostones
 * @param protostoneTxs Array of transactions with protostones
 * @returns Array of {txid, vout} pairs for trace API calls
 */
export declare function extractTxVoutPairsFromProtostones(protostoneTxs: ProtostoneTransaction[]): Array<{
    txid: string;
    vout: number;
}>;
/**
 * Fetch and process trace data for transactions with protostones
 * @param blockHash Block hash
 * @param blockHeight Block height
 * @param timestamp Block timestamp
 * @param protostoneTxs Transactions with protostones
 * @param network Network to use for API calls
 * @returns Processed block with trace data
 */
export declare function processTracesFromProtostones(blockHash: string, blockHeight: number, timestamp: number, protostoneTxs: ProtostoneTransaction[], network?: Network): Promise<ProcessedTraceBlock>;
