export const TESTNET = false;
export const TURBO_API = 'https://turbo.ordinalswallet.com';
export const BLOCKSTREAM_API = 'https://blockstream.info/api';
export const NOSTR_RELAY_URL = 'wss://nostr.openordex.org';
export const NOSTR_KIND_INSCRIPTION = 802;

export const DEEZY_API_URL = (network?: string) =>
    network === 'testnet' ? 'https://api-testnet.deezy.io' : 'https://api.deezy.io';
export const NOSFT_API_URL = (network?: string) =>
    network === 'testnet' ? 'https://nosft.xyz/api/' : 'https://nosft.xyz/api/';
