/**
 * neo4j-repository-cdc.ts
 * 
 * Extensions to the Neo4jRepository class for CDC message application.
 * This file will be imported into the main neo4j-repository.ts.
 */

import { Session } from 'neo4j-driver';
import { CdcMessage, CdcOperation, BlockPayload, TransactionPayload, OutputPayload, ProtostonePayload, EventPayload, AlkanePayload } from '../../debshrew_core/types/cdc';
import { Neo4jRepository } from './neo4j-repository';

/**
 * These methods will be added to the Neo4jRepository class to handle CDC messages.
 * 
 * Usage:
 * 1. Copy these methods into the Neo4jRepository class
 * 2. Add the imports at the top of neo4j-repository.ts
 * 3. Add the applyCdc method to the public interface
 */

export const CDC_METHODS = {
  /**
   * Apply a CDC message to the Neo4j database
   * @param message The CDC message to apply
   */
  async applyCdc(this: Neo4jRepository, message: CdcMessage): Promise<void> {
    const { table, operation } = message.payload;
    
    switch (table) {
      case 'blocks':
        return this.applyBlockCdc(message as CdcMessage<BlockPayload>);
      case 'transactions':
        return this.applyTransactionCdc(message as CdcMessage<TransactionPayload>);
      case 'outputs':
        return this.applyOutputCdc(message as CdcMessage<OutputPayload>);
      case 'protostones':
        return this.applyProtostoneCdc(message as CdcMessage<ProtostonePayload>);
      case 'events':
        return this.applyEventCdc(message as CdcMessage<EventPayload>);
      case 'alkanes':
        return this.applyAlkaneCdc(message as CdcMessage<AlkanePayload>);
      default:
        throw new Error(`Unknown CDC table: ${table}`);
    }
  },

  /**
   * Apply a Block CDC message
   * @param message The Block CDC message to apply
   */
  async applyBlockCdc(this: Neo4jRepository, message: CdcMessage<BlockPayload>): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const height = parseInt(key, 10);
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            // Use MERGE to handle both create and update
            await tx.run(
              `
              MERGE (b:block {height: $height})
              ON CREATE SET b = $properties
              ON MATCH SET b = $properties
              `,
              {
                height,
                properties: { ...after, height } // Ensure height is included
              }
            );
            break;
            
          case 'delete':
            // Delete block and all connected nodes (cascade)
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
    } finally {
      await session.close();
    }
  },

  /**
   * Apply a Transaction CDC message
   * @param message The Transaction CDC message to apply
   */
  async applyTransactionCdc(this: Neo4jRepository, message: CdcMessage<TransactionPayload>): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const txid = key; // The key is the txid
    
    const session = this.neo4jService.getSession();
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            // Handle transaction
            await tx.run(
              `
              MERGE (t:transaction {txid: $txid})
              ON CREATE SET t = $properties
              ON MATCH SET t = $properties
              `,
              {
                txid,
                properties: { ...after, txid } // Ensure txid is included
              }
            );
            
            // Handle block relationship if block_height is present
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
            // Delete transaction and all connected nodes
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
    } finally {
      await session.close();
    }
  },

  /**
   * Apply an Output CDC message
   * @param message The Output CDC message to apply
   */
  async applyOutputCdc(this: Neo4jRepository, message: CdcMessage<OutputPayload>): Promise<void> {
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
            
            // Handle output
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
            
            // Handle transaction relationship
            await tx.run(
              `
              MATCH (o:output {txid: $txid, vout: $vout})
              MATCH (t:transaction {txid: $txid})
              MERGE (t)-[r:HAS_OUTPUT]->(o)
              `,
              { txid, vout }
            );
            
            // Handle address relationships if present
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
            // Delete output and its relationships
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
    } finally {
      await session.close();
    }
  },

  /**
   * Apply a Protostone CDC message
   * @param message The Protostone CDC message to apply
   */
  async applyProtostoneCdc(this: Neo4jRepository, message: CdcMessage<ProtostonePayload>): Promise<void> {
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
            
            // Handle protostone
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
            
            // Handle transaction relationship
            await tx.run(
              `
              MATCH (p:protostone {txid: $txid, vout: $vout})
              MATCH (t:transaction {txid: $txid})
              MERGE (t)-[r:EMBEDS]->(p)
              `,
              { txid, vout }
            );
            
            // Handle output relationship
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
            // Delete protostone and its relationships
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
    } finally {
      await session.close();
    }
  },

  /**
   * Apply an Event CDC message
   * @param message The Event CDC message to apply
   */
  async applyEventCdc(this: Neo4jRepository, message: CdcMessage<EventPayload>): Promise<void> {
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
            
            // Handle event
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
            
            // Handle protostone relationship
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
            // Delete event and its relationships
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
    } finally {
      await session.close();
    }
  },

  /**
   * Apply an Alkane CDC message
   * @param message The Alkane CDC message to apply
   */
  async applyAlkaneCdc(this: Neo4jRepository, message: CdcMessage<AlkanePayload>): Promise<void> {
    const { operation, key, before, after } = message.payload;
    const [block, tx] = key.split(':');
    
    const session = this.neo4jService.getSession();
    
    // Helper function to convert hex to decimal
    function hexToDecimal(hex: string): string {
      if (!hex) return '0';
      const cleanHex = hex.startsWith('0x') ? hex.substring(2) : hex;
      return BigInt('0x' + cleanHex).toString();
    }
    
    try {
      await session.writeTransaction(async (tx: any) => {
        switch (operation) {
          case 'create':
          case 'update':
            if (!after) throw new Error(`Invalid ${operation} message: missing 'after' state`);
            
            // Handle alkane
            const txDec = after.tx || (after.tx_hex ? hexToDecimal(after.tx_hex) : '0');
            
            await tx.run(
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
            // Delete alkane and its relationships
            await tx.run(
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
    } finally {
      await session.close();
    }
  }
};
