import { Provider } from '@oyl/sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { Network } from './config';
import { Logger } from '../utils/logger';

// Constants for retry mechanism
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Structure of a trace event in the response
 */
export interface TraceEvent {
  event: string;
  data: any;
}

/**
 * Structure of a trace result returned from the API
 */
export interface TraceResult {
  txid: string;
  status: string;
  message: string;
  result: TraceEvent[];
}

// Define provider configurations for different networks
const PROVIDER_CONFIGS = {
  [Network.MAINNET]: {
    url: 'https://mainnet.sandshrew.io',
    version: 'v4',
    projectId: 'oylcorpbtw',
    networkType: 'mainnet' as 'mainnet',
    network: bitcoin.networks.bitcoin
  },
  [Network.OYLNET]: {
    url: 'https://oylnet.oyl.gg',
    version: 'v2',
    projectId: 'regtest',
    networkType: 'regtest' as 'regtest',
    network: bitcoin.networks.testnet
  }
};

export class TraceApi {
  private provider: any;
  private network: Network;

  constructor(network: Network = Network.MAINNET) {
    this.network = network;
    this.initProvider();
  }

  /**
   * Initialize the OYL SDK Provider for the current network
   */
  private initProvider(): void {
    const config = PROVIDER_CONFIGS[this.network];
    
    try {
      Logger.info(`Initializing Provider for network ${this.network} with URL ${config.url}`);
      this.provider = new Provider(config);
    } catch (error) {
      Logger.error(`Failed to initialize provider for ${this.network}:`, error);
      throw error;
    }
  }

  /**
   * Fetch trace data for a specific transaction with retry mechanism
   * @param txid Transaction ID to fetch trace data for
   * @param vout Output index (the shadow vout for the specific protostone)
   * @param retryCount Current retry attempt (used internally for recursion)
   * @returns Trace data or null if not found after all retries
   */
  public async getTransactionTrace(txid: string, vout: number, retryCount = 0): Promise<TraceResult | null> {
    try {
      Logger.info(`Fetching trace data for txid ${txid} with vout ${vout}${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}`);
      
      if (!this.provider || !this.provider.alkanes) {
        Logger.error('Provider or alkanes client not initialized');
        return null;
      }
      
      // Use the SDK's trace method 
      const traceResult = await this.provider.alkanes.trace({
        txid,
        vout
      });
      
      // Format the response with a consistent structure
      return {
        txid,
        status: "success",
        message: "Trace completed",
        result: traceResult || []
      };
    } catch (error: any) {
      // Check if we should retry
      if (retryCount < MAX_RETRIES) {
        // Calculate delay with exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        
        // Log the error and retry information
        Logger.warn(`Error fetching trace data for txid ${txid}. Retrying in ${delay}ms... (${retryCount + 1}/${MAX_RETRIES})`);
        Logger.warn(`Error details: ${error.message || 'Unknown error'}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reinitialize provider in case of connection issues
        this.initProvider();
        
        // Retry with incremented retry count
        return this.getTransactionTrace(txid, vout, retryCount + 1);
      }
      
      // All retries failed, log the final error
      Logger.error(`Error fetching trace data for txid ${txid} after ${MAX_RETRIES} retries:`, error);
      return null;
    }
  }

  /**
   * Fetch traces for multiple transactions with their corresponding vouts
   * @param txVoutPairs Array of transaction ID and vout pairs to fetch trace data for
   * @returns Object mapping transaction IDs to their trace data
   */
  public async getBlockTraces(txVoutPairs: Array<{txid: string, vout: number}>): Promise<Record<string, TraceResult>> {
    const results: Record<string, TraceResult> = {};
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    Logger.info(`Processing ${txVoutPairs.length} transaction-vout pairs for trace data`);
    Logger.info(`Processing traces in batches of ${batchSize} with 200ms delay between calls`);
    
    for (let i = 0; i < txVoutPairs.length; i += batchSize) {
      const batch = txVoutPairs.slice(i, i + batchSize);
      
      // Process one transaction at a time
      for (const {txid, vout} of batch) {
        // Using the enhanced getTransactionTrace with retry mechanism
        // No need for try/catch here as getTransactionTrace handles retries internally
        const trace = await this.getTransactionTrace(txid, vout);
        if (trace) {
          results[`${txid}:${vout}`] = trace;
          Logger.info(`Successfully retrieved trace data for ${txid}:${vout}`);
        } else {
          Logger.warn(`No trace data retrieved for ${txid}:${vout} after all retry attempts`);
        }
        
        // Small delay between API calls to avoid rate limiting
        if (i + 1 < txVoutPairs.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Log progress after each batch
      Logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(txVoutPairs.length / batchSize)}`);
    }
    
    // Summarize results
    const successCount = Object.keys(results).length;
    Logger.info(`Successfully retrieved ${successCount}/${txVoutPairs.length} trace results (${Math.round(successCount / txVoutPairs.length * 100)}% success rate)`);
    
    return results;
  }

  /**
   * Set the network to use for API calls
   * @param network Network to use
   */
  public setNetwork(network: Network): void {
    if (this.network !== network) {
      this.network = network;
      this.initProvider();
    }
  }

  /**
   * Get the current network being used
   * @returns Current network
   */
  public getNetwork(): Network {
    return this.network;
  }
}
