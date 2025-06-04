require('dotenv').config({ path: '../.env' }); // Use the project's root .env file
const express = require('express');
const path = require('path');
const fs = require('fs');
const neo4j = require('neo4j-driver');
const MetashrewApi = require('./api'); // Import our Metashrew API client

const app = express();
const port = process.env.WEB_PORT || 3000;

// Initialize API clients
const metashrewApi = new MetashrewApi(process.env.METASHREW_API_URL);

// Connect to Neo4j
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Format query name for display
function formatTitle(queryName) {
  return queryName
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Test Neo4j connection
async function testConnection() {
  const session = driver.session();
  try {
    const result = await session.run('RETURN 1 as n');
    console.log('Neo4j connection successful');
  } catch (error) {
    console.error('Neo4j connection error:', error);
  } finally {
    await session.close();
  }
}

testConnection();

// Static file and template setup
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Load Cypher queries from files
const queriesDir = path.join(__dirname, '..', 'cypherQueries');
const analyticsDir = path.join(queriesDir, 'analytics');
const queries = {};
let queryFiles = [];
let analyticsQueries = {};

// Load standard queries
try {
    const files = fs.readdirSync(queriesDir);
    queryFiles = files.filter(file => file.endsWith('.cypher'));
    
    queryFiles.forEach(file => {
        const name = file.replace('.cypher', '');
        const filePath = path.join(queriesDir, file);
        queries[name] = {
          name: formatTitle(name),
          path: name,
          query: fs.readFileSync(filePath, 'utf-8')
        };
    });
    console.log(`Loaded ${queryFiles.length} query files`);
} catch (err) {
    console.error('Error loading query files:', err);
}

// Load analytics queries
try {
    if (fs.existsSync(analyticsDir)) {
        const files = fs.readdirSync(analyticsDir);
        const analyticsFiles = files.filter(file => file.endsWith('.cypher'));
        
        analyticsFiles.forEach(file => {
            const name = file.replace('.cypher', '');
            const filePath = path.join(analyticsDir, file);
            analyticsQueries[name] = {
              name: formatTitle(name),
              path: `analytics/${name}`,
              query: fs.readFileSync(filePath, 'utf-8')
            };
        });
        console.log(`Loaded ${analyticsFiles.length} analytics query files`);
    }
} catch (err) {
    console.error('Error loading analytics query files:', err);
}

// Create Neo4j driver instance

// Analytics section routes
app.get('/analytics', async (req, res) => {
    try {
        // Get all analytics query names
        const analyticsQueryNames = Object.keys(analyticsQueries);
        
        res.render('analytics_index', { 
            analyticsQueryNames,
            title: 'Blockchain Analytics'
        });
    } catch (error) {
        console.error('Error rendering analytics page:', error);
        res.render('error', { 
            message: 'Error loading analytics page', 
            error,
            query: 'Analytics Dashboard' 
        });
    }
});

app.get('/analytics/:queryName', async (req, res) => {
    const { queryName } = req.params;
    
    if (!analyticsQueries[queryName]) {
        return res.render('error', { 
            message: 'Analytics query not found', 
            error: { status: 404 },
            query: queryName
        });
    }
    
    try {
        const session = driver.session();
        const result = await session.run(analyticsQueries[queryName].query);
        const records = result.records;
        await session.close();
        
        // Determine visualization type based on query name
        const visualizationType = determineVisualizationType(queryName);
        
        res.render('analytics_visualization', {
            title: formatTitle(queryName),
            records,
            queryName,
            visualizationType,
            query: analyticsQueries[queryName].query
        });
    } catch (error) {
        console.error(`Error running analytics query ${queryName}:`, error);
        res.render('error', { 
            message: 'Error running analytics query', 
            error,
            query: queryName 
        });
    }
});

// Helper function to determine visualization type
function determineVisualizationType(queryName) {
    // Network/graph visualizations
    if (queryName === 'transfer_network_visualization' || 
        queryName === 'cross_contract_interactions') {
        return 'network';
    }
    
    // Bar charts
    if (queryName === 'most_active_alkanes' || 
        queryName === 'top_token_creators' ||
        queryName === 'event_chain_patterns' ||
        queryName === 'value_concentration') {
        return 'bar';
    }
    
    // Pie charts
    if (queryName === 'event_type_distribution' ||
        queryName === 'success_failure_rates') {
        return 'pie';
    }
    
    // Default to table
    return 'table';
}

// Home route
app.get('/', (req, res) => {
  // Group queries by folder
  const queryGroups = {};
  
  // Process standard queries
  Object.entries(queries).forEach(([name, content]) => {
    // For simple organization, put all standard queries in "Standard" group
    const folder = 'Standard';
    if (!queryGroups[folder]) {
      queryGroups[folder] = [];
    }
    queryGroups[folder].push({
      name: content.name,
      path: content.path,
      query: content.query
    });
  });
  
  // Add analytics queries under "Analytics" group
  if (Object.keys(analyticsQueries).length > 0) {
    queryGroups['Analytics'] = [];
    Object.entries(analyticsQueries).forEach(([name, content]) => {
      queryGroups['Analytics'].push({
        name: content.name,
        path: content.path,
        query: content.query
      });
    });
  }

  res.render('index', { 
    title: 'Neo4j Alkanes Explorer',
    queries: queryGroups,
    queryGroups
  });
});

// Query execution route
app.get('/query/:file', async (req, res) => {
  const file = req.params.file;
  
  if (!queries[file]) {
    return res.status(404).send('Query not found');
  }
  
  const session = driver.session();
  
  try {
    console.log(`Executing query: ${file}`);
    const result = await session.run(queries[file].query);
    const records = result.records.map(record => {
      const obj = {};
      record.keys.forEach(key => {
        let value = record.get(key);
        // Handle neo4j integers
        if (value && typeof value.toNumber === 'function') {
          value = value.toNumber();
        }
        obj[key] = value;
      });
      return obj;
    });
    
    // Special case for the execution flow query - use the callstack view
    if (file === 'protostone_execution_flow') {
      return res.render('callstack', {
        title: formatTitle(file),
        queryName: formatTitle(file),
        queryPath: file,
        query: queries[file].query,
        results: records
      });
    }
    
    res.render('results', {
      title: formatTitle(file),
      queryName: formatTitle(file),
      queryPath: file,
      query: queries[file].query,
      results: records,
      columns: records.length > 0 ? Object.keys(records[0]) : []
    });
  } catch (error) {
    console.error('Error executing query:', error);
    res.render('error', { 
      title: 'Error',
      error: error.message,
      query: queries[file].query
    });
  } finally {
    await session.close();
  }
});

// Direct Call Stack view route
app.get('/callstack', async (req, res) => {
  const file = 'protostone_execution_flow';
  
  if (!queries[file]) {
    return res.status(404).send('Call stack query not found');
  }
  
  const session = driver.session();
  
  try {
    console.log(`Executing call stack visualization query`);
    const result = await session.run(queries[file].query);
    const records = result.records.map(record => {
      const obj = {};
      record.keys.forEach(key => {
        obj[key] = record.get(key);
      });
      return obj;
    });
    
    res.render('callstack', {
      title: 'Call Stack Visualization',
      queryName: formatTitle(file),
      queryPath: file,
      query: queries[file].query,
      results: records
    });
  } catch (error) {
    console.error('Error executing call stack query:', error);
    res.render('error', { 
      title: 'Error',
      error: error.message,
      query: queries[file].query
    });
  } finally {
    await session.close();
  }
});

// Performance Dashboard route
app.get('/dashboard', async (req, res) => {
  const file = 'performance_metrics';
  
  if (!queries[file]) {
    return res.status(404).send('Performance metrics query not found');
  }
  
  const session = driver.session();
  
  try {
    console.log(`Executing performance dashboard query`);
    const result = await session.run(queries[file].query);
    const records = result.records.map(record => {
      const obj = {};
      record.keys.forEach(key => {
        obj[key] = record.get(key);
      });
      return obj;
    });
    
    res.render('dashboard', {
      title: 'Performance Dashboard',
      queryName: formatTitle(file),
      queryPath: file,
      query: queries[file].query,
      results: records
    });
  } catch (error) {
    console.error('Error executing dashboard query:', error);
    res.render('error', { 
      title: 'Error',
      error: error.message,
      query: queries[file].query
    });
  } finally {
    await session.close();
  }
});

// API Routes for Metashrew integration
app.get('/api/status', async (req, res) => {
  try {
    // Get both indexer height and Neo4j stats
    const [indexerHeight, blockCount, neo4jStats] = await Promise.all([
      metashrewApi.getHeight(),
      metashrewApi.getBlockCount(),
      getGraphStats()
    ]);
    
    res.json({
      status: 'success',
      metashrew: {
        indexerHeight,
        blockCount,
        syncPercentage: blockCount > 0 ? Math.min(100, (indexerHeight / blockCount) * 100) : 0
      },
      neo4j: neo4jStats
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API route to get trace data for a specific transaction output
app.get('/api/trace/:txid/:vout', async (req, res) => {
  try {
    const { txid, vout } = req.params;
    const trace = await metashrewApi.getTrace(txid, parseInt(vout, 10));
    
    res.json({
      status: 'success',
      txid,
      vout: parseInt(vout, 10),
      trace
    });
  } catch (error) {
    console.error('Error getting trace data:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Helper function to get Neo4j graph stats
async function getGraphStats() {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (block:block) WITH count(block) as blockCount
      MATCH (tx:tx) WITH blockCount, count(tx) as txCount
      MATCH (output:output) WITH blockCount, txCount, count(output) as outputCount
      MATCH (protostone:protostone) WITH blockCount, txCount, outputCount, count(protostone) as protostoneCount
      MATCH (address:address) WITH blockCount, txCount, outputCount, protostoneCount, count(address) as addressCount
      MATCH (event:event) WITH blockCount, txCount, outputCount, protostoneCount, addressCount, count(event) as eventCount
      MATCH (alkane:alkane) WITH blockCount, txCount, outputCount, protostoneCount, addressCount, eventCount, count(alkane) as alkaneCount
      RETURN {
        blockCount: blockCount,
        txCount: txCount,
        outputCount: outputCount,
        protostoneCount: protostoneCount,
        addressCount: addressCount,
        eventCount: eventCount,
        alkaneCount: alkaneCount
      } as stats
    `);

    if (result.records.length > 0) {
      const stats = result.records[0].get('stats');
      return {
        blockCount: stats.blockCount.toNumber(),
        txCount: stats.txCount.toNumber(),
        outputCount: stats.outputCount.toNumber(),
        protostoneCount: stats.protostoneCount.toNumber(),
        addressCount: stats.addressCount.toNumber(),
        eventCount: stats.eventCount.toNumber(),
        alkaneCount: stats.alkaneCount.toNumber()
      };
    }

    return {
      blockCount: 0,
      txCount: 0,
      outputCount: 0,
      protostoneCount: 0,
      addressCount: 0,
      eventCount: 0,
      alkaneCount: 0
    };
  } finally {
    await session.close();
  }
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`View the web explorer at: http://localhost:${port}`);
});

// Handle shutdown
process.on('SIGINT', async () => {
  await driver.close();
  console.log('Neo4j connection closed');
  process.exit(0);
});
