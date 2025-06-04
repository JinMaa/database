import neo4j, { Driver, Session, Integer, Result } from 'neo4j-driver';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Neo4j service for managing connections and sessions
 */
export class Neo4jService {
  private driver: Driver;
  private static instance: Neo4jService;

  private constructor() {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';

    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  // Singleton pattern to ensure only one instance of the driver exists
  public static getInstance(): Neo4jService {
    if (!Neo4jService.instance) {
      Neo4jService.instance = new Neo4jService();
    }
    return Neo4jService.instance;
  }

  // Create a new session
  public getSession(): Session {
    return this.driver.session();
  }

  // Execute a Cypher query with parameters
  public async executeQuery(
    query: string, 
    params: Record<string, any> = {}
  ): Promise<Result> {
    const session = this.getSession();
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  // Check connection to Neo4j
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error);
      return false;
    }
  }

  // Close all connections when shutting down
  public async close(): Promise<void> {
    await this.driver.close();
  }

  // Transaction support
  public async executeTransaction(
    transactionFn: (session: Session) => Promise<any>
  ): Promise<any> {
    const session = this.getSession();
    const tx = session.beginTransaction();
    
    try {
      const result = await transactionFn(session);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }
  
  /**
   * Convert a number to a Neo4j integer
   */
  static asInt(value: number): any {
    return neo4j.int(value);
  }

  /**
   * Convert a number to a Neo4j float
   */
  static asFloat(value: number): number {
    return Number(value);
  }
}

// Export a singleton instance
export const neo4jService = Neo4jService.getInstance();
