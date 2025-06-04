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
const dotenv = __importStar(require("dotenv"));
const neo4j_service_1 = require("../db/neo4j-service");
const protostone_repository_1 = require("../db/protostone-repository");
const traceApi_1 = require("../api/traceApi");
const config_1 = require("../api/config");
const logger_1 = require("../utils/logger");
// Load environment variables
dotenv.config();
/**
 * Finds protostones in a block range that have one protostone per transaction
 * and attempts to fetch and store trace data for them
 */
async function testProtostoneTraces() {
    const blockStart = 680;
    const blockEnd = 690;
    // Initialize services
    const neo4jService = neo4j_service_1.Neo4jService.getInstance();
    const protostoneRepo = new protostone_repository_1.ProtostoneRepository();
    const traceApi = new traceApi_1.TraceApi(config_1.Network.OYLNET);
    try {
        logger_1.Logger.info(`Finding protostones in blocks ${blockStart}-${blockEnd} with single protostones per tx`);
        // Find transactions with exactly one protostone in the target block range
        const session = neo4jService.getSession();
        const result = await session.run(`
      MATCH (p:protostone)<-[:shadow_out]-(tx:tx)
      MATCH (tx)-[txindex:inc]->(b:block)
      WHERE b.height >= $startHeight AND b.height <= $endHeight
      WITH tx, b, txindex, COUNT(p) as shadow_out_count
      WHERE shadow_out_count = 1
      MATCH (p:protostone)<-[:shadow_out]-(tx)
      RETURN p.txid as txid, p.vout as vout, b.height as height, txindex.i as tx_index
      ORDER BY b.height, tx_index
      LIMIT 10
    `, {
            startHeight: blockStart,
            endHeight: blockEnd
        });
        if (result.records.length === 0) {
            logger_1.Logger.warn(`No protostones found with single protostone per tx in blocks ${blockStart}-${blockEnd}`);
            await session.close();
            return;
        }
        // Extract protostone data
        const protostones = result.records.map(record => ({
            txid: record.get('txid'),
            vout: record.get('vout').toNumber()
        }));
        logger_1.Logger.info(`Found ${protostones.length} protostones with single shadow_out per tx`);
        // Format as txid-vout pairs for the trace API
        const txVoutPairs = protostones.map(p => ({
            txid: p.txid,
            vout: p.vout
        }));
        // Attempt to get trace data for each protostone
        logger_1.Logger.info(`Fetching trace data for ${txVoutPairs.length} protostones`);
        const traceResults = await traceApi.getBlockTraces(txVoutPairs);
        // Check results
        const traceCount = Object.keys(traceResults).length;
        logger_1.Logger.info(`Retrieved trace data for ${traceCount}/${txVoutPairs.length} protostones`);
        if (traceCount > 0) {
            // Store the trace data in Neo4j
            logger_1.Logger.info(`Storing trace data in Neo4j...`);
            const storedCount = await protostoneRepo.storeMultipleProtostoneTraces(traceResults);
            logger_1.Logger.info(`Successfully stored trace data for ${storedCount}/${traceCount} protostones`);
        }
        await session.close();
    }
    catch (error) {
        logger_1.Logger.error('Error testing protostone traces:', error);
    }
    finally {
        await neo4jService.close();
    }
}
// Run the test
testProtostoneTraces().then(() => {
    logger_1.Logger.info('Test completed');
    process.exit(0);
}).catch(error => {
    logger_1.Logger.error('Test failed:', error);
    process.exit(1);
});
