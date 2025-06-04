"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockApi = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
/**
 * API client for interacting with Bitcoin RPC endpoints
 */
class BlockApi {
    constructor(network = config_1.Network.MAINNET) {
        if (typeof network === 'string') {
            // Handle string network names
            if (network.toLowerCase() === 'oylnet') {
                this.apiConfig = new config_1.ApiConfig(config_1.Network.OYLNET);
            }
            else if (network.toLowerCase() === 'mainnet') {
                this.apiConfig = new config_1.ApiConfig(config_1.Network.MAINNET);
            }
            else {
                // Default to OYLNET for our use case
                console.warn(`Unknown network "${network}", defaulting to OYLNET`);
                this.apiConfig = new config_1.ApiConfig(config_1.Network.OYLNET);
            }
        }
        else {
            this.apiConfig = new config_1.ApiConfig(network);
        }
    }
    /**
     * Make an RPC call to the Oylnet API following the correct JSON-RPC format
     * Field order matters: method, params, id, jsonrpc
     */
    async callRpc(method, params = []) {
        try {
            const response = await axios_1.default.post(this.apiConfig.rpcUrl, {
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
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response) {
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
    async getBlockCount() {
        const result = await this.callRpc('btc_getblockcount');
        return typeof result === 'string' ? parseInt(result, 10) : result;
    }
    /**
     * Get block hash by height
     */
    async getBlockHash(height) {
        return await this.callRpc('btc_getblockhash', [height]);
    }
    /**
     * Get block hash by height (alias for backward compatibility)
     */
    async getBlockHashByHeight(height) {
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
    async getBlockByHash(hash, verbosity = 1) {
        return await this.callRpc('btc_getblock', [hash, verbosity]);
    }
    /**
     * Get raw block hex
     */
    async getBlockHex(hash) {
        const result = await this.callRpc('btc_getblock', [hash, 0]);
        if (typeof result !== 'string') {
            throw new Error('Expected block hex string, received object');
        }
        return result;
    }
    /**
     * Get raw block hex (alias for backward compatibility)
     */
    async getBlockHexByHash(hash) {
        return this.getBlockHex(hash);
    }
    /**
     * Get a block by height or hash
     */
    async getBlock(hashOrHeight, verbosity = 1) {
        let hash;
        // If height is provided, get the hash first
        if (typeof hashOrHeight === 'number') {
            hash = await this.getBlockHash(hashOrHeight);
        }
        else {
            hash = hashOrHeight;
        }
        return this.getBlockByHash(hash, verbosity);
    }
    /**
     * Get transactions for a block
     */
    async getBlockTransactions(hash) {
        const block = await this.getBlockByHash(hash, 2);
        return block.tx;
    }
    /**
     * Set the network to use for API calls
     */
    setNetwork(network) {
        this.apiConfig.setNetwork(network);
    }
    /**
     * Get the current network being used
     */
    getNetwork() {
        return this.apiConfig.getNetwork();
    }
}
exports.BlockApi = BlockApi;
