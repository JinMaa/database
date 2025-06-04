# Technical Context

## Technology Stack

### Core Technologies
- **Node.js** - Runtime environment
- **TypeScript** - Programming language
- **Neo4j** - Graph database
- **Commander.js** - Command-line interface framework

### Dependencies
- **@oyl/sdk** - SDK for interacting with OYL Bitcoin API
- **alkanes** - Library for parsing protostones from Bitcoin transactions
- **neo4j-driver** - Official Neo4j driver for JavaScript
- **axios** - HTTP client for API requests
- **dotenv** - Environment variable management
- **uuid** - Generation of unique identifiers

## Environment Setup

### Neo4j Configuration
The system requires a Neo4j database with:
- Neo4j version 4.4+ (community or enterprise)
- APOC plugin recommended for advanced queries
- Basic authentication enabled
- Sufficient disk space for blockchain data
- Bolt protocol enabled

### Environment Variables
Required in `.env` file:
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OYLNET_API_URL=https://oylnet.oyl.gg/v2/regtest
```

## External API Dependencies

### OYL Bitcoin API
- Provides access to Bitcoin blockchain data
- Supports both mainnet and oylnet networks
- Used for fetching blocks, transactions, and other blockchain data

### Metashrew Trace API
- Provides trace event data for Alkanes protostones
- Uses JSON-RPC interface
- Requires specific request format (see metashrew-api.md memory)

## Development Setup

### Local Development
1. Neo4j database running locally
2. Node.js v16+ installed
3. TypeScript and ts-node installed
4. Environment variables configured

### Code Structure
The codebase follows a modular structure:
- `src/api` - API client implementations
- `src/db` - Database services and repositories
- `src/parsers` - Data parsing utilities
- `src/scripts` - Executable scripts
- `src/types` - TypeScript type definitions
- `src/utils` - Utility functions
- `cypherQueries` - Useful Neo4j queries

## Technical Constraints

### Neo4j Limitations
- Property values must be primitives, arrays, or simple objects
- No support for deeply nested objects or BigInt values
- Maximum property size limits
- Need for proper indexing to maintain performance

### API Rate Limits
- OYL API may have rate limits for production use
- Batch processing recommended to avoid overloading APIs

### Memory Considerations
- Large blocks or transactions may require significant memory
- Buffer management for hex data processing

## Technical Design Decisions

### Avoiding Deep Object Storage
- Neo4j has limitations on complex nested objects
- We store only primitive types and simple arrays as properties
- Complex objects like trace events are simplified to their type

### Protostone Modeling
- Modeled as shadow outputs beyond regular transaction outputs
- Connected to transactions via `:shadow_out` relationship
- Identified by txid and vout (output index)

### Event Node Separation
- Each event type gets its own node connected to a protostone
- Allows for efficient querying of event patterns
- Avoids storing complex trace objects directly

### Coinbase Handling
- Special handling for coinbase transactions
- Proper modeling of coinbase inputs and outputs
- Coinbase labeled outputs for easy identification

### UTXO Tracking
- `:unspent` label added to new outputs
- Label removed when output is spent
- Enables UTXO set analysis and queries
