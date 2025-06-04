"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const neo4j_service_1 = require("../db/neo4j-service");
const protostone_repository_1 = require("../db/protostone-repository");
const traceApi_1 = require("../api/traceApi");
// Load environment variables
dotenv_1.default.config();
/**
 * This script creates a minimal test protostone in Neo4j and then attempts
 * to store trace data for it, to isolate trace data storage issues.
 */
async function testTraceStorage() {
    console.log('Starting trace storage test');
    // Initialize services
    const traceApi = new traceApi_1.TraceApi();
    const neo4jService = neo4j_service_1.Neo4jService.getInstance();
    const repository = new protostone_repository_1.ProtostoneRepository();
    try {
        // Verify Neo4j connection
        await neo4jService.verifyConnection();
        console.log('✅ Neo4j connection verified');
        // Create a test protostone directly in Neo4j
        const session = neo4jService.getSession();
        try {
            console.log('Creating test protostone in Neo4j...');
            // Create a block, transaction, and protostone with known values
            await session.run(`
        MERGE (b:block {hash: "test_block_hash", height: 1000})
        MERGE (tx:tx {txid: "test_transaction_id"})
        MERGE (tx)-[:inc {i: 0}]->(b)
        MERGE (p:protostone {
          txid: "test_transaction_id",
          vout: 4,
          protocol_tag: "test_protocol",
          hex: "test_hex_data",
          value: 0
        })
        MERGE (tx)-[:shadow_out]->(p)
        RETURN p
      `);
            console.log('✅ Created test protostone');
            // Create a simplified test trace result
            const testTraceData = {
                result: [
                    {
                        event: "test_event",
                        name: "test_name",
                        data: {
                            value: 123,
                            text: "test text",
                            nested: {
                                prop1: "value1",
                                prop2: 456
                            },
                            array: [1, 2, 3]
                        }
                    }
                ]
            };
            // Store trace data for the test protostone
            console.log('Storing trace data for test protostone...');
            const result = await repository.storeProtostoneTraceEvents("test_transaction_id", 4, testTraceData);
            console.log(`✅ Stored ${result} trace events`);
            // Verify the trace relationship and event node were created
            const verifyResult = await session.run(`
        MATCH (p:protostone {txid: "test_transaction_id", vout: 4})-[:trace]->(e:event)
        RETURN e.event_type, e.event_data
      `);
            if (verifyResult.records.length > 0) {
                console.log('✅ Trace relationship verified');
                console.log('Event type:', verifyResult.records[0].get('e.event_type'));
                console.log('Event data sample:', verifyResult.records[0].get('e.event_data').substring(0, 100) + '...');
            }
            else {
                console.error('❌ No trace relationship found');
            }
        }
        finally {
            await session.close();
        }
    }
    catch (error) {
        console.error('Error in trace storage test:', error);
    }
    finally {
        // Close Neo4j connection
        await neo4jService.close();
        console.log('Neo4j connection closed');
    }
}
// Run the test
testTraceStorage()
    .then(() => console.log('Trace storage test completed'))
    .catch(error => console.error('Trace storage test failed:', error));
