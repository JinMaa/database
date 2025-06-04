#!/usr/bin/env node

import { Neo4jService } from '../db/neo4j-service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Fix incorrect coinbase transaction relationships
 * This is a one-time script to repair the data model 
 */
async function fixCoinbaseRelationships(): Promise<void> {
  const neo4jService = Neo4jService.getInstance();
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
    } else {
      console.warn(`⚠️ Verification failed: ${remainingCount} incorrect relationships still remain`);
    }
    
  } catch (error) {
    console.error('Error fixing coinbase relationships:', error);
    process.exit(1);
  } finally {
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
