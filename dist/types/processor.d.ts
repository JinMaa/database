/**
 * Types for the block processor
 */
export interface ProcessedBlockData {
    blockData: {
        height: number;
        hash: string;
        prevBlockHash?: string;
        merkleRoot?: string;
        timestamp: number;
        bits?: string;
        nonce?: number;
        size?: number;
        version?: number;
        transactions?: any[];
    };
    protostoneData: {
        transactions: Array<{
            txid: string;
            protostones: any[];
        }>;
    };
}
