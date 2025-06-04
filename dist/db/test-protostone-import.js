"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const neo4j_service_1 = require("./neo4j-service");
const protostone_repository_1 = require("./protostone-repository");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function testProtostoneImport() {
    // Initialize services
    const neo4jService = neo4j_service_1.Neo4jService.getInstance();
    const repository = new protostone_repository_1.ProtostoneRepository();
    try {
        // Verify connection to Neo4j first
        const connected = await neo4jService.verifyConnection();
        if (!connected) {
            console.error('Failed to connect to Neo4j. Check your connection settings.');
            process.exit(1);
        }
        console.log('Successfully connected to Neo4j');
        // Load sample block and protostone data
        const dataDir = path.join(__dirname, '../../data');
        // Read saved block data (from previous steps)
        const blockPath = path.join(dataDir, 'block.json');
        if (!fs.existsSync(blockPath)) {
            console.error(`Block data not found at ${blockPath}. Run processor.ts first.`);
            process.exit(1);
        }
        const protostonesPath = path.join(dataDir, 'protostones.json');
        if (!fs.existsSync(protostonesPath)) {
            console.error(`Protostone data not found at ${protostonesPath}. Run processor.ts first.`);
            process.exit(1);
        }
        // Load both files
        const blockData = JSON.parse(fs.readFileSync(blockPath, 'utf8'));
        const protostonesData = JSON.parse(fs.readFileSync(protostonesPath, 'utf8'));
        // Set up Neo4j database schema first
        await repository.setupDatabase();
        // Clear existing protostone data for clean test
        await repository.clearProtostoneData();
        console.log('Cleared existing protostone data');
        // Prepare block data for Neo4j 
        // First attach protostones to their transactions
        const txMap = new Map();
        protostonesData.transactions.forEach((tx) => {
            txMap.set(tx.txid, tx.protostones);
        });
        if (blockData.tx && blockData.tx.length > 0) {
            blockData.tx.forEach((tx) => {
                const protostones = txMap.get(tx.txid);
                if (protostones) {
                    tx.protostones = protostones;
                }
            });
            // Store the block with transactions and protostones
            console.log(`Storing block ${blockData.hash} with ${blockData.tx.length} transactions...`);
            await repository.storeBlock(blockData);
            console.log('Block stored successfully');
            // Query protostones by transaction
            if (protostonesData.transactions.length > 0) {
                const firstTx = protostonesData.transactions[0];
                console.log(`\nQuerying protostones for transaction: ${firstTx.txid}`);
                const storedProtostones = await repository.getProtostonesByTxid(firstTx.txid);
                console.log(`Found ${storedProtostones.length} protostones in transaction ${firstTx.txid}`);
                if (storedProtostones.length > 0) {
                    console.log('Sample protostone:');
                    console.log(JSON.stringify(storedProtostones[0], null, 2));
                }
            }
            // Query blocks with protostones
            console.log('\nQuerying blocks with protostones:');
            const blocksWithProtostones = await repository.getBlocksWithProtostones(10, 0);
            console.log(`Found ${blocksWithProtostones.length} blocks with protostones`);
            if (blocksWithProtostones.length > 0) {
                console.log('Sample block:');
                console.log(JSON.stringify(blocksWithProtostones[0], null, 2));
                // Query transactions with protostones in this block
                const blockHash = blocksWithProtostones[0].hash;
                console.log(`\nQuerying transactions with protostones in block ${blockHash}:`);
                const txsWithProtostones = await repository.getProtostoneTransactionsByBlock(blockHash);
                console.log(`Found ${txsWithProtostones.length} transactions with protostones in block ${blockHash}`);
            }
            // Get protostone protocols
            console.log('\nQuerying protostone protocols:');
            const protocols = await repository.getProtostoneProtocols();
            console.log(`Found ${protocols.length} different protostone protocols`);
            if (protocols.length > 0) {
                console.log('Protocol distribution:');
                protocols.forEach(p => console.log(`- ${p.protocol}: ${p.count} instances`));
            }
            // Verify the graph model
            console.log('\nVerifying graph model:');
            const stats = await repository.verifyGraphModel();
            console.log(JSON.stringify(stats, null, 2));
        }
        else {
            console.error('No transactions found in block data');
        }
        console.log('\nTest completed successfully!');
    }
    catch (error) {
        console.error('Error during protostone import test:', error);
    }
    finally {
        // Close Neo4j connection
        await neo4jService.close();
    }
}
// Run the script
testProtostoneImport().catch(console.error);
