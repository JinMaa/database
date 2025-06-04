export enum Network {
  MAINNET = 'mainnet',
  OYLNET = 'oylnet'
}

interface NetworkConfig {
  url: string;
  blockHeightMethod: string;
  getBlockMethod: string;
  traceViewMethod: string;
}

const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  [Network.MAINNET]: {
    url: 'https://mainnet.sandshrew.io/v4/oylcorpbtw',
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

export const getNetworkConfig = (network: Network): NetworkConfig => {
  return NETWORK_CONFIGS[network];
};

export class ApiConfig {
  private network: Network;
  public rpcUrl: string;

  constructor(network: Network = Network.MAINNET) {
    this.network = network;
    this.rpcUrl = NETWORK_CONFIGS[this.network].url;
  }

  public getUrl(): string {
    return NETWORK_CONFIGS[this.network].url;
  }

  public getBlockHeightMethod(): string {
    return NETWORK_CONFIGS[this.network].blockHeightMethod;
  }

  public getBlockMethod(): string {
    return NETWORK_CONFIGS[this.network].getBlockMethod;
  }
  
  public getTraceViewMethod(): string {
    return NETWORK_CONFIGS[this.network].traceViewMethod;
  }

  public setNetwork(network: Network): void {
    this.network = network;
    this.rpcUrl = NETWORK_CONFIGS[this.network].url;
  }

  public getNetwork(): Network {
    return this.network;
  }
}
