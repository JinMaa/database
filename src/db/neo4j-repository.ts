import { Neo4jService } from './neo4j-service';
import { Block } from '../types/block';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { ProtostoneTransaction } from '../types/protostone';

// Local interface replacing the external CdcMessage type
interface CdcMessage {
  type: string;
  payload: any;
  // Add other properties as needed
}

/**
 * Helper function to remove '0x' prefix from hex strings
 */
function removeHexPrefix(hex: string): string {
  return hex && hex.startsWith('0x') ? hex.substring(2) : hex;
}

/**
 * Helper function to convert hex string to decimal string
 * This handles both with and without '0x' prefix
 */
function hexToDecimal(hex: string): string {
  if (!hex) return '0';
  const cleanHex = removeHexPrefix(hex);
  // Convert hex to decimal
  try {
    return BigInt('0x' + cleanHex).toString();
  } catch (e) {
    Logger.warn(`Failed to convert hex to decimal: ${hex}`);
    return '0';
  }
}

/**
 * Helper function to convert hex string to a readable ASCII string
 * This handles both with and without '0x' prefix
 */
function hexToString(hex: string): string {
  if (!hex) return '';
  const cleanHex = removeHexPrefix(hex);
  
  try {
    // Convert each pair of hex digits to a character code and then to a character
    let result = '';
    for (let i = 0; i < cleanHex.length; i += 2) {
      const charCode = parseInt(cleanHex.substr(i, 2), 16);
      // Only include printable ASCII characters
      if (charCode >= 32 && charCode <= 126) {
        result += String.fromCharCode(charCode);
      }
    }
    return result;
  } catch (e) {
    Logger.warn(`Failed to convert hex to string: ${hex}`);
    return '';
  }
}

/**
 * Lightweight Neo4j repository for storing block, transaction, and protostone data
 * with careful handling of property types to avoid Neo4j type errors
 */
export class Neo4jRepository {
  protected neo4jService: Neo4jService;

  constructor() {
    this.neo4jService = Neo4jService.getInstance();
  }

