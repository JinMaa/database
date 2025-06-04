declare function analyzeObject(obj: any, prefix?: string, maxDepth?: number, currentDepth?: number): Record<string, any>;
declare function fetchTraceData(txid: string, vout: number): Promise<any>;
declare function analyzeTraceData(): Promise<void>;
export { analyzeTraceData, fetchTraceData, analyzeObject };
