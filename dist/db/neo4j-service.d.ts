import { Session, Result } from 'neo4j-driver';
/**
 * Neo4j service for managing connections and sessions
 */
export declare class Neo4jService {
    private driver;
    private static instance;
    private constructor();
    static getInstance(): Neo4jService;
    getSession(): Session;
    executeQuery(query: string, params?: Record<string, any>): Promise<Result>;
    verifyConnection(): Promise<boolean>;
    close(): Promise<void>;
    executeTransaction(transactionFn: (session: Session) => Promise<any>): Promise<any>;
    /**
     * Convert a number to a Neo4j integer
     */
    static asInt(value: number): any;
    /**
     * Convert a number to a Neo4j float
     */
    static asFloat(value: number): number;
}
export declare const neo4jService: Neo4jService;
