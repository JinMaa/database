"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtostoneRepository = void 0;
const neo4j_service_1 = require("./neo4j-service");
const uuid_1 = require("uuid");
/**
 * Repository for storing and querying protostones, blocks, transactions, and outputs in Neo4j
 */
class ProtostoneRepository {
    constructor() {
        this.neo4jService = neo4j_service_1.Neo4jService.getInstance();
    }
    /**
     * Creates Neo4j constraints and indexes if they don't exist
     */
    async setupDatabase() {
        const session = this.neo4jService.getSession();
        try {
            // Create constraints similar to bitcoin-to-neo4j
            await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (b:block) REQUIRE b.hash IS UNIQUE`);
            await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (t:tx) REQUIRE t.txid IS UNIQUE`);
            await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (o:output) REQUIRE o.index IS UNIQUE`);
            await session.run(`CREATE INDEX IF NOT EXISTS FOR (b:block) ON (b.height)`);
            await session.run(`CREATE INDEX IF NOT EXISTS FOR (a:address) ON (a.address)`);
            // Add protostone specific indexes
            await session.run(`CREATE INDEX IF NOT EXISTS FOR (p:protostone) ON (p.hex)`);
            console.log('Neo4j database schema setup complete');
        }
        catch (error) {
            console.error('Error setting up database schema:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Clears all protostone data from the database (for testing)
     */
    async clearProtostoneData() {
        const session = this.neo4jService.getSession();
        try {
            await session.run(`
        MATCH (p:protostone)
        DETACH DELETE p
      `);
            console.log('Protostone data cleared from database');
        }
        catch (error) {
            console.error('Error clearing protostone data:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Store a block and all its transactions, inputs, outputs, and protostones in Neo4j
     */
    async storeBlock(block) {
        const session = this.neo4jService.getSession();
        try {
            // Make a copy of the block and remove hex property as it can be too large for Neo4j
            const blockForNeo4j = { ...block };
            // @ts-ignore
            if (blockForNeo4j.hex)
                delete blockForNeo4j.hex;
            // Start a transaction
            const txc = session.beginTransaction();
            try {
                // Check if this is the genesis block
                const isGenesisBlock = blockForNeo4j.height === 0 || !blockForNeo4j.previousblockhash || blockForNeo4j.previousblockhash === '0000000000000000000000000000000000000000000000000000000000000000000000';
                if (isGenesisBlock) {
                    // Special handling for genesis block (no previous block)
                    await txc.run(`
            MERGE (block:block {hash: $blockhash})
            SET
              block.size = $blocksize,
              block.txcount = $txcount,
              block.version = $version,
              block.prevblock = $prevblock,
              block.merkleroot = $merkleroot,
              block.time = $timestamp,
              block.bits = $bits,
              block.nonce = $nonce,
              block.height = $height
            RETURN block
          `, {
                        blockhash: blockForNeo4j.hash,
                        blocksize: blockForNeo4j.size,
                        txcount: blockForNeo4j.tx.length,
                        version: blockForNeo4j.version,
                        prevblock: blockForNeo4j.previousblockhash || '0000000000000000000000000000000000000000000000000000000000000000000',
                        merkleroot: blockForNeo4j.merkleroot,
                        timestamp: blockForNeo4j.time,
                        bits: blockForNeo4j.bits,
                        nonce: blockForNeo4j.nonce,
                        height: blockForNeo4j.height
                    });
                }
                else {
                    // Normal block with chain relationship to previous block
                    await txc.run(`
            MERGE (block:block {hash: $blockhash})
            SET
              block.size = $blocksize,
              block.txcount = $txcount,
              block.version = $version,
              block.prevblock = $prevblock,
              block.merkleroot = $merkleroot,
              block.time = $timestamp,
              block.bits = $bits,
              block.nonce = $nonce,
              block.height = $height
            
            // Create Chain relationship if previous block exists
            WITH block
            MATCH (prevblock:block {hash: $prevblock})
            MERGE (block)-[:chain]->(prevblock)
            RETURN block
          `, {
                        blockhash: blockForNeo4j.hash,
                        blocksize: blockForNeo4j.size,
                        txcount: blockForNeo4j.tx.length,
                        version: blockForNeo4j.version,
                        prevblock: blockForNeo4j.previousblockhash,
                        merkleroot: blockForNeo4j.merkleroot,
                        timestamp: blockForNeo4j.time,
                        bits: blockForNeo4j.bits,
                        nonce: blockForNeo4j.nonce,
                        height: blockForNeo4j.height
                    });
                }
                // 2. Process each transaction in the block
                for (let txIndex = 0; txIndex < blockForNeo4j.tx.length; txIndex++) {
                    const tx = blockForNeo4j.tx[txIndex];
                    // Check if it's a coinbase transaction (first transaction in the block)
                    const isCoinbase = txIndex === 0;
                    if (isCoinbase) {
                        await this.storeCoinbaseTransaction(txc, tx, blockForNeo4j.hash, txIndex);
                    }
                    else {
                        await this.storeTransaction(txc, tx, blockForNeo4j.hash, txIndex);
                    }
                }
                // 3. Process any protostones in the block
                for (const tx of blockForNeo4j.tx) {
                    // Fetch protostones for this transaction if available
                    const protostones = tx.protostones;
                    if (protostones && protostones.length > 0) {
                        await this.storeProtostones(txc, tx.txid, protostones);
                    }
                }
                // Commit the transaction
                await txc.commit();
            }
            catch (error) {
                // Rollback on error
                await txc.rollback();
                throw error;
            }
        }
        catch (error) {
            console.error(`Error storing block ${block.hash}:`, error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Extract transaction properties for storage
     */
    getTxProperties(tx) {
        return {
            version: tx.version,
            size: tx.size,
            vsize: tx.vsize,
            weight: tx.weight,
            locktime: tx.locktime,
            hex: tx.hex
        };
    }
    /**
     * Store a coinbase transaction with its outputs
     */
    async storeCoinbaseTransaction(txc, tx, blockhash, txIndex) {
        // Create the transaction node and link it to the block
        await txc.run(`
      MATCH (block:block {hash: $blockhash})
      MERGE (tx:tx {txid: $txid})
      MERGE (tx)-[:inc {i: $txIndex}]->(block)
      SET tx += $txData
      
      // Create coinbase output - coinbase transactions only generate outputs, they don't have inputs
      MERGE (coinbase:output:coinbase {index: $coinbaseIndex})
      MERGE (tx)-[:out {vout: 0}]->(coinbase)
      SET coinbase.value = $coinbaseReward, // Set coinbase reward
          coinbase.scriptPubKey = $scriptPubKey
      
      RETURN tx.txid
    `, {
            blockhash,
            txid: tx.txid,
            txData: this.getTxProperties(tx),
            txIndex: neo4j_service_1.Neo4jService.asInt(txIndex),
            coinbaseIndex: `${tx.txid}:0`, // Coinbase output index
            coinbaseReward: neo4j_service_1.Neo4jService.asFloat(50), // Initial block reward (will be adjusted based on block height in future)
            scriptPubKey: tx.vout && tx.vout[0] ? tx.vout[0].scriptPubKey?.hex || '' : ''
        });
        // Process additional outputs in the coinbase transaction (if any)
        if (tx.vout && tx.vout.length > 1) {
            for (let i = 1; i < tx.vout.length; i++) {
                await this.storeOutput(txc, tx, tx.vout[i], i);
            }
        }
    }
    /**
     * Store a regular transaction with its inputs and outputs
     */
    async storeTransaction(txc, tx, blockhash, txIndex) {
        // Create the transaction node and link it to the block
        await txc.run(`
      MATCH (block:block {hash: $blockhash})
      MERGE (tx:tx {txid: $txid})
      MERGE (tx)-[:inc {i: $txIndex}]->(block)
      SET tx += $txData
      RETURN tx.txid
    `, {
            blockhash,
            txid: tx.txid,
            txIndex,
            txData: this.getTxProperties(tx)
        });
        // Process inputs
        for (let vin = 0; vin < tx.vin.length; vin++) {
            const input = tx.vin[vin];
            // Skip if it's a coinbase input
            if (!input.txid || !input.vout) {
                continue;
            }
            // Connect input to this transaction
            await txc.run(`
        MATCH (tx:tx {txid: $txid})
        MERGE (prevout:output {index: $prevOutIndex})
        MERGE (prevout)-[:in {
          vin: $vin, 
          scriptSig: $scriptSig, 
          sequence: $sequence,
          witness: $witness
        }]->(tx)
        REMOVE prevout:unspent
        RETURN tx.txid
      `, {
                txid: tx.txid,
                prevOutIndex: `${input.txid}:${input.vout}`,
                vin,
                scriptSig: input.scriptSig?.hex || '',
                sequence: input.sequence,
                witness: input.txinwitness ? JSON.stringify(input.txinwitness) : ''
            });
        }
        // Process outputs
        for (let vout = 0; vout < tx.vout.length; vout++) {
            const output = tx.vout[vout];
            await this.storeOutput(txc, tx.txid, output, vout);
        }
        // Calculate fee
        await txc.run(`
      MATCH (tx:tx {txid: $txid})
      MATCH (i:output)-[:in]->(tx)
      WITH tx, sum(i.value) - $outTotal as fee
      SET tx.fee = fee
      RETURN fee
    `, {
            txid: tx.txid,
            outTotal: tx.vout.reduce((sum, out) => sum + out.value, 0)
        });
    }
    /**
     * Store a transaction output and link it to address if applicable
     */
    async storeOutput(txc, txid, output, index) {
        const outputIndex = `${txid}:${index}`;
        // Check if output already exists to avoid duplicate errors
        const existsResult = await txc.run('MATCH (o:output {index: $index}) RETURN count(o) as count', { index: outputIndex });
        const exists = existsResult.records[0].get('count').toNumber() > 0;
        if (exists) {
            // Skip creating if it already exists
            console.log(`Output ${outputIndex} already exists, skipping creation`);
            return;
        }
        // Create output node and relationship to transaction
        await txc.run(`
      MERGE (tx:tx {txid: $txid})
      CREATE (out:output:unspent {index: $index})
      CREATE (tx)-[:out {vout: $vout}]->(out)
      SET out.value = $value,
          out.scriptPubKey = $scriptPubKey
      
      // Create address node if scriptPubKey has a valid address
      WITH out, $addresses as addresses
      WHERE addresses <> ""
      MERGE (addr:address {address: addresses})
      CREATE (out)-[:locked]->(addr)
      
      RETURN out
    `, {
            txid,
            index: outputIndex,
            vout: neo4j_service_1.Neo4jService.asInt(index),
            value: neo4j_service_1.Neo4jService.asFloat(output.value || 0),
            scriptPubKey: output.scriptPubKey?.hex || '',
            addresses: output.scriptPubKey?.addresses ? output.scriptPubKey.addresses[0] : ''
        });
    }
    /**
     * Store protostones as shadow outputs (virtual outputs) for a transaction
     */
    async storeProtostones(txc, txid, protostones) {
        // Process each protostone
        for (let i = 0; i < protostones.length; i++) {
            const protostone = protostones[i];
            // Check if the protostone has the required fields
            if (!protostone) {
                console.warn(`Skipping undefined protostone for tx ${txid}`);
                continue;
            }
            try {
                // Convert the protostone data to a safe format
                const safeProtostone = this.deepProcessObject(protostone);
                // Extract core fields
                const vout = safeProtostone.vout || (i + 1000);
                // Store simplified protostone with minimal required fields
                await txc.run(`
          MATCH (tx:tx {txid: $txid})
          CREATE (shadow:protostone:shadow_vout {
            id: $id,
            txid: $txid,
            vout: $vout,
            data: $data
          })
          CREATE (tx)-[:shadow_out]->(shadow)
          RETURN shadow.id
        `, {
                    id: (0, uuid_1.v4)(),
                    txid,
                    vout: neo4j_service_1.Neo4jService.asInt(vout),
                    data: JSON.stringify(safeProtostone)
                });
            }
            catch (error) {
                console.error(`Error storing protostone for tx ${txid}:`, error);
                // Don't throw, continue with other protostones
            }
        }
    }
    /**
     * Deep process an object to handle BigInt and other problematic types
     */
    deepProcessObject(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }
        // Handle BigInt directly
        if (typeof obj === 'bigint') {
            return obj.toString();
        }
        // Handle Buffer objects
        if (Buffer.isBuffer(obj)) {
            return obj.toString('hex');
        }
        // Handle arrays recursively
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepProcessObject(item));
        }
        // Special case for hex fields that are extremely large
        if (typeof obj === 'string' && (obj.startsWith('0x') || /^[0-9a-fA-F]+$/.test(obj)) && obj.length > 10000) {
            return `[Large hex data: ${obj.length} chars]`;
        }
        // Handle objects recursively
        if (typeof obj === 'object') {
            const result = {};
            // Skip certain extremely large fields known to cause issues
            if (obj.hex && typeof obj.hex === 'string' && obj.hex.length > 10000) {
                result.hex = `[Large hex data: ${obj.hex.length} chars]`;
            }
            for (const key in obj) {
                // Skip known problematic fields
                if (key === 'hex' && typeof obj[key] === 'string' && obj[key].length > 10000) {
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    try {
                        result[key] = this.deepProcessObject(obj[key]);
                    }
                    catch (error) {
                        // If we have issues processing a specific field, provide a placeholder
                        console.warn(`Error processing field ${key}:`, error);
                        result[key] = `[Error processing data for ${key}]`;
                    }
                }
            }
            return result;
        }
        // Return primitive values as is
        return obj;
    }
    /**
     * Safely stringify a JSON object, handling circular references and BigInt values
     */
    safeJsonStringify(obj) {
        try {
            // First process the object to handle special types
            const processed = this.deepProcessObject(obj);
            // Maximum allowed size for string data in Neo4j properties
            const MAX_PROPERTY_SIZE = 32000; // Neo4j has limits around 32KB for string properties
            // Use a replacer function to handle circular references
            const stringified = JSON.stringify(processed, (key, value) => {
                // Truncate very large string values
                if (typeof value === 'string' && value.length > MAX_PROPERTY_SIZE) {
                    return value.substring(0, MAX_PROPERTY_SIZE) + '... [truncated]';
                }
                return value;
            });
            // Final size check
            if (stringified.length > MAX_PROPERTY_SIZE) {
                // If the result is still too large, truncate at the JSON level
                return JSON.stringify({
                    _truncated: true,
                    _original_size: stringified.length,
                    _message: "Data was too large for Neo4j and has been truncated"
                });
            }
            return stringified;
        }
        catch (error) {
            console.error('Error stringifying object:', error);
            return JSON.stringify({
                _error: true,
                _message: `Could not stringify object: ${error?.message || 'Unknown error'}`
            });
        }
    }
    /**
     * Query for protostones by transaction ID
     */
    async getProtostonesByTxid(txid) {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run(`
        MATCH (tx:tx {txid: $txid})-[:shadow_out]->(p:protostone:shadow_vout)
        RETURN p
      `, { txid });
            return result.records.map(record => {
                const protostone = record.get('p').properties;
                if (protostone.data) {
                    try {
                        protostone.data = JSON.parse(protostone.data);
                    }
                    catch (e) {
                        // Ignore parse error, keep as string
                    }
                }
                return protostone;
            });
        }
        catch (error) {
            console.error('Error fetching protostones by txid:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Query for blocks with protostones
     */
    async getBlocksWithProtostones(limit = 10, skip = 0) {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run(`
        MATCH (b:block)<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)
        RETURN DISTINCT b.hash as hash, b.height as height, count(p) as protostoneCount
        ORDER BY b.height DESC
        SKIP $skip
        LIMIT $limit
      `, { limit: neo4j_service_1.Neo4jService.asInt(limit), skip: neo4j_service_1.Neo4jService.asInt(skip) });
            return result.records.map(record => ({
                hash: record.get('hash'),
                height: record.get('height').toNumber(),
                protostoneCount: record.get('protostoneCount').toNumber()
            }));
        }
        catch (error) {
            console.error('Error fetching blocks with protostones:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Query for transactions containing protostones in a specific block
     */
    async getProtostoneTransactionsByBlock(blockHash) {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run(`
        MATCH (b:block {hash: $blockHash})<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)
        RETURN tx.txid as txid, count(p) as protostoneCount
        ORDER BY tx.txid
      `, { blockHash });
            return result.records.map(record => ({
                txid: record.get('txid'),
                protostoneCount: record.get('protostoneCount').toNumber()
            }));
        }
        catch (error) {
            console.error('Error fetching protostone transactions by block:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Get protostone protocols with counts
     */
    async getProtostoneProtocols() {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run(`
        MATCH (p:protostone)
        RETURN p.protocol as protocol, count(*) as count
        ORDER BY count DESC
      `);
            return result.records.map(record => ({
                protocol: record.get('protocol'),
                count: record.get('count').toNumber()
            }));
        }
        catch (error) {
            console.error('Error fetching protostone protocols:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Verify the graph model by retrieving counts of different node types
     */
    async verifyGraphModel() {
        const session = this.neo4jService.getSession();
        try {
            // Get counts of different node types
            const counts = await session.run(`
        MATCH (b:block) WITH count(b) as blockCount
        OPTIONAL MATCH (t:tx) WITH blockCount, count(t) as txCount
        OPTIONAL MATCH (o:output) WITH blockCount, txCount, count(o) as outputCount
        OPTIONAL MATCH (p:protostone) WITH blockCount, txCount, outputCount, count(p) as protostoneCount
        OPTIONAL MATCH (a:address) WITH blockCount, txCount, outputCount, protostoneCount, count(a) as addressCount
        RETURN blockCount, txCount, outputCount, protostoneCount, addressCount
      `);
            // Handle empty database case
            if (counts.records.length === 0) {
                return {
                    blockCount: 0,
                    txCount: 0,
                    outputCount: 0,
                    protostoneCount: 0,
                    addressCount: 0
                };
            }
            const record = counts.records[0];
            return {
                blockCount: record.get('blockCount')?.toNumber() || 0,
                txCount: record.get('txCount')?.toNumber() || 0,
                outputCount: record.get('outputCount')?.toNumber() || 0,
                protostoneCount: record.get('protostoneCount')?.toNumber() || 0,
                addressCount: record.get('addressCount')?.toNumber() || 0
            };
        }
        catch (error) {
            console.error('Error verifying graph model:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Check if a block exists in the database
     * @param height Block height
     * @returns True if the block exists
     */
    async blockExists(height) {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run('MATCH (b:block {height: $height}) RETURN count(b) as count', { height });
            const count = result.records[0].get('count').toNumber();
            return count > 0;
        }
        finally {
            session.close();
        }
    }
    /**
     * Get the range of block heights
     * @returns Object with min and max block heights
     */
    async getBlockHeightRange() {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run('MATCH (b:block) RETURN min(b.height) as min, max(b.height) as max');
            if (result.records.length === 0) {
                return { min: 0, max: 0 };
            }
            const minHeight = result.records[0].get('min').toNumber();
            const maxHeight = result.records[0].get('max').toNumber();
            return { min: minHeight, max: maxHeight };
        }
        finally {
            session.close();
        }
    }
    /**
     * Find missing blocks in a range
     * @param startHeight Start height
     * @param endHeight End height
     * @returns Array of missing block heights
     */
    async findMissingBlocks(startHeight, endHeight) {
        const session = this.neo4jService.getSession();
        try {
            // Create a range of all expected heights
            let missingBlocks = [];
            for (let height = startHeight; height <= endHeight; height++) {
                const result = await session.run('MATCH (b:block {height: $height}) RETURN count(b) as count', { height });
                const count = result.records[0].get('count').toNumber();
                if (count === 0) {
                    missingBlocks.push(height);
                }
            }
            return missingBlocks;
        }
        finally {
            session.close();
        }
    }
    /**
     * Get top blocks by protostone count
     * @param limit Number of blocks to return
     * @returns Array of blocks with their protostone counts
     */
    async getProtostonesPerBlock(limit = 10) {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run(`
        MATCH (b:block)<-[:inc]-(tx:tx)-[:shadow_out]->(p:protostone)
        WITH b, count(p) as protostone_count
        RETURN b.height as height, b.hash as hash, protostone_count as count
        ORDER BY count DESC
        LIMIT $limit
      `, { limit: neo4j_service_1.Neo4jService.asInt(limit) });
            return result.records.map(record => ({
                height: record.get('height').toNumber(),
                hash: record.get('hash'),
                count: record.get('count').toNumber()
            }));
        }
        finally {
            session.close();
        }
    }
    /**
     * Get top blocks by transaction count
     * @param limit Number of blocks to return
     * @returns Array of blocks with their transaction counts
     */
    async getTransactionsPerBlock(limit = 10) {
        const session = this.neo4jService.getSession();
        try {
            const result = await session.run(`
        MATCH (b:block)<-[:inc]-(tx:tx)
        WITH b, count(tx) as tx_count
        RETURN b.height as height, b.hash as hash, tx_count as count
        ORDER BY count DESC
        LIMIT $limit
      `, { limit: neo4j_service_1.Neo4jService.asInt(limit) });
            return result.records.map(record => ({
                height: record.get('height').toNumber(),
                hash: record.get('hash'),
                count: record.get('count').toNumber()
            }));
        }
        finally {
            session.close();
        }
    }
    /**
     * Clear all data from the database
     */
    async clearAllData() {
        const session = this.neo4jService.getSession();
        try {
            // First remove all relationships
            await session.run('MATCH ()-[r]-() DELETE r');
            // Then remove all nodes
            await session.run('MATCH (n) DELETE n');
            console.log('All data cleared from Neo4j');
        }
        finally {
            session.close();
        }
    }
    /**
     * Fix incorrect coinbase transaction relationships
     * This removes all [:in] relationships from :coinbase outputs to transactions
     */
    async fixCoinbaseRelationships() {
        const session = this.neo4jService.getSession();
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
            return { removed: removedCount };
        }
        catch (error) {
            console.error('Error fixing coinbase relationships:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Processes and stores trace data for a protostone, creating event nodes
     * connected to the protostone node
     *
     * @param txid Transaction ID
     * @param vout Virtual output index
     * @param traceData Trace event data from the API
     * @returns Number of trace events stored
     */
    async storeProtostoneTraceEvents(txid, vout, traceData) {
        const session = this.neo4jService.getSession();
        try {
            console.log(`Storing trace events for protostone at ${txid}:${vout}`);
            if (!traceData || !traceData.result || !Array.isArray(traceData.result)) {
                console.warn(`No trace events found for ${txid}:${vout}`);
                return 0;
            }
            // Collect all event types from the trace data
            const eventTypes = traceData.result.map((event) => event.event || 'unknown');
            // Store the event types as a property on the protostone node itself
            // This is much more efficient than creating separate event nodes
            const result = await session.run(`
        MATCH (p:protostone {txid: $txid, vout: $vout})
        SET p.event_types = $eventTypes,
            p.event_count = $eventCount
        RETURN p
      `, {
                txid,
                vout,
                eventTypes: eventTypes,
                eventCount: eventTypes.length
            });
            if (result.records.length > 0) {
                console.log(`✅ Stored ${eventTypes.length} event types for protostone at ${txid}:${vout}`);
                return eventTypes.length;
            }
            else {
                console.warn(`No protostone found at ${txid}:${vout} to attach event types`);
                return 0;
            }
        }
        catch (error) {
            console.error(`Error storing trace events for protostone at ${txid}:${vout}:`, error);
            return 0; // Continue with other protostones instead of failing the entire batch
        }
        finally {
            await session.close();
        }
    }
    /**
     * Processes and stores trace data for multiple protostones
     *
     * @param traceResults Map of transaction ID + vout to trace results
     * @returns Number of protostones with trace events stored
     */
    async storeMultipleProtostoneTraces(traceResults) {
        if (!traceResults || Object.keys(traceResults).length === 0) {
            console.warn('No trace results provided to store');
            return 0;
        }
        let successCount = 0;
        for (const [key, traceData] of Object.entries(traceResults)) {
            try {
                // Key format is "txid:vout"
                const [txid, voutStr] = key.split(':');
                const vout = parseInt(voutStr, 10);
                if (!txid || isNaN(vout)) {
                    console.warn(`Invalid trace key format: ${key}, skipping`);
                    continue;
                }
                const eventsStored = await this.storeProtostoneTraceEvents(txid, vout, traceData);
                if (eventsStored > 0) {
                    successCount++;
                }
            }
            catch (error) {
                console.error(`Error storing trace for ${key}:`, error);
            }
        }
        return successCount;
    }
}
exports.ProtostoneRepository = ProtostoneRepository;
