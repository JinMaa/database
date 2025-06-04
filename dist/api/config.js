"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiConfig = exports.getNetworkConfig = exports.Network = void 0;
var Network;
(function (Network) {
    Network["MAINNET"] = "mainnet";
    Network["OYLNET"] = "oylnet";
})(Network || (exports.Network = Network = {}));
const NETWORK_CONFIGS = {
    [Network.MAINNET]: {
        url: 'https://mainnet.sandshrew.io/v2/',
        blockHeightMethod: 'esplora_block-height',
        getBlockMethod: 'btc_getblock',
        traceViewMethod: 'metashrew_view'
    },
    [Network.OYLNET]: {
        url: process.env.OYLNET_API_URL || 'https://oylnet.oyl.gg/v2/regtest',
        blockHeightMethod: 'esplora_block-height',
        getBlockMethod: 'btc_getblock',
        traceViewMethod: 'metashrew_view'
    }
};
const getNetworkConfig = (network) => {
    return NETWORK_CONFIGS[network];
};
exports.getNetworkConfig = getNetworkConfig;
class ApiConfig {
    constructor(network = Network.MAINNET) {
        this.network = network;
        this.rpcUrl = NETWORK_CONFIGS[this.network].url;
    }
    getUrl() {
        return NETWORK_CONFIGS[this.network].url;
    }
    getBlockHeightMethod() {
        return NETWORK_CONFIGS[this.network].blockHeightMethod;
    }
    getBlockMethod() {
        return NETWORK_CONFIGS[this.network].getBlockMethod;
    }
    getTraceViewMethod() {
        return NETWORK_CONFIGS[this.network].traceViewMethod;
    }
    setNetwork(network) {
        this.network = network;
        this.rpcUrl = NETWORK_CONFIGS[this.network].url;
    }
    getNetwork() {
        return this.network;
    }
}
exports.ApiConfig = ApiConfig;
