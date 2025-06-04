const axios = require('axios');

/**
 * Metashrew API client for the web explorer
 * Follows the exact request format required by the Metashrew API
 */
class MetashrewApi {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || process.env.METASHREW_API_URL || 'https://oylnet.oyl.gg/v2/regtest';
  }
  
  /**
   * Call a Metashrew API method following the required JSON-RPC format
   * Field order matters: method, params, id, jsonrpc
   * 
   * @param {string} method - The method name to call
   * @param {Array} params - Array of parameters for the method
   * @returns {Promise<any>} - The API response
   */
  async call(method, params = []) {
    try {
      console.log(`Calling Metashrew API: ${method}`);
      
      // Following the exact required format order: method, params, id, jsonrpc
      const response = await axios.post(this.apiUrl, {
        method: method,  
        params: params,
        id: 0,
        jsonrpc: "2.0"
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Error handling
      if (response.data.error) {
        throw new Error(`Metashrew API Error: ${response.data.error.message}`);
      }
      
      return response.data.result;
    } catch (error) {
      console.error(`Metashrew API error (${method}):`, error.message);
      throw error;
    }
  }
  
  /**
   * Get the current indexer height
   */
  async getHeight() {
    const result = await this.call('metashrew_height');
    return parseInt(result, 10); // Response is a string
  }
  
  /**
   * Get the current Bitcoin node height
   */
  async getBlockCount() {
    return this.call('btc_getblockcount');
  }
  
  /**
   * Call a view function on the Metashrew API
   * 
   * @param {string} viewName - The name of the view function
   * @param {string} input - Hex-encoded input data
   * @param {string} blockTag - Block tag (usually "latest")
   * @returns {Promise<any>} - The view function result
   */
  async view(viewName, input, blockTag = 'latest') {
    return this.call('metashrew_view', [viewName, input, blockTag]);
  }
  
  /**
   * Get trace data for a specific transaction output
   * 
   * @param {string} txid - Transaction ID
   * @param {number} vout - Output index
   * @returns {Promise<any>} - Trace data
   */
  async getTrace(txid, vout) {
    // For trace, we need to pass the outpoint in the format expected by the API
    const outpoint = `${txid}:${vout}`;
    return this.view('trace', outpoint);
  }
  
  /**
   * Get all traces for a block
   * 
   * @param {number} height - Block height
   * @returns {Promise<any>} - Block trace data
   */
  async getBlockTraces(height) {
    return this.view('traceblock', height.toString());
  }
  
  /**
   * Get token inventory for an address
   * 
   * @param {string} address - Bitcoin address
   * @returns {Promise<any>} - Token inventory
   */
  async getAddressTokens(address) {
    return this.view('protorunesbyaddress', address);
  }
}

module.exports = MetashrewApi;
