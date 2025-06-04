#!/usr/bin/env node
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
const neo4j_service_1 = require("../db/neo4j-service");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
/**
 * Fix incorrect coinbase transaction relationships
 * This is a one-time script to repair the data model
 */
async function fixCoinbaseRelationships() {
    const neo4jService = neo4j_service_1.Neo4jService.getInstance();
    const session = neo4jService.getSession();
    try {
        console.log('Fixing coinbase transaction relationships...');
        // Remove incorrect [:in] relationships from coinbase outputs to transactions
        const result = await session.run(`
      MATCH (coinbase:coinbase)-[r:in]->(tx:tx)
      DELETE r
      RETURN count(r) as removedCount
    `);
        const removedCount = result.records[0].get('removedCount').toNumber();
        console.log(`✅ Fixed coinbase transactions structure: removed ${removedCount} incorrect relationships`);
        // Verify the fix - there should be no coinbase->tx relationships
        const verifyResult = await session.run(`
      MATCH (coinbase:coinbase)-[r:in]->(tx:tx)
      RETURN count(r) as remainingCount
    `);
        const remainingCount = verifyResult.records[0].get('remainingCount').toNumber();
        if (remainingCount === 0) {
            console.log('✅ Verification successful: No incorrect coinbase relationships remain');
        }
        else {
            console.warn(`⚠️ Verification failed: ${remainingCount} incorrect relationships still remain`);
        }
    }
    catch (error) {
        console.error('Error fixing coinbase relationships:', error);
        process.exit(1);
    }
    finally {
        await session.close();
        await neo4jService.close();
    }
}
// Run the fix script
fixCoinbaseRelationships().then(() => {
    console.log('Fix script completed successfully.');
    process.exit(0);
}).catch(error => {
    console.error('Error running fix script:', error);
    process.exit(1);
});
