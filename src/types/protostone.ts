export interface ProtostoneTransaction {
  txid: string;
  protostones: Protostone[];
}

export interface Protostone {
  protocolTag: number | Buffer;
  object: Record<string, any>;
  vout: number;
}

export interface ProcessedBlock {
  blockHash: string;
  blockHeight: number;
  timestamp: number;
  transactions: ProtostoneTransaction[];
}
