import { ProcessedBlock } from '../types/protostone';
export declare class FileStorage {
    private outputDir;
    constructor(outputDir?: string);
    /**
     * Ensure the output directory exists
     */
    private ensureOutputDirExists;
    /**
     * Get the file path for a specific block
     * @param blockHeight Block height
     * @returns File path
     */
    private getBlockFilePath;
    /**
     * Save a processed block to a file
     * @param processedBlock Processed block data
     * @returns File path where the block was saved
     */
    saveBlock(processedBlock: ProcessedBlock): Promise<string>;
    /**
     * Check if a block has already been processed
     * @param blockHeight Block height
     * @returns Whether the block has been processed
     */
    isBlockProcessed(blockHeight: number): Promise<boolean>;
    /**
     * Load a processed block from a file
     * @param blockHeight Block height
     * @returns Processed block data
     */
    loadBlock(blockHeight: number): Promise<ProcessedBlock>;
    /**
     * Get the highest block height that has been processed
     * @returns Highest processed block height, or -1 if no blocks have been processed
     */
    getHighestProcessedBlockHeight(): Promise<number>;
    /**
     * Set the output directory
     * @param outputDir Output directory
     */
    setOutputDir(outputDir: string): void;
    /**
     * Ensure a directory exists
     * @param dirPath Directory path
     */
    ensureDir(dirPath: string): Promise<void>;
    /**
     * Custom replacer for JSON.stringify that handles BigInt
     * @param key Object key
     * @param value Object value
     * @returns Serializable value
     */
    private jsonReplacer;
    /**
     * Save JSON data to a file
     * @param filePath File path
     * @param data Data to save
     * @returns File path where the data was saved
     */
    saveJson(filePath: string, data: any): Promise<string>;
    /**
     * Load JSON data from a file
     * @param filePath File path
     * @returns Loaded data
     */
    loadJson<T = any>(filePath: string): Promise<T>;
}
