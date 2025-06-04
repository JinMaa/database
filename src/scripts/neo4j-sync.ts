#!/usr/bin/env node

import dotenv from 'dotenv';
import { BlockApi } from '../api/blockApi';
import { TraceApi } from '../api/traceApi';
import { Network } from '../api/config';
import { Neo4jRepository } from '../db/neo4j-repository';
import { Neo4jService } from '../db/neo4j-service';
import { parseProtostonesFromBlock } from '../parsers/protostone';
import { Logger } from '../utils/logger';
import { Block } from '../types/block';

// Load environment variables
dotenv.config();

/**
 * Sync blocks with protostones and trace event types to Neo4j
 * @param startHeight Starting block height
 * @param endHeight Ending block height
 * @param batchSize Number of blocks to process in each batch
 * @param skipExisting Whether to skip blocks that already exist in the database
 * @param network Network to use for API calls
 */
export async function syncToNeo4j(
  startHeight: number, 
  endHeight: number,
  batchSize: number = 10,
  skipExisting: boolean = true,
  network: Network = Network.OYLNET
): Promise<void> {
  console.log(`Starting Neo4j sync from block ${startHeight} to ${endHeight}`);
  
  // Initialize services
  const blockApi = new BlockApi(network);
  const traceApi = new TraceApi(network);
  const repository = new Neo4jRepository();
  
  try {
    // Verify Neo4j connection and setup schema
    const neo4jService = Neo4jService.getInstance();
    await neo4jService.verifyConnection();
    console.log('✅ Neo4j connection verified');
    await repository.setupDatabase();
    console.log('✅ Database schema initialized');
    
    let totalBlocks = 0;
    let totalTransactions = 0;
    let totalOutputs = 0;
    let totalProtostones = 0;
    let totalTraces = 0;
    
    // Process blocks in batches
    for (let height = startHeight; height <= endHeight; height += batchSize) {
      const batchEnd = Math.min(height + batchSize - 1, endHeight);
      console.log(`\n----- Processing batch: blocks ${height} to ${batchEnd} -----`);
      
      // Process each block in the batch
      for (let blockHeight = height; blockHeight <= batchEnd; blockHeight++) {
        try {
          // Skip if already exists
          if (skipExisting) {
            const exists = await repository.blockExists(blockHeight);
            if (exists) {
              console.log(`Block ${blockHeight} already exists, skipping`);
              continue;
            }
          }
          
          console.log(`\nProcessing block ${blockHeight}...`);
          
          // Get block hash
          const blockHash = await blockApi.getBlockHash(blockHeight);
          if (!blockHash) {
            console.error(`Could not get hash for block ${blockHeight}`);
            continue;
          }
          
          // Get block with transactions
          const blockData = await blockApi.getBlock(blockHash, 2) as Block;
          if (!blockData) {
            console.error(`Could not get data for block ${blockHash}`);
            continue;
          }
          
          // Get block hex for protostone extraction
          const blockHex = await blockApi.getBlockHex(blockHash);
          if (!blockHex) {
            console.error(`Could not get hex data for block ${blockHash}`);
            continue;
          }
          
          // Extract protostones
          console.log(`Extracting protostones from block ${blockHeight}...`);
          const protostoneTransactions = parseProtostonesFromBlock(blockHex);
          
          // Count total protostones
          let protostoneCount = 0;
          for (const tx of protostoneTransactions) {
            protostoneCount += tx.protostones.length;
          }
          
          console.log(`Found ${protostoneCount} protostones in ${protostoneTransactions.length} transactions`);
          
          // Store block with transactions and protostones
          await repository.storeBlockWithProtostones(blockData, protostoneTransactions);
          totalBlocks++;
          totalTransactions += blockData.tx?.length || 0;
          totalProtostones += protostoneCount;
          
          // Process trace data if there are protostones
          if (protostoneCount > 0 && blockHeight > 0) {
            console.log(`Fetching trace data for protostones...`);
            
            // Process trace data for each protostone
            for (const tx of protostoneTransactions) {
              const txid = tx.txid;
              
              for (const protostone of tx.protostones) {
                try {
                  const vout = protostone.vout;
                  
                  // Get trace data using the proper Metashrew format via our updated API
                  const traceData = await traceApi.getTransactionTrace(txid, vout);
                  
                  if (traceData && traceData.result && traceData.result.length > 0) {
                    // Pass the full trace event data to the repository
                    // This allows for creating alkane nodes and their relationships
                    const success = await repository.addEventTypesToProtostone(txid, vout, traceData.result);
                    
                    if (success) {
                      console.log(`✅ Added ${traceData.result.length} event nodes with alkane relationships for protostone ${txid}:${vout}`);
                      totalTraces += traceData.result.length;
                    }
                  } else {
                    console.log(`No trace events found for ${txid}:${vout}`);
                  }
                } catch (error) {
                  console.error(`Error processing trace for ${txid}:${protostone.vout}:`, error);
                }
              }
            }
          }
          
          console.log(`✅ Block ${blockHeight} processed successfully`);
        } catch (error) {
          console.error(`Error processing block ${blockHeight}:`, error);
        }
      }
      
      // Show progress after each batch
      const stats = await repository.getGraphStats();
      console.log(`\n----- Sync Progress -----`);
      console.log(`- Blocks in database: ${stats.blockCount}`);
      console.log(`- Transactions: ${stats.txCount}`);
      console.log(`- Outputs: ${stats.outputCount}`);
      console.log(`- Protostones: ${stats.protostoneCount}`);
      console.log(`- Addresses: ${stats.addressCount}`);
      console.log(`- Events: ${stats.eventCount}`);
      console.log(`- Alkanes: ${stats.alkaneCount || 0}`); // Add alkane count if available
      console.log(`- Current batch completed`);
    }
    
    // Show final stats
    const finalStats = await repository.getGraphStats();
    console.log(`\n===== Sync Complete =====`);
    console.log(`- Total blocks processed: ${totalBlocks}`);
    console.log(`- Total transactions processed: ${totalTransactions}`);
    console.log(`- Total outputs created: ${totalOutputs}`);
    console.log(`- Total protostones found: ${totalProtostones}`);
    console.log(`- Total trace events processed: ${totalTraces}`);
    console.log(`- Blocks in database: ${finalStats.blockCount}`);
    console.log(`- Transactions in database: ${finalStats.txCount}`);
    console.log(`- Outputs in database: ${finalStats.outputCount}`);
    console.log(`- Protostones in database: ${finalStats.protostoneCount}`);
    console.log(`- Addresses in database: ${finalStats.addressCount}`);
    console.log(`- Events in database: ${finalStats.eventCount}`);
    console.log(`- Alkanes in database: ${finalStats.alkaneCount || 0}`); // Add alkane count if available
    
  } catch (error) {
    console.error('Fatal error in sync process:', error);
    throw error;
  }
}

// Run the script directly if executed from command line
if (require.main === module) {
  // Default to sensible block range if no args provided
  const startBlock = parseInt(process.argv[2], 10) || 0; // Default to genesis block
  const endBlock = parseInt(process.argv[3], 10) || 100;
  const batchSize = parseInt(process.argv[4], 10) || 10;

  // Execute the sync
  syncToNeo4j(startBlock, endBlock, batchSize)
    .then(() => {
      console.log('Neo4j sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Neo4j sync failed:', error);
      process.exit(1);
    })
    .finally(() => {
      Neo4jService.getInstance().close()
        .then(() => console.log('Neo4j connection closed'));
    });
}
