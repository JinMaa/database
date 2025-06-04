export declare enum Network {
    MAINNET = "mainnet",
    OYLNET = "oylnet"
}
interface NetworkConfig {
    url: string;
    blockHeightMethod: string;
    getBlockMethod: string;
    traceViewMethod: string;
}
export declare const getNetworkConfig: (network: Network) => NetworkConfig;
export declare class ApiConfig {
    private network;
    rpcUrl: string;
    constructor(network?: Network);
    getUrl(): string;
    getBlockHeightMethod(): string;
    getBlockMethod(): string;
    getTraceViewMethod(): string;
    setNetwork(network: Network): void;
    getNetwork(): Network;
}
export {};
