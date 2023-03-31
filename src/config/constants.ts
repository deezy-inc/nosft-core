export const enum NETWORK {
    TESTNET = 'testnet',
    MAINNET = 'mainnet',
}

export const DEEZY_API_URL = (network?: NETWORK) =>
    network === NETWORK.TESTNET ? 'https://api-testnet.deezy.io' : 'https://api.deezy.io';
