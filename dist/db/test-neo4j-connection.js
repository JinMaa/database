"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
async function testNeo4jConnection() {
    // Neo4j connection parameters from config
    const uri = 'bolt://localhost:7687';
    const user = 'neo4j';
    const password = 'password'; // Updated password
    console.log('Attempting to connect to Neo4j at:', uri);
    const driver = neo4j_driver_1.default.driver(uri, neo4j_driver_1.default.auth.basic(user, password));
    try {
        // Verify connectivity
        await driver.verifyConnectivity();
        console.log('Connection to Neo4j successful!');
        // Run a simple query to test functionality
        const session = driver.session();
        try {
            const result = await session.run('RETURN "Connected to Neo4j!" AS message');
            const message = result.records[0].get('message');
            console.log('Query result:', message);
            // Check if we have the APOC plugin installed (useful for many operations)
            const apocResult = await session.run('CALL dbms.procedures() YIELD name WHERE name STARTS WITH "apoc" RETURN count(name) as apocCount');
            const apocCount = apocResult.records[0].get('apocCount').toNumber();
            if (apocCount > 0) {
                console.log(`APOC plugin is installed with ${apocCount} procedures.`);
            }
            else {
                console.log('APOC plugin is not installed. Some advanced features may not be available.');
            }
        }
        finally {
            await session.close();
        }
        // Show database information
        const serverInfo = await driver.getServerInfo();
        console.log('Neo4j Server Info:', {
            address: serverInfo.address,
            version: serverInfo.protocolVersion
        });
    }
    catch (error) {
        console.error('Failed to connect to Neo4j database:', error.message);
        if (error.code === 'ServiceUnavailable') {
            console.log('Make sure Neo4j is running and the connection parameters are correct.');
        }
    }
    finally {
        await driver.close();
    }
}
testNeo4jConnection().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
