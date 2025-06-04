# Protostone Processor Project Brief

## Project Vision
Create a robust system to extract Bitcoin block data, identify Alkanes protostones, process their trace information, and store everything in a Neo4j graph database with proper relationships between blocks, transactions, outputs, addresses, protostones, and trace event types.

## Core Requirements

1. **Blockchain Data Processing**
   - Extract full block, transaction, input, and output data from Bitcoin blockchain
   - Support for both mainnet and oylnet networks via OYL API
   - Proper handling of all Bitcoin protocol constructs (coinbase, UTXOs, etc.)

2. **Protostone Extraction**
   - Identify and extract protostones from transaction data using alkanes library
   - Maintain the connection between protostones and their parent transactions
   - Model protostones as "shadow outputs" (vout values beyond real outputs)

3. **Trace Event Integration**
   - Fetch trace event data for each protostone from Metashrew API
   - Store only event types as separate nodes connected to protostones
   - Avoid storing full trace event data which can cause Neo4j type errors (to be fixed at some point)

4. **Neo4j Graph Model**
   - Implement an efficient Neo4j graph database model
   - Store proper relationships between blockchain components
   - Apply appropriate indexes and constraints for performance
   - Track UTXO state with unspent/spent labels

5. **Sync System**
   - Command-line interface for syncing block ranges
   - Batch processing with error handling
   - Skip existing blocks for efficient re-syncing
   - Progress reporting and statistics

## Non-Requirements
- No need for real-time updates/subscriptions
- No web UI required, CLI is sufficient
- No need for extensive querying capabilities beyond the provided Cypher queries

## Success Criteria
- Successfully sync full blocks, transactions, and outputs to Neo4j
- Correctly identify and store protostones with their event types
- Maintain proper Bitcoin protocol relationships
- Support querying for analytics
- Clean, maintainable codebase with clear documentation
