/**
 * A more robust implementation of the blockchain syncing process with improved
 * error handling and resilience. This version uses our approach of storing
 * only event types instead of full trace data.
 *
 * @param startHeight Start block height
 * @param endHeight End block height
 * @param batchSize Number of blocks to process in each batch
 * @param delayMs Delay between API requests
 * @param skipExisting Skip blocks that are already in the database
 * @returns Promise that resolves when sync is complete
 */
export declare function robustSync(startHeight: number, endHeight: number, batchSize?: number, delayMs?: number, skipExisting?: boolean): Promise<void>;
