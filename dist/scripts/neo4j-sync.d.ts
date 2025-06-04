#!/usr/bin/env node
import { Network } from '../api/config';
/**
 * Sync blocks with protostones and trace event types to Neo4j
 * @param startHeight Starting block height
 * @param endHeight Ending block height
 * @param batchSize Number of blocks to process in each batch
 * @param skipExisting Whether to skip blocks that already exist in the database
 * @param network Network to use for API calls
 */
export declare function syncToNeo4j(startHeight: number, endHeight: number, batchSize?: number, skipExisting?: boolean, network?: Network): Promise<void>;
