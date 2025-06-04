// Neo4j connection setup
const neo4j = require('neo4j-driver');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

// Create Neo4j driver instance
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Test connection
async function testConnection() {
  const session = driver.session();
  try {
    await session.run('RETURN 1');
    console.log('Neo4j connection successful');
  } catch (error) {
    console.error('Neo4j connection error:', error);
  } finally {
    await session.close();
  }
}

module.exports = {
  driver,
  testConnection
};
