import { Block } from '../types/block';
import { Network } from './config';
/**
 * API client for interacting with Bitcoin RPC endpoints
 */
export declare class BlockApi {
    private apiConfig;
    constructor(network?: Network | string);
    /**
     * Make an RPC call to the Oylnet API following the correct JSON-RPC format
     * Field order matters: method, params, id, jsonrpc
     */
    private callRpc;
    /**
     * Get the current block count (height)
     */
    getBlockCount(): Promise<number>;
    /**
     * Get block hash by height
     */
    getBlockHash(height: number): Promise<string>;
    /**
     * Get block hash by height (alias for backward compatibility)
     */
    getBlockHashByHeight(height: number): Promise<string>;
    /**
     * Get block data by hash with specified verbosity
     *
     * @param hash Block hash
     * @param verbosity Verbosity level
     *        0: raw hex string
     *        1: decoded block data
     *        2: decoded with full transaction data
     */
    getBlockByHash(hash: string, verbosity?: number): Promise<Block | string>;
    /**
     * Get raw block hex
     */
    getBlockHex(hash: string): Promise<string>;
    /**
     * Get raw block hex (alias for backward compatibility)
     */
    getBlockHexByHash(hash: string): Promise<string>;
    /**
     * Get a block by height or hash
     */
    getBlock(hashOrHeight: string | number, verbosity?: number): Promise<Block | string>;
    /**
     * Get transactions for a block
     */
    getBlockTransactions(hash: string): Promise<any[]>;
    /**
     * Set the network to use for API calls
     */
    setNetwork(network: Network): void;
    /**
     * Get the current network being used
     */
    getNetwork(): Network;
}
