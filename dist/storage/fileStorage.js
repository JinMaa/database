"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
class FileStorage {
    constructor(outputDir = './output') {
        this.outputDir = outputDir;
        this.ensureOutputDirExists();
    }
    /**
     * Ensure the output directory exists
     */
    ensureOutputDirExists() {
        fs_extra_1.default.ensureDirSync(this.outputDir);
    }
    /**
     * Get the file path for a specific block
     * @param blockHeight Block height
     * @returns File path
     */
    getBlockFilePath(blockHeight) {
        return path_1.default.join(this.outputDir, `block_${blockHeight}.json`);
    }
    /**
     * Save a processed block to a file
     * @param processedBlock Processed block data
     * @returns File path where the block was saved
     */
    async saveBlock(processedBlock) {
        const filePath = this.getBlockFilePath(processedBlock.blockHeight);
        try {
            await this.saveJson(filePath, processedBlock);
            return filePath;
        }
        catch (error) {
            throw new Error(`Error saving block to file: ${error}`);
        }
    }
    /**
     * Check if a block has already been processed
     * @param blockHeight Block height
     * @returns Whether the block has been processed
     */
    async isBlockProcessed(blockHeight) {
        const dirPath = path_1.default.join(this.outputDir, `block_${blockHeight}`);
        const filePath = this.getBlockFilePath(blockHeight);
        // Check for either the directory or the flat file
        return await fs_extra_1.default.pathExists(dirPath) || await fs_extra_1.default.pathExists(filePath);
    }
    /**
     * Load a processed block from a file
     * @param blockHeight Block height
     * @returns Processed block data
     */
    async loadBlock(blockHeight) {
        const filePath = this.getBlockFilePath(blockHeight);
        try {
            return await this.loadJson(filePath);
        }
        catch (error) {
            throw new Error(`Error loading block from file: ${error}`);
        }
    }
    /**
     * Get the highest block height that has been processed
     * @returns Highest processed block height, or -1 if no blocks have been processed
     */
    async getHighestProcessedBlockHeight() {
        try {
            const files = await fs_extra_1.default.readdir(this.outputDir);
            const blockHeights = files
                .filter(file => {
                // Match either block_X.json or block_X directory
                return file.startsWith('block_') &&
                    (file.endsWith('.json') ||
                        fs_extra_1.default.statSync(path_1.default.join(this.outputDir, file)).isDirectory());
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
        }
        catch (error) {
            console.error(`Error getting highest processed block height: ${error}`);
            return -1;
        }
    }
    /**
     * Set the output directory
     * @param outputDir Output directory
     */
    setOutputDir(outputDir) {
        this.outputDir = outputDir;
        this.ensureOutputDirExists();
    }
    /**
     * Ensure a directory exists
     * @param dirPath Directory path
     */
    async ensureDir(dirPath) {
        await fs_extra_1.default.ensureDir(dirPath);
    }
    /**
     * Custom replacer for JSON.stringify that handles BigInt
     * @param key Object key
     * @param value Object value
     * @returns Serializable value
     */
    jsonReplacer(key, value) {
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
    async saveJson(filePath, data) {
        try {
            // Use a custom JSON stringify with replacer function for BigInt
            const jsonString = JSON.stringify(data, this.jsonReplacer, 2);
            await fs_extra_1.default.writeFile(filePath, jsonString, 'utf8');
            return filePath;
        }
        catch (error) {
            throw new Error(`Error saving JSON to file: ${error}`);
        }
    }
    /**
     * Load JSON data from a file
     * @param filePath File path
     * @returns Loaded data
     */
    async loadJson(filePath) {
        try {
            return await fs_extra_1.default.readJson(filePath);
        }
        catch (error) {
            throw new Error(`Error loading JSON from file: ${error}`);
        }
    }
}
exports.FileStorage = FileStorage;
