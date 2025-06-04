# Alkanes Graph Explorer

A web-based explorer for Neo4j graph database containing Alkanes blockchain data. This explorer provides a user-friendly interface to run Cypher queries against your Neo4j database and view the results in interactive tables.

## Features

- View and execute predefined Cypher queries
- Display query results in sortable, searchable tables
- Integration with Metashrew API for additional blockchain data
- Real-time statistics of your Neo4j graph database
- Clean, responsive UI using Bootstrap and DataTables

## Prerequisites

- Node.js (v14+)
- Neo4j Database (with the Alkanes graph data)
- Environment variables in project's root `.env` file

## Installation

1. Navigate to the web-explorer directory:

```bash
cd /path/to/protostone-processor/web-explorer
```

2. Install dependencies:

```bash
npm install
```

## Configuration

The explorer reads the environment variables from the `.env` file in the parent directory. Make sure it contains:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=yourpassword
METASHREW_API_URL=https://oylnet.oyl.gg/v2/regtest
WEB_PORT=3000
```

## Running the Explorer

1. Start the server:

```bash
npm start
```

2. Access the web interface at:

```
http://localhost:3000
```

For development with auto-reload:

```bash
npm run dev
```

## Adding Custom Queries

You can add your own Cypher queries by creating `.cypher` files in the `/protostone-processor/cypherQueries/` directory.

Format for the query files:
- First line can contain a comment with name: `// Query: My Custom Query`
- The rest of the file should contain valid Cypher query syntax

## API Endpoints

The web explorer also provides API endpoints:

- `/api/status` - Get system status including Neo4j and Metashrew sync
- `/api/trace/:txid/:vout` - Get trace data for a specific transaction output

## Technical Details

- Backend: Express.js
- View Engine: EJS
- Database: Neo4j via neo4j-driver
- UI: Bootstrap 5, DataTables, jQuery
- API Integration: Metashrew API for blockchain data

## Troubleshooting

- If you encounter connection issues, check that your Neo4j database is running and accessible
- Ensure your environment variables are correctly set in the `.env` file
- Check that the queries in the cypherQueries directory are valid Cypher syntax
