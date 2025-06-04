import fs from 'fs-extra';
import path from 'path';
import { ProcessedBlock } from '../types/protostone';

export class FileStorage {
  private outputDir: string;

  constructor(outputDir: string = './output') {
    this.outputDir = outputDir;
    this.ensureOutputDirExists();
  }

  /**
   * Ensure the output directory exists
   */
  private ensureOutputDirExists(): void {
    fs.ensureDirSync(this.outputDir);
  }

  /**
   * Get the file path for a specific block
   * @param blockHeight Block height
   * @returns File path
   */
  private getBlockFilePath(blockHeight: number): string {
    return path.join(this.outputDir, `block_${blockHeight}.json`);
  }

  /**
   * Save a processed block to a file
   * @param processedBlock Processed block data
   * @returns File path where the block was saved
   */
  public async saveBlock(processedBlock: ProcessedBlock): Promise<string> {
    const filePath = this.getBlockFilePath(processedBlock.blockHeight);
    
    try {
      await this.saveJson(filePath, processedBlock);
      return filePath;
    } catch (error) {
      throw new Error(`Error saving block to file: ${error}`);
    }
  }

  /**
   * Check if a block has already been processed
   * @param blockHeight Block height
   * @returns Whether the block has been processed
   */
  public async isBlockProcessed(blockHeight: number): Promise<boolean> {
    const dirPath = path.join(this.outputDir, `block_${blockHeight}`);
    const filePath = this.getBlockFilePath(blockHeight);
    
    // Check for either the directory or the flat file
    return await fs.pathExists(dirPath) || await fs.pathExists(filePath);
  }

  /**
   * Load a processed block from a file
   * @param blockHeight Block height
   * @returns Processed block data
   */
  public async loadBlock(blockHeight: number): Promise<ProcessedBlock> {
    const filePath = this.getBlockFilePath(blockHeight);
    
    try {
      return await this.loadJson(filePath);
    } catch (error) {
      throw new Error(`Error loading block from file: ${error}`);
    }
  }

  /**
   * Get the highest block height that has been processed
   * @returns Highest processed block height, or -1 if no blocks have been processed
   */
  public async getHighestProcessedBlockHeight(): Promise<number> {
    try {
      const files = await fs.readdir(this.outputDir);
      
      const blockHeights = files
        .filter(file => {
          // Match either block_X.json or block_X directory
          return file.startsWith('block_') && 
                 (file.endsWith('.json') || 
                  fs.statSync(path.join(this.outputDir, file)).isDirectory());
        })
        .map(file => {
          const match = file.match(/block_(\d+)(\.json)?/);
          return match ? parseInt(match[1], 10) : -1;
        })
        .filter(height => height !== -1);
      
      if (blockHeights.length === 0) {
        return -1;
      }
      
      return Math.max(...blockHeights);
    } catch (error) {
      console.error(`Error getting highest processed block height: ${error}`);
      return -1;
    }
  }

  /**
   * Set the output directory
   * @param outputDir Output directory
   */
  public setOutputDir(outputDir: string): void {
    this.outputDir = outputDir;
    this.ensureOutputDirExists();
  }
  
  /**
   * Ensure a directory exists
   * @param dirPath Directory path
   */
  public async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }
  
  /**
   * Custom replacer for JSON.stringify that handles BigInt
   * @param key Object key
   * @param value Object value
   * @returns Serializable value
   */
  private jsonReplacer(key: string, value: any): any {
    // Convert BigInt to string for serialization
    if (typeof value === 'bigint') {
      return value.toString();
    }
    // Handle Buffer objects if they exist
    if (Buffer.isBuffer(value)) {
      return value.toString('hex');
    }
    return value;
  }
  
  /**
   * Save JSON data to a file
   * @param filePath File path
   * @param data Data to save
   * @returns File path where the data was saved
   */
  public async saveJson(filePath: string, data: any): Promise<string> {
    try {
      // Use a custom JSON stringify with replacer function for BigInt
      const jsonString = JSON.stringify(data, this.jsonReplacer, 2);
      await fs.writeFile(filePath, jsonString, 'utf8');
      return filePath;
    } catch (error) {
      throw new Error(`Error saving JSON to file: ${error}`);
    }
  }
  
  /**
   * Load JSON data from a file
   * @param filePath File path
   * @returns Loaded data
   */
  public async loadJson<T = any>(filePath: string): Promise<T> {
    try {
      return await fs.readJson(filePath);
    } catch (error) {
      throw new Error(`Error loading JSON from file: ${error}`);
    }
  }
}
