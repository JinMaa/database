"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTraceData = analyzeTraceData;
exports.fetchTraceData = fetchTraceData;
exports.analyzeObject = analyzeObject;
const dotenv_1 = __importDefault(require("dotenv"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../api/config");
const traceApi_1 = require("../api/traceApi");
// Load environment variables
dotenv_1.default.config();
// Helper function to inspect nested fields and their types
function analyzeObject(obj, prefix = '', maxDepth = 3, currentDepth = 0) {
    const result = {};
    if (currentDepth >= maxDepth) {
        return { [`${prefix}`]: typeof obj === 'object' ? 'Nested object (depth limit)' : typeof obj };
    }
    if (obj === null) {
        return { [`${prefix}`]: 'null' };
    }
    if (typeof obj !== 'object') {
        let typeInfo = typeof obj;
        if (typeof obj === 'string' && obj.length > 100) {
            typeInfo = `string(${obj.length}) - truncated: ${obj.substring(0, 30)}...`;
        }
        else if (typeof obj === 'bigint' || (typeInfo === 'number' && String(obj).length > 15)) {
            typeInfo = `large number: ${String(obj)}`;
        }
        return { [`${prefix}`]: typeInfo };
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return { [`${prefix}`]: 'empty array' };
        }
        // For arrays, analyze the first few elements to get a sense of the contents
        const sampleSize = Math.min(3, obj.length);
        for (let i = 0; i < sampleSize; i++) {
            const itemResults = analyzeObject(obj[i], `${prefix}[${i}]`, maxDepth, currentDepth + 1);
            Object.assign(result, itemResults);
        }
        if (obj.length > sampleSize) {
            result[`${prefix}`] = `array(${obj.length} items)`;
        }
        return result;
    }
    // For objects, recursively analyze each property
    for (const key of Object.keys(obj)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const valueResults = analyzeObject(obj[key], newPrefix, maxDepth, currentDepth + 1);
        Object.assign(result, valueResults);
    }
    return result;
}
// Function to fetch trace data for a specific protostone
async function fetchTraceData(txid, vout) {
    // Create a TraceApi instance using the correct network
    const network = process.env.NETWORK === 'mainnet' ? config_1.Network.MAINNET : config_1.Network.OYLNET;
    const traceApi = new traceApi_1.TraceApi(network);
    try {
        console.log(`Fetching trace data for txid ${txid} with vout ${vout} using network ${network}`);
        // Get trace data using the TraceApi
        const traceResult = await traceApi.getTransactionTrace(txid, vout);
        if (!traceResult) {
            throw new Error(`No trace data found for ${txid}:${vout}`);
        }
        return traceResult.result;
    }
    catch (error) {
        console.error('Error fetching trace data:', error);
        throw error;
    }
}
// Main function
async function analyzeTraceData() {
    try {
        // Sample transactions with protostones that we know have trace data
        const sampleProtostones = [
            // Format: [txid, vout, description]
            ['4d7ae03fbb63c9eedf0e32311307d00e81d48e4593a182711ef6bbe95ddcb3fe', 4, 'Protostone with multiple events - vout 4'],
            ['4d7ae03fbb63c9eedf0e32311307d00e81d48e4593a182711ef6bbe95ddcb3fe', 5, 'Protostone with multiple events - vout 5'],
        ];
        const outputDir = path_1.default.join(__dirname, '../../trace-analysis');
        await fs_extra_1.default.ensureDir(outputDir);
        for (const [txid, vout, description] of sampleProtostones) {
            console.log(`Fetching trace data for ${txid}:${vout} (${description})...`);
            // Fetch the trace data
            const traceData = await fetchTraceData(txid, vout);
            // Create full analysis
            const analysis = {
                txid,
                vout,
                description,
                eventCount: Array.isArray(traceData) ? traceData.length : 0,
                sampleEvents: [],
                fieldAnalysis: {}
            };
            // Analyze each event type
            if (Array.isArray(traceData) && traceData.length > 0) {
                const eventTypes = new Set(traceData.map(event => event.event));
                console.log(`Found ${traceData.length} events with types: ${Array.from(eventTypes).join(', ')}`);
                // Sample events of each type
                for (const eventType of eventTypes) {
                    const eventsOfType = traceData.filter(event => event.event === eventType);
                    if (eventsOfType.length > 0) {
                        // Take the first event of this type as a sample
                        const sampleEvent = eventsOfType[0];
                        analysis.sampleEvents.push(sampleEvent);
                        // Analyze the structure of this event type
                        analysis.fieldAnalysis[eventType] = analyzeObject(sampleEvent, eventType);
                    }
                }
            }
            else {
                console.log('No trace data found or invalid format');
            }
            // Save the full trace data
            const traceFilePath = path_1.default.join(outputDir, `trace-${txid.substring(0, 8)}-${vout}.json`);
            await fs_extra_1.default.writeJson(traceFilePath, traceData, { spaces: 2 });
            console.log(`Trace data saved to ${traceFilePath}`);
            // Save the analysis
            const analysisFilePath = path_1.default.join(outputDir, `analysis-${txid.substring(0, 8)}-${vout}.json`);
            await fs_extra_1.default.writeJson(analysisFilePath, analysis, { spaces: 2 });
            console.log(`Analysis saved to ${analysisFilePath}`);
        }
        console.log('Analysis complete! Check the trace-analysis directory for results.');
    }
    catch (error) {
        console.error('Error during trace analysis:', error);
    }
}
// Execute if run directly
if (require.main === module) {
    analyzeTraceData().catch(error => {
        console.error('Fatal error during trace analysis:', error);
        process.exit(1);
    });
}
