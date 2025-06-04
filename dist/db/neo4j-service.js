"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.neo4jService = exports.Neo4jService = void 0;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
/**
 * Neo4j service for managing connections and sessions
 */
class Neo4jService {
    constructor() {
        const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
        const user = process.env.NEO4J_USER || 'neo4j';
        const password = process.env.NEO4J_PASSWORD || 'password';
        this.driver = neo4j_driver_1.default.driver(uri, neo4j_driver_1.default.auth.basic(user, password));
    }
    // Singleton pattern to ensure only one instance of the driver exists
    static getInstance() {
        if (!Neo4jService.instance) {
            Neo4jService.instance = new Neo4jService();
        }
        return Neo4jService.instance;
    }
    // Create a new session
    getSession() {
        return this.driver.session();
    }
    // Execute a Cypher query with parameters
    async executeQuery(query, params = {}) {
        const session = this.getSession();
        try {
            return await session.run(query, params);
        }
        finally {
            await session.close();
        }
    }
    // Check connection to Neo4j
    async verifyConnection() {
        try {
            await this.driver.verifyConnectivity();
            return true;
        }
        catch (error) {
            console.error('Failed to connect to Neo4j:', error);
            return false;
        }
    }
    // Close all connections when shutting down
    async close() {
        await this.driver.close();
    }
    // Transaction support
    async executeTransaction(transactionFn) {
        const session = this.getSession();
        const tx = session.beginTransaction();
        try {
            const result = await transactionFn(session);
            await tx.commit();
            return result;
        }
        catch (error) {
            await tx.rollback();
            throw error;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Convert a number to a Neo4j integer
     */
    static asInt(value) {
        return neo4j_driver_1.default.int(value);
    }
    /**
     * Convert a number to a Neo4j float
     */
    static asFloat(value) {
        return Number(value);
    }
}
exports.Neo4jService = Neo4jService;
// Export a singleton instance
exports.neo4jService = Neo4jService.getInstance();