  /**
   * Set up database constraints and indexes
   */
  async setupDatabase(): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (b:block) REQUIRE b.hash IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (t:tx) REQUIRE t.txid IS UNIQUE`);
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (o:output) REQUIRE o.index IS UNIQUE`);
      await session.run(`CREATE INDEX IF NOT EXISTS FOR (b:block) ON (b.height)`);
      await session.run(`CREATE INDEX IF NOT EXISTS FOR (a:address) ON (a.address)`);
      await session.run(`CREATE INDEX IF NOT EXISTS FOR (p:protostone) ON (p.id)`);
      Logger.info('Neo4j database schema setup complete');
    } catch (error) {
      Logger.error('Error setting up database schema:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Clear all data from Neo4j
   */
  async clearAllData(): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      await session.run('MATCH ()-[r]-() DELETE r');
      await session.run('MATCH (n) DELETE n');
      Logger.info('All data cleared from Neo4j');
    } finally {
      await session.close();
    }
  }

  /**
   * Store a block without its transactions (minimal block data)
   */
  async storeBlockMinimal(block: Block): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      // Prepare safe block data (no hex or other large properties)
      const blockData = {
        hash: block.hash,
        height: block.height,
        prevblock: block.previousblockhash || '', // Use empty string if no previous block hash
        merkleroot: block.merkleroot,
        time: block.time,
        bits: block.bits,
        nonce: block.nonce,
        size: block.size,
        txcount: block.tx?.length || 0,
        version: block.version
      };

      // Check if this is the genesis block
      const isGenesisBlock = blockData.height === 0 || !blockData.prevblock;
      
      if (isGenesisBlock) {
        // Special handling for genesis block - no previous block relationship
        await session.run(`
          MERGE (block:block {hash: $hash})
          SET
            block.height = $height,
            block.size = $size,
            block.txcount = $txcount,
            block.version = $version,
            block.prevblock = $prevblock,
            block.merkleroot = $merkleroot,
            block.time = $time,
            block.bits = $bits,
            block.nonce = $nonce,
            block.height = 0
          
          // Create a coinbase output for the genesis block
          MERGE (block)-[:coinbase]->(:output:coinbase)
          
          RETURN block
        `, blockData);
        
        Logger.info(`Stored genesis block ${blockData.hash} at height 0`);
      } else {
        // Standard block with chain relationship
        await session.run(`
          MERGE (block:block {hash: $hash})
          SET
            block.height = $height,
            block.size = $size,
            block.txcount = $txcount,
            block.version = $version,
            block.prevblock = $prevblock,
            block.merkleroot = $merkleroot,
            block.time = $time,
            block.bits = $bits,
            block.nonce = $nonce
          
          WITH block
          MATCH (prevblock:block {hash: $prevblock})
          MERGE (block)-[:chain]->(prevblock)
          
          // Set height as prev block's height + 1
          SET block.height = coalesce(prevblock.height, -1) + 1
          
          RETURN block
        `, blockData);
        
        Logger.info(`Stored block ${blockData.hash} at height ${blockData.height}`);
      }
    } catch (error) {
      Logger.error(`Error storing block ${block.hash}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Store a transaction with its inputs and outputs
   */
  async storeTransaction(tx: any, blockHash: string, txIndex: number): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      // Extract minimal transaction properties
      const txData = {
        txid: tx.txid,
        hash: tx.hash,
        version: tx.version,
        size: tx.size,
        weight: tx.weight,
        locktime: tx.locktime,
        blockHash: blockHash,
        txIndex: txIndex
      };

      // Create transaction and link to block
      await session.run(`
        MATCH (block:block {hash: $blockHash})
        MERGE (tx:tx {txid: $txid})
        MERGE (tx)-[:inc {i: $txIndex}]->(block)
        SET 
          tx.hash = $hash,
          tx.version = $version,
          tx.size = $size,
          tx.weight = $weight,
          tx.locktime = $locktime
        RETURN tx.txid
      `, txData);
      
      // Handle inputs and outputs
      await this.storeTransactionInputsAndOutputs(tx);
      
      Logger.info(`Stored transaction ${txData.txid} in block ${blockHash}`);
    } catch (error) {
      Logger.error(`Error storing transaction ${tx.txid}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Store a transaction's inputs and outputs
   */
  private async storeTransactionInputsAndOutputs(tx: any): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      // Check if this is a coinbase transaction
      const isCoinbase = tx.vin && tx.vin.length > 0 && (tx.vin[0].coinbase || !tx.vin[0].txid);
      
      // Process inputs (skip for coinbase transactions)
      if (tx.vin && tx.vin.length > 0) {
        for (let vin = 0; vin < tx.vin.length; vin++) {
          const input = tx.vin[vin];
          
          // Skip coinbase inputs
          if (input.coinbase || !input.txid) {
            // Create a special coinbase node and relationship for this transaction
            if (vin === 0) {
              await session.run(`
                MATCH (tx:tx {txid: $txid})
                CREATE (coinbase:output:coinbase {
                  index: $uniqueIndex,
                  coinbase_script: $coinbaseScript
                })
                CREATE (coinbase)-[:in {vin: 0}]->(tx)
              `, {
                txid: tx.txid,
                uniqueIndex: `${tx.txid}:coinbase`,
                coinbaseScript: input.coinbase || 'unknown'
              });
              Logger.info(`Created coinbase input for transaction ${tx.txid}`);
            }
            continue;
          }
          
          // Process regular input
          await this.storeInput(tx.txid, input, vin);
        }
      }
      
      // Process outputs
      if (tx.vout && tx.vout.length > 0) {
        for (let vout = 0; vout < tx.vout.length; vout++) {
          const output = tx.vout[vout];
          
          // Mark as a coinbase output if this is a coinbase transaction
          if (isCoinbase && vout === 0) {
            await this.storeOutput(tx.txid, output, vout, true);
          } else {
            await this.storeOutput(tx.txid, output, vout, false);
          }
        }
      }
    } catch (error) {
      Logger.error(`Error storing inputs/outputs for ${tx.txid}:`, error);
    } finally {
      await session.close();
    }
  }

  /**
   * Store a transaction input
   */
  private async storeInput(txid: string, input: any, vin: number): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      // Create a unique identifier for the spent output
      const spentOutputIndex = `${input.txid}:${input.vout}`;
      
      // Extract minimal input properties
      const inputData = {
        txid,
        vin,
        prevTxid: input.txid,
        prevVout: input.vout,
        spentOutputIndex: spentOutputIndex,
        scriptSig: input.scriptSig?.hex || '',
        sequence: input.sequence || 0
      };
      
      // Create relationship between the spent output and this transaction
      await session.run(`
        MATCH (tx:tx {txid: $txid})
        MATCH (out:output {index: $spentOutputIndex})
        MERGE (out)-[:in {vin: $vin, scriptsig: $scriptSig, sequence: $sequence}]->(tx)
        
        // Remove unspent label since this output is now spent
        REMOVE out:unspent
        
        RETURN out.index
      `, inputData);
    } catch (error) {
      Logger.error(`Error storing input for ${txid} vin ${vin}:`, error);
      
      // This can happen if the output being spent isn't in our database yet
      // For example, if we're syncing from a middle block and haven't seen the output's creation
      Logger.warn(`Creating placeholder for missing output ${input.txid}:${input.vout}`);
      
      try {
        // Create a placeholder for the spent output
        const placeholderOutputIndex = `${input.txid}:${input.vout}`;
        await session.run(`
          MERGE (out:output {index: $index})
          SET out.placeholder = true,
              out.value = 0,
              out.prevTxid = $prevTxid,
              out.prevVout = $prevVout
          RETURN out
        `, {
          index: placeholderOutputIndex,
          prevTxid: input.txid,
          prevVout: input.vout
        });
        
        // Now try linking it again
        await session.run(`
          MATCH (tx:tx {txid: $txid})
          MATCH (out:output {index: $spentOutputIndex})
          MERGE (out)-[:in {vin: $vin, scriptsig: $scriptSig, sequence: $sequence}]->(tx)
          RETURN out.index
        `, {
          txid: txid,
          vin: vin,
          spentOutputIndex: `${input.txid}:${input.vout}`,
          scriptSig: input.scriptSig?.hex || '',
          sequence: input.sequence || 0
        });
        
        Logger.info(`Created and linked placeholder output ${input.txid}:${input.vout}`);
      } catch (placeholderError) {
        Logger.error(`Error creating placeholder for missing output:`, placeholderError);
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Store a transaction output
   */
  async storeOutput(txid: string, output: any, vout: number, isCoinbaseOutput: boolean = false): Promise<void> {
    const session = this.neo4jService.getSession();
    try {
      // Create a unique index for this output
      const outputIndex = `${txid}:${vout}`;
      
      // Extract output details, ensuring only simple types for Neo4j compatibility
      const outputData = {
        txid,
        vout,
        outputIndex,
        value: output.value,
        n: output.n,
        scriptPubKey: output.scriptPubKey?.hex || '',
        address: output.scriptPubKey?.address || output.scriptPubKey?.addresses?.[0] || '',
        isCoinbaseOutput
      };

      // Create output and link to transaction
      const result = await session.run(`
        MATCH (tx:tx {txid: $txid})
        MERGE (out:output:unspent {index: $outputIndex})
        MERGE (tx)-[:out {vout: $vout}]->(out)
        SET 
          out.value = $value,
          out.n = $n,
          out.scriptpubkey = $scriptPubKey
          ${isCoinbaseOutput ? ', out:coinbase' : ''}
        
        // If there's an address, create an address node and relationship
        WITH tx, out, $address as addr
        FOREACH (ignoreMe IN CASE WHEN addr <> '' THEN [1] ELSE [] END |
          MERGE (address:address {address: addr})
          MERGE (out)-[:locked]->(address)
        )
        
        RETURN out.index
      `, outputData);
    } catch (error) {
      Logger.error(`Error storing output for ${txid}:${vout}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Store a protostone with its basic properties
   */
  async storeProtostone(txid: string, protostone: any): Promise<void> {
    if (!protostone || !protostone.vout) {
      Logger.warn(`Invalid protostone for tx ${txid}, skipping`);
      return;
    }

    const session = this.neo4jService.getSession();
    try {
      // Custom replacer function for JSON.stringify to handle BigInt
      const bigIntReplacer = (key: string, value: any) => {
        // Convert BigInt to string
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      };
      
      // Extract object and serialize it to JSON with BigInt handling
      const rawData = protostone.object 
        ? JSON.stringify(protostone.object, bigIntReplacer) 
        : '{}';
      
      // Extract only the essential properties
      const protostoneData = {
        id: uuidv4(),
        txid: txid,
        vout: protostone.vout,
        protocolTag: protostone.protocolTag || '',
        rawData: rawData
      };
      
      // Store protostone and link to transaction
      await session.run(`
        MATCH (tx:tx {txid: $txid})
        CREATE (protostone:protostone {
          id: $id,
          txid: $txid,
          vout: $vout,
          protocol_tag: $protocolTag,
          raw_data: $rawData
        })
        CREATE (tx)-[:shadow_out]->(protostone)
        RETURN protostone.id
      `, protostoneData);
      
      Logger.info(`Stored protostone for tx ${txid} with vout ${protostone.vout}`);
    } catch (error) {
      Logger.error(`Error storing protostone for tx ${txid}:`, error);
      // Don't throw, continue with other protostones
    } finally {
      await session.close();
    }
  }

  /**
   * Store a block with its transactions and protostones
   */
  async storeBlockWithProtostones(block: Block, protostoneTransactions: ProtostoneTransaction[]): Promise<void> {
    try {
      // First store the block itself
      await this.storeBlockMinimal(block);
      
      // Then store each transaction in the block
      if (block.tx) {
        for (let i = 0; i < block.tx.length; i++) {
          await this.storeTransaction(block.tx[i], block.hash, i);
        }
      }
      
      // Finally store protostones
      for (const tx of protostoneTransactions) {
        for (const protostone of tx.protostones) {
          await this.storeProtostone(tx.txid, protostone);
        }
      }
      
      Logger.info(`Successfully stored block ${block.hash} with all transactions and protostones`);
    } catch (error) {
      Logger.error(`Error storing block ${block.hash} with protostones:`, error);
      throw error;
    }
  }

  /**
   * Add trace event types to a protostone
   * @param txid Transaction ID
   * @param vout Output index
   * @param eventData Full trace data with all details (not just event types)
   */
  async addEventTypesToProtostone(txid: string, vout: number, eventData: any[]): Promise<boolean> {
    if (!eventData || eventData.length === 0) {
      Logger.warn(`No event data provided for ${txid}:${vout}`);
      return false;
    }

    // Extract just the event types for summary storage
    const eventTypes = eventData.map(event => event.event || 'unknown');

    const session = this.neo4jService.getSession();
    try {
      // First, add a summary of event types as properties on the protostone node itself
      const summaryResult = await session.run(`
        MATCH (p:protostone {txid: $txid, vout: $vout})
        SET p.event_types = $eventTypes,
            p.event_count = $eventCount
        RETURN p
      `, {
        txid,
        vout,
        eventTypes,
        eventCount: eventTypes.length
      });
      
      if (summaryResult.records.length === 0) {
        Logger.warn(`No protostone found at ${txid}:${vout} to attach event types`);
        return false;
      }
      
      // Now create individual event nodes with full details for each event
      for (let i = 0; i < eventData.length; i++) {
        const event = eventData[i];
        const eventType = event.event || 'unknown';
        
        // Create the event node with detailed data
        const eventId = uuidv4();
        const eventParams = {
          eventId,
          txid,
          vout,
          eventType,
          eventIndex: i,
          dataType: event.data?.type || null,
          status: event.data?.status || null,
          fuel: event.data?.fuel || null,
          eventJson: JSON.stringify(event)
        };

        await session.run(`
          MATCH (p:protostone {txid: $txid, vout: $vout})
          CREATE (e:event {
            id: $eventId,
            event_type: $eventType,
            txid: $txid, 
            vout: $vout,
            index: $eventIndex,
            data_type: $dataType,
            status: $status,
            fuel: $fuel,
            raw_data: $eventJson
          })
          CREATE (p)-[:trace]->(e)
          RETURN e.id
        `, eventParams);

        // Process alkane relationships based on event type
        if (eventType === 'invoke') {
          // Extract and convert inputs to decimal values
          if (event.data?.context?.inputs && Array.isArray(event.data.context.inputs)) {
            const inputs = event.data.context.inputs;
            const inputParams: any = { eventId };
            
            // Build SET clause for each input
            let setClause = '';
            
            // Convert each input from hex to decimal and prepare for storage
            for (let i = 0; i < inputs.length; i++) {
              const inputHex = inputs[i];
              const inputDec = hexToDecimal(inputHex);
              
              // Add to params
              const paramName = `i${i}`;
              inputParams[paramName] = inputDec;
              
              // Add to SET clause
              if (i > 0) setClause += ', ';
              setClause += `e.${paramName} = $${paramName}`;
            }
            
            // Update the event node with all input values
            if (setClause) {
              await session.run(`
                MATCH (e:event {id: $eventId})
                SET ${setClause}
              `, inputParams);
              
              Logger.info(`Stored ${inputs.length} input values for invoke event ${eventId}`);
            }
          }
          
          // Create myself alkane node if it exists
          if (event.data?.context?.myself) {
            const myself = event.data.context.myself;
            const myselfId = `${removeHexPrefix(myself.block)}:${hexToDecimal(myself.tx)}`;
            
            await session.run(`
              MATCH (e:event {id: $eventId})
              MERGE (a:alkane {id: $myselfId})
              SET a.block = $block, 
                  a.tx = $txDec,
                  a.tx_hex = $txHex
              CREATE (e)-[:myself]->(a)
            `, {
              eventId,
              myselfId,
              block: removeHexPrefix(myself.block),
              txDec: hexToDecimal(myself.tx),
              txHex: removeHexPrefix(myself.tx)
            });
          }

          // Create caller alkane node if it exists and is not a zero address
          if (event.data?.context?.caller && 
              !(event.data.context.caller.block === '0x0' && event.data.context.caller.tx === '0x0')) {
            const caller = event.data.context.caller;
            const callerId = `${removeHexPrefix(caller.block)}:${hexToDecimal(caller.tx)}`;
            
            await session.run(`
              MATCH (e:event {id: $eventId})
              MERGE (a:alkane {id: $callerId})
              SET a.block = $block, 
                  a.tx = $txDec,
                  a.tx_hex = $txHex
              CREATE (a)-[:caller]->(e)
            `, {
              eventId,
              callerId,
              block: removeHexPrefix(caller.block),
              txDec: hexToDecimal(caller.tx),
              txHex: removeHexPrefix(caller.tx)
            });
          }

          // Process any incomingAlkanes if they exist
          if (event.data?.context?.incomingAlkanes && Array.isArray(event.data.context.incomingAlkanes)) {
            for (const alkane of event.data.context.incomingAlkanes) {
              if (alkane.id) {
                const alkaneId = `${removeHexPrefix(alkane.id.block)}:${hexToDecimal(alkane.id.tx)}`;
                const value = alkane.value ? BigInt(alkane.value).toString() : '0';
                
                await session.run(`
                  MATCH (e:event {id: $eventId})
                  MERGE (a:alkane {id: $alkaneId})
                  SET a.block = $block, 
                      a.tx = $txDec,
                      a.tx_hex = $txHex,
                      a.value = $value
                  CREATE (a)-[:transfer {value: $value}]->(e)
                `, {
                  eventId,
                  alkaneId,
                  block: removeHexPrefix(alkane.id.block),
                  txDec: hexToDecimal(alkane.id.tx),
                  txHex: removeHexPrefix(alkane.id.tx),
                  value
                });
              }
            }
          }
        } else if (eventType === 'create') {
          // Create alkane for newly created contracts
          if (event.data?.block && event.data?.tx) {
            const alkaneId = `${removeHexPrefix(event.data.block)}:${hexToDecimal(event.data.tx)}`;
            
            await session.run(`
              MATCH (e:event {id: $eventId})
              MERGE (a:alkane {id: $alkaneId})
              SET a.block = $block, 
                  a.tx = $txDec,
                  a.tx_hex = $txHex,
                  a.created = true
              CREATE (e)-[:creates]->(a)
            `, {
              eventId,
              alkaneId,
              block: removeHexPrefix(event.data.block),
              txDec: hexToDecimal(event.data.tx),
              txHex: removeHexPrefix(event.data.tx)
            });
          }
        } else if (eventType === 'return') {
          // Extract and convert the data field from hex to string if present
          if (event.data?.response?.data) {
            const dataHex = event.data.response.data;
            const dataString = hexToString(dataHex);
            
            // Update the event node with the human-readable string
            if (dataString) {
              // Check if this is a clock-in message and extract the count
              let clockInCount = null;
              if (dataString.includes('Clock in to oyl corp successful') && dataString.includes('Total clock-ins:')) {
                // Extract just the number from the end of the string
                const match = dataString.match(/Total clock-ins:\s*(\d+)/);
                if (match && match[1]) {
                  clockInCount = parseInt(match[1], 10);
                  Logger.info(`Extracted clock-in count: ${clockInCount}`);
                }
              }
              
              // Set the data_string and clock_in_count (if found)
              await session.run(`
                MATCH (e:event {id: $eventId})
                SET e.data_string = $dataString
                ${clockInCount !== null ? ', e.clock_in_count = $clockInCount' : ''}
              `, {
                eventId,
                dataString,
                ...(clockInCount !== null ? { clockInCount } : {})
              });
              Logger.info(`Extracted return data string: ${dataString}`);
            }
          }
          
          // Process any outgoing alkanes in the return data
          if (event.data?.response?.alkanes && Array.isArray(event.data.response.alkanes)) {
            for (const alkane of event.data.response.alkanes) {
              if (alkane.id) {
                const alkaneId = `${removeHexPrefix(alkane.id.block)}:${hexToDecimal(alkane.id.tx)}`;
                const value = alkane.value ? BigInt(alkane.value).toString() : '0';
                
                await session.run(`
                  MATCH (e:event {id: $eventId})
                  MERGE (a:alkane {id: $alkaneId})
                  SET a.block = $block, 
                      a.tx = $txDec,
                      a.tx_hex = $txHex,
                      a.value = $value
                  CREATE (e)-[:return_transfer {value: $value}]->(a)
                `, {
                  eventId,
                  alkaneId,
                  block: removeHexPrefix(alkane.id.block),
                  txDec: hexToDecimal(alkane.id.tx),
                  txHex: removeHexPrefix(alkane.id.tx),
                  value
                });
              }
            }
          }
          
          // Also extract and process any storage changes
          if (event.data?.response?.storage && Array.isArray(event.data.response.storage)) {
            for (const storageItem of event.data.response.storage) {
              if (storageItem.key && storageItem.value) {
                const storageKey = removeHexPrefix(storageItem.key);
                const storageValue = removeHexPrefix(storageItem.value);
                const storageId = `${eventId}:${storageKey}`;
                
                await session.run(`
                  MATCH (e:event {id: $eventId})
                  CREATE (s:storage {id: $storageId, key: $key, value: $value})
                  CREATE (e)-[:storage_change]->(s)
                `, {
                  eventId,
                  storageId,
                  key: storageKey,
                  value: storageValue
                });
              }
            }
          }
        }
      }
      
      Logger.info(`Created ${eventData.length} event nodes with alkane relationships for protostone ${txid}:${vout}`);
      return true;
    } catch (error) {
      Logger.error(`Error adding event nodes to protostone ${txid}:${vout}:`, error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Check if a block exists
   */
  async blockExists(height: number): Promise<boolean> {
    const session = this.neo4jService.getSession();
    try {
      const result = await session.run(
        'MATCH (b:block {height: $height}) RETURN count(b) as count',
        { height }
      );
      return result.records[0].get('count').toNumber() > 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Get stats about the graph
   * @returns Object with counts of various node types
   */
  async getGraphStats(): Promise<{
    blockCount: number;
    txCount: number;
    outputCount: number;
    protostoneCount: number;
    addressCount: number;
    eventCount: number;
    alkaneCount: number;
  }> {
    const session = this.neo4jService.getSession();
    try {
      const result = await session.run(`
        MATCH (block:block) WITH count(block) as blockCount
        MATCH (tx:tx) WITH blockCount, count(tx) as txCount
        MATCH (output:output) WITH blockCount, txCount, count(output) as outputCount
        MATCH (protostone:protostone) WITH blockCount, txCount, outputCount, count(protostone) as protostoneCount
        MATCH (address:address) WITH blockCount, txCount, outputCount, protostoneCount, count(address) as addressCount
        MATCH (event:event) WITH blockCount, txCount, outputCount, protostoneCount, addressCount, count(event) as eventCount
        MATCH (alkane:alkane) WITH blockCount, txCount, outputCount, protostoneCount, addressCount, eventCount, count(alkane) as alkaneCount
        RETURN {
          blockCount: blockCount,
          txCount: txCount,
          outputCount: outputCount,
          protostoneCount: protostoneCount,
          addressCount: addressCount,
          eventCount: eventCount,
          alkaneCount: alkaneCount
        } as stats
      `);

      if (result.records.length > 0) {
        const stats = result.records[0].get('stats');
        return {
          blockCount: stats.blockCount.toNumber(),
          txCount: stats.txCount.toNumber(),
          outputCount: stats.outputCount.toNumber(),
          protostoneCount: stats.protostoneCount.toNumber(),
          addressCount: stats.addressCount.toNumber(),
          eventCount: stats.eventCount.toNumber(),
          alkaneCount: stats.alkaneCount.toNumber()
        };
      }

      return {
        blockCount: 0,
        txCount: 0,
        outputCount: 0,
        protostoneCount: 0,
        addressCount: 0,
        eventCount: 0,
        alkaneCount: 0
      };
    } catch (error) {
      Logger.error('Error getting graph stats:', error);
      return {
        blockCount: 0,
        txCount: 0,
        outputCount: 0,
        protostoneCount: 0,
        addressCount: 0,
        eventCount: 0,
        alkaneCount: 0
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Apply a CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
  
  /**
   * Apply a block CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyBlockCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
  
  /**
   * Apply a transaction CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyTransactionCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
  
  /**
   * Apply an output CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyOutputCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
  
  /**
   * Apply a protostone CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyProtostoneCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
  
  /**
   * Apply an event CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyEventCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
  
  /**
   * Apply an alkane CDC message to the database
   * @deprecated CDC functionality is not being used
   */
  async applyAlkaneCdc(message: CdcMessage): Promise<void> {
    Logger.warn('CDC functionality is not implemented');
    // No implementation - CDC functionality not being used
  }
}
