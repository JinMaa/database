import { Network } from './config';
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
export declare class TraceApi {
    private provider;
    private network;
    constructor(network?: Network);
    /**
     * Initialize the OYL SDK Provider for the current network
     */
    private initProvider;
    /**
     * Fetch trace data for a specific transaction
     * @param txid Transaction ID to fetch trace data for
     * @param vout Output index (the shadow vout for the specific protostone)
     * @returns Trace data or null if not found
     */
    getTransactionTrace(txid: string, vout: number): Promise<TraceResult | null>;
    /**
     * Fetch traces for multiple transactions with their corresponding vouts
     * @param txVoutPairs Array of transaction ID and vout pairs to fetch trace data for
     * @returns Object mapping transaction IDs to their trace data
     */
    getBlockTraces(txVoutPairs: Array<{
        txid: string;
        vout: number;
    }>): Promise<Record<string, TraceResult>>;
    /**
     * Set the network to use for API calls
     * @param network Network to use
     */
    setNetwork(network: Network): void;
    /**
     * Get the current network being used
     * @returns Current network
     */
    getNetwork(): Network;
}
