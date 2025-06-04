"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toGraphTransaction = toGraphTransaction;
exports.fromBitcoinJsTransaction = fromBitcoinJsTransaction;
/**
 * Converts a Bitcoin RPC Transaction to our GraphTransaction format
 */
function toGraphTransaction(tx, index) {
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
function fromBitcoinJsTransaction(tx, index) {
    const txid = tx.getId();
    return {
        txid,
        index,
        vin: tx.ins.map((input, i) => ({
            txid: input.hash ? Buffer.from(input.hash).reverse().toString('hex') : undefined,
            vout: input.index,
            scriptSig: input.script ? input.script.toString('hex') : undefined,
            sequence: input.sequence,
            coinbase: !input.hash ? 'coinbase' : undefined,
            index: i
        })),
        vout: tx.outs.map((output, i) => ({
            value: output.value,
            scriptPubKey: output.script ? output.script.toString('hex') : '',
            index: i
        }))
    };
}
