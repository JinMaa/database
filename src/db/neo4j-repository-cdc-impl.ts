/**
 * This file contains the implementation of the CDC methods
 * that will be dynamically added to the Neo4jRepository class
 * in our test importer.
 */

import { Neo4jRepository } from './neo4j-repository';
import { CdcMessage, CdcOperation } from '../../debshrew_core/types/cdc';

// Add these methods to the Neo4jRepository class
export function extendRepositoryWithCdc(repository: Neo4jRepository): void {
  // Add the applyCdc method
  (repository as any).applyCdc = async function(message: CdcMessage): Promise<void> {
    const { table, operation } = message.payload;
    
    switch (table) {
      case 'blocks':
        return (this as any).applyBlockCdc(message);
      case 'transactions':
        return (this as any).applyTransactionCdc(message);
      case 'outputs':
        return (this as any).applyOutputCdc(message);
      case 'protostones':
        return (this as any).applyProtostoneCdc(message);
      case 'events':
        return (this as any).applyEventCdc(message);
      case 'alkanes':
        return (this as any).applyAlkaneCdc(message);
      default:
        throw new Error(`Unknown CDC table: ${table}`);
    }
  };
  
  // Add the block CDC method
  (repository as any).applyBlockCdc = async function(message: CdcMessage): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const height = parseInt(key, 10);
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            await tx.run(
              `
              MERGE (b:block {height: $height})
              ON CREATE SET b = $properties
              ON MATCH SET b = $properties
              `,
              {
                height,
                properties: { ...after, height }
              }
            );
            break;
            
          case 'delete':
            await tx.run(
              `
              MATCH (b:block {height: $height})
              DETACH DELETE b
              `,
              { height }
            );
            break;
            
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });
      
      console.log(`✅ Applied ${operation} to block ${height}`);
    } finally {
      await session.close();
    }
  };
  
  // Add the transaction CDC method
  (repository as any).applyTransactionCdc = async function(message: CdcMessage): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const txid = key;
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            await tx.run(
              `
              MERGE (t:transaction {txid: $txid})
              ON CREATE SET t = $properties
              ON MATCH SET t = $properties
              `,
              {
                txid,
                properties: { ...after, txid }
              }
            );
            
            const blockHeight = message.header.block_height;
            if (blockHeight !== undefined) {
              await tx.run(
                `
                MATCH (t:transaction {txid: $txid})
                MATCH (b:block {height: $blockHeight})
                MERGE (b)-[r:CONTAINS]->(t)
                `,
                { txid, blockHeight }
              );
            }
            break;
            
          case 'delete':
            await tx.run(
              `
              MATCH (t:transaction {txid: $txid})
              DETACH DELETE t
              `,
              { txid }
            );
            break;
            
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });
      
      console.log(`✅ Applied ${operation} to transaction ${txid}`);
    } finally {
      await session.close();
    }
  };
  
  // Add the output CDC method
  (repository as any).applyOutputCdc = async function(message: CdcMessage): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const [txid, voutStr] = key.split(':');
    const vout = parseInt(voutStr, 10);
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            await tx.run(
              `
              MERGE (o:output {txid: $txid, vout: $vout})
              ON CREATE SET o = $properties
              ON MATCH SET o = $properties
              `,
              {
                txid,
                vout,
                properties: { ...after, txid, vout }
              }
            );
            
            await tx.run(
              `
              MATCH (o:output {txid: $txid, vout: $vout})
              MATCH (t:transaction {txid: $txid})
              MERGE (t)-[r:HAS_OUTPUT]->(o)
              `,
              { txid, vout }
            );
            
            if (after.addresses && Array.isArray(after.addresses)) {
              for (const address of after.addresses) {
                await tx.run(
                  `
                  MATCH (o:output {txid: $txid, vout: $vout})
                  MERGE (a:address {address: $address})
                  MERGE (o)-[r:SENT_TO]->(a)
                  `,
                  { txid, vout, address }
                );
              }
            }
            break;
            
          case 'delete':
            await tx.run(
              `
              MATCH (o:output {txid: $txid, vout: $vout})
              DETACH DELETE o
              `,
              { txid, vout }
            );
            break;
            
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });
      
      console.log(`✅ Applied ${operation} to output ${txid}:${vout}`);
    } finally {
      await session.close();
    }
  };
  
  // Add the protostone CDC method
  (repository as any).applyProtostoneCdc = async function(message: CdcMessage): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const [txid, voutStr] = key.split(':');
    const vout = parseInt(voutStr, 10);
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            await tx.run(
              `
              MERGE (p:protostone {txid: $txid, vout: $vout})
              ON CREATE SET p = $properties
              ON MATCH SET p = $properties
              `,
              {
                txid,
                vout,
                properties: { ...after, txid, vout }
              }
            );
            
            await tx.run(
              `
              MATCH (p:protostone {txid: $txid, vout: $vout})
              MATCH (t:transaction {txid: $txid})
              MERGE (t)-[r:EMBEDS]->(p)
              `,
              { txid, vout }
            );
            
            await tx.run(
              `
              MATCH (p:protostone {txid: $txid, vout: $vout})
              MATCH (o:output {txid: $txid, vout: $vout})
              MERGE (o)-[r:IS_PROTOSTONE]->(p)
              `,
              { txid, vout }
            );
            break;
            
          case 'delete':
            await tx.run(
              `
              MATCH (p:protostone {txid: $txid, vout: $vout})
              DETACH DELETE p
              `,
              { txid, vout }
            );
            break;
            
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });
      
      console.log(`✅ Applied ${operation} to protostone ${txid}:${vout}`);
    } finally {
      await session.close();
    }
  };
  
  // Add the event CDC method
  (repository as any).applyEventCdc = async function(message: CdcMessage): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const [txid, voutStr, eventName] = key.split(':');
    const vout = parseInt(voutStr, 10);
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            await tx.run(
              `
              MERGE (e:event {txid: $txid, vout: $vout, name: $name})
              ON CREATE SET e = $properties
              ON MATCH SET e = $properties
              `,
              {
                txid,
                vout,
                name: eventName,
                properties: { ...after, txid, vout, name: eventName }
              }
            );
            
            await tx.run(
              `
              MATCH (e:event {txid: $txid, vout: $vout, name: $name})
              MATCH (p:protostone {txid: $txid, vout: $vout})
              MERGE (p)-[r:EMITS]->(e)
              `,
              { txid, vout, name: eventName }
            );
            break;
            
          case 'delete':
            await tx.run(
              `
              MATCH (e:event {txid: $txid, vout: $vout, name: $name})
              DETACH DELETE e
              `,
              { txid, vout, name: eventName }
            );
            break;
            
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });
      
      console.log(`✅ Applied ${operation} to event ${txid}:${vout}:${eventName}`);
    } finally {
      await session.close();
    }
  };
  
  // Add the alkane CDC method
  (repository as any).applyAlkaneCdc = async function(message: CdcMessage): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const [block, tx] = key.split(':');
    
    // Helper function to convert hex to decimal
    function hexToDecimal(hex: string): string {
      if (!hex) return '0';
      const cleanHex = hex.startsWith('0x') ? hex.substring(2) : hex;
      return BigInt('0x' + cleanHex).toString();
    }
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (txn: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            const txDec = after.tx || (after.tx_hex ? hexToDecimal(after.tx_hex) : '0');
            
            await txn.run(
              `
              MERGE (a:alkane {block: $block, tx: $tx})
              ON CREATE SET a = $properties, a.tx_hex = $tx_hex
              ON MATCH SET a = $properties, a.tx_hex = $tx_hex
              `,
              {
                block,
                tx: txDec,
                tx_hex: after.tx_hex || '',
                properties: { ...after, block, tx: txDec }
              }
            );
            break;
            
          case 'delete':
            await txn.run(
              `
              MATCH (a:alkane {block: $block, tx: $tx})
              DETACH DELETE a
              `,
              { block, tx }
            );
            break;
            
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      });
      
      console.log(`✅ Applied ${operation} to alkane ${block}:${tx}`);
    } finally {
      await session.close();
    }
  };
}
