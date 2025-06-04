import { Block, Transaction } from '../types/block';
import { TraceApi, TraceResult } from '../api/traceApi';
import { Logger } from '../utils/logger';
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
export function extractTxVoutPairsFromProtostones(protostoneTxs: ProtostoneTransaction[]): Array<{txid: string, vout: number}> {
  const pairs: Array<{txid: string, vout: number}> = [];
  
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
export async function processTracesFromProtostones(
  blockHash: string,
  blockHeight: number,
  timestamp: number,
  protostoneTxs: ProtostoneTransaction[],
  network: Network = Network.MAINNET
): Promise<ProcessedTraceBlock> {
  Logger.info(`Processing traces for ${protostoneTxs.length} protostone transactions in block ${blockHeight}`);
  
  // Extract txid-vout pairs from transactions with protostones
  const txVoutPairs = extractTxVoutPairsFromProtostones(protostoneTxs);
  
  if (txVoutPairs.length === 0) {
    Logger.info(`No protostones found in block ${blockHeight}, skipping trace processing`);
    return {
      blockHash,
      blockHeight,
      timestamp,
      traces: []
    };
  }
  
  // Create trace API client
  const traceApi = new TraceApi(network);
  
  // Fetch trace data for protostone transactions
  Logger.info(`Fetching trace data for ${txVoutPairs.length} protostones in block ${blockHeight}`);
  const traceResults = await traceApi.getBlockTraces(txVoutPairs);
  
  // Count transactions with trace data
  const traceTxCount = Object.keys(traceResults).length;
  Logger.info(`Found ${traceTxCount} protostones with trace data in block ${blockHeight}`);
  
  // Format the trace data
  const traces: TraceData[] = [];
  
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
