import axios from 'axios';
import { Block } from '../types/block';
import { ApiConfig, Network } from './config';

/**
 * API client for interacting with Bitcoin RPC endpoints
 */
export class BlockApi {
  private apiConfig: ApiConfig;
  
  constructor(network: Network | string = Network.MAINNET) {
    if (typeof network === 'string') {
      // Handle string network names
      if (network.toLowerCase() === 'oylnet') {
        this.apiConfig = new ApiConfig(Network.OYLNET);
      } else if (network.toLowerCase() === 'mainnet') {
        this.apiConfig = new ApiConfig(Network.MAINNET);
      } else {
        // Default to OYLNET for our use case
        console.warn(`Unknown network "${network}", defaulting to OYLNET`);
        this.apiConfig = new ApiConfig(Network.OYLNET);
      }
    } else {
      this.apiConfig = new ApiConfig(network);
    }
  }

  /**
   * Make an RPC call to the Oylnet API following the correct JSON-RPC format
   * Field order matters: method, params, id, jsonrpc
   */
  private async callRpc(method: string, params: any[] = []): Promise<any> {
    try {
      const response = await axios.post(this.apiConfig.rpcUrl, {
        method,
        params,
        id: 0,
        jsonrpc: '2.0'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${JSON.stringify(response.data.error)}`);
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        const statusText = error.response.statusText;
        throw new Error(`API Error (${statusCode} ${statusText}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the current block count (height)
   */
  async getBlockCount(): Promise<number> {
    const result = await this.callRpc('btc_getblockcount');
    return typeof result === 'string' ? parseInt(result, 10) : result;
  }

  /**
   * Get block hash by height
   */
  async getBlockHash(height: number): Promise<string> {
    return await this.callRpc('btc_getblockhash', [height]);
  }

  /**
   * Get block hash by height (alias for backward compatibility)
   */
  async getBlockHashByHeight(height: number): Promise<string> {
    return this.getBlockHash(height);
  }

  /**
   * Get block data by hash with specified verbosity
   * 
   * @param hash Block hash
   * @param verbosity Verbosity level 
   *        0: raw hex string
   *        1: decoded block data
   *        2: decoded with full transaction data
   */
  async getBlockByHash(hash: string, verbosity: number = 1): Promise<Block | string> {
    return await this.callRpc('btc_getblock', [hash, verbosity]);
  }

  /**
   * Get raw block hex
   */
  async getBlockHex(hash: string): Promise<string> {
    const result = await this.callRpc('btc_getblock', [hash, 0]);
    if (typeof result !== 'string') {
      throw new Error('Expected block hex string, received object');
    }
    return result;
  }

  /**
   * Get raw block hex (alias for backward compatibility)
   */
  async getBlockHexByHash(hash: string): Promise<string> {
    return this.getBlockHex(hash);
  }

  /**
   * Get a block by height or hash
   */
  async getBlock(hashOrHeight: string | number, verbosity: number = 1): Promise<Block | string> {
    let hash: string;
    
    // If height is provided, get the hash first
    if (typeof hashOrHeight === 'number') {
      hash = await this.getBlockHash(hashOrHeight);
    } else {
      hash = hashOrHeight;
    }
    
    return this.getBlockByHash(hash, verbosity);
  }

  /**
   * Get transactions for a block
   */
  async getBlockTransactions(hash: string): Promise<any[]> {
    const block = await this.getBlockByHash(hash, 2) as Block;
    return block.tx;
  }

  /**
   * Set the network to use for API calls
   */
  setNetwork(network: Network): void {
    this.apiConfig.setNetwork(network);
  }

  /**
   * Get the current network being used
   */
  getNetwork(): Network {
    return this.apiConfig.getNetwork();
  }
}
