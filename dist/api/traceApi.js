"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceApi = void 0;
const sdk_1 = require("@oyl/sdk");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const config_1 = require("./config");
const logger_1 = require("../utils/logger");
// Define provider configurations for different networks
const PROVIDER_CONFIGS = {
    [config_1.Network.MAINNET]: {
        url: 'https://mainnet.sandshrew.io',
        version: 'v2',
        projectId: 'lasereyes',
        networkType: 'mainnet',
        network: bitcoin.networks.bitcoin
    },
    [config_1.Network.OYLNET]: {
        url: 'https://oylnet.oyl.gg',
        version: 'v2',
        projectId: 'regtest',
        networkType: 'regtest',
        network: bitcoin.networks.testnet
    }
};
class TraceApi {
    constructor(network = config_1.Network.MAINNET) {
        this.network = network;
        this.initProvider();
    }
    /**
     * Initialize the OYL SDK Provider for the current network
     */
    initProvider() {
        const config = PROVIDER_CONFIGS[this.network];
        try {
            logger_1.Logger.info(`Initializing Provider for network ${this.network} with URL ${config.url}`);
            this.provider = new sdk_1.Provider(config);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to initialize provider for ${this.network}:`, error);
            throw error;
        }
    }
    /**
     * Fetch trace data for a specific transaction
     * @param txid Transaction ID to fetch trace data for
     * @param vout Output index (the shadow vout for the specific protostone)
     * @returns Trace data or null if not found
     */
    async getTransactionTrace(txid, vout) {
        try {
            logger_1.Logger.info(`Fetching trace data for txid ${txid} with vout ${vout}`);
            if (!this.provider || !this.provider.alkanes) {
                logger_1.Logger.error('Provider or alkanes client not initialized');
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
        }
        catch (error) {
            logger_1.Logger.error(`Error fetching trace data for txid ${txid}:`, error);
            return null;
        }
    }
    /**
     * Fetch traces for multiple transactions with their corresponding vouts
     * @param txVoutPairs Array of transaction ID and vout pairs to fetch trace data for
     * @returns Object mapping transaction IDs to their trace data
     */
    async getBlockTraces(txVoutPairs) {
        const results = {};
        // Process in batches to avoid overwhelming the API
        const batchSize = 10;
        logger_1.Logger.info(`Processing ${txVoutPairs.length} transaction-vout pairs for trace data`);
        logger_1.Logger.info(`Processing traces in batches of ${batchSize} with 200ms delay between calls`);
        for (let i = 0; i < txVoutPairs.length; i += batchSize) {
            const batch = txVoutPairs.slice(i, i + batchSize);
            // Process one transaction at a time
            for (const { txid, vout } of batch) {
                try {
                    const trace = await this.getTransactionTrace(txid, vout);
                    if (trace) {
                        results[`${txid}:${vout}`] = trace;
                    }
                }
                catch (error) {
                    logger_1.Logger.error(`Error fetching trace for txid ${txid} vout ${vout}:`, error);
                }
                // Small delay between API calls
                if (i + 1 < txVoutPairs.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }
        return results;
    }
    /**
     * Set the network to use for API calls
     * @param network Network to use
     */
    setNetwork(network) {
        if (this.network !== network) {
            this.network = network;
            this.initProvider();
        }
    }
    /**
     * Get the current network being used
     * @returns Current network
     */
    getNetwork() {
        return this.network;
    }
}
exports.TraceApi = TraceApi;
