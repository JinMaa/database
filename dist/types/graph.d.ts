import { Transaction } from './block';
/**
 * Extended types for graph database modeling
 */
export interface GraphBlock {
    hash: string;
    height: number;
    prevBlockHash: string;
    merkleRoot: string;
    timestamp: number;
    bits: string;
    nonce: number;
    size: number;
    txCount: number;
    version: number;
    transactions?: GraphTransaction[];
    rawHex?: string;
}
export interface GraphTransaction {
    txid: string;
    hash?: string;
    version?: number;
    size?: number;
    weight?: number;
    locktime?: number;
    index: number;
    vin: GraphInput[];
    vout: GraphOutput[];
    hex?: string;
}
export interface GraphInput {
    txid?: string;
    vout?: number;
    scriptSig?: string;
    sequence?: number;
    coinbase?: string;
    index: number;
}
export interface GraphOutput {
    value: number;
    scriptPubKey: string;
    address?: string;
    type?: string;
    index: number;
}
/**
 * Converts a Bitcoin RPC Transaction to our GraphTransaction format
 */
export declare function toGraphTransaction(tx: Transaction, index: number): GraphTransaction;
/**
 * Parses a serialized Bitcoin transaction from bitcoinjs-lib
 * and converts it to our GraphTransaction format
 */
export declare function fromBitcoinJsTransaction(tx: any, index: number): GraphTransaction;
