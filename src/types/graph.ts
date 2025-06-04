import { Transaction, TxInput, TxOutput } from './block';

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
  index: number; // Position in block
  vin: GraphInput[];
  vout: GraphOutput[];
  hex?: string;
}

export interface GraphInput {
  txid?: string; // Previous transaction ID (undefined for coinbase)
  vout?: number; // Output index in previous transaction
  scriptSig?: string; // Script signature hex
  sequence?: number;
  coinbase?: string; // Coinbase data
  index: number; // Input index in transaction
}

export interface GraphOutput {
  value: number;
  scriptPubKey: string; // Script hex
  address?: string; // Bitcoin address if available
  type?: string; // Script type
  index: number; // Output index in transaction
}

/**
 * Converts a Bitcoin RPC Transaction to our GraphTransaction format
 */
export function toGraphTransaction(tx: Transaction, index: number): GraphTransaction {
  return {
    txid: tx.txid,
    hash: tx.hash,
    version: tx.version,
    size: tx.size,
    weight: tx.weight,
    locktime: tx.locktime,
    index,
    vin: tx.vin.map((input, i) => ({
      txid: input.txid,
      vout: input.vout,
      scriptSig: input.scriptSig?.hex,
      sequence: input.sequence,
      coinbase: input.coinbase,
      index: i
    })),
    vout: tx.vout.map((output, i) => ({
      value: output.value,
      scriptPubKey: output.scriptPubKey.hex,
      address: output.scriptPubKey.address || (output.scriptPubKey.addresses ? output.scriptPubKey.addresses[0] : undefined),
      type: output.scriptPubKey.type,
      index: i
    })),
    hex: tx.hex
  };
}

/**
 * Parses a serialized Bitcoin transaction from bitcoinjs-lib
 * and converts it to our GraphTransaction format
 */
export function fromBitcoinJsTransaction(tx: any, index: number): GraphTransaction {
  const txid = tx.getId();
  
  return {
    txid,
    index,
    vin: tx.ins.map((input: any, i: number) => ({
      txid: input.hash ? Buffer.from(input.hash).reverse().toString('hex') : undefined,
      vout: input.index,
      scriptSig: input.script ? input.script.toString('hex') : undefined,
      sequence: input.sequence,
      coinbase: !input.hash ? 'coinbase' : undefined,
      index: i
    })),
    vout: tx.outs.map((output: any, i: number) => ({
      value: output.value,
      scriptPubKey: output.script ? output.script.toString('hex') : '',
      index: i
    }))
  };
}
