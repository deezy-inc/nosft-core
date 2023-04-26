import {
    NOSTR_RELAY_URL,
    NOSTR_KIND_INSCRIPTION,
    INSCRIPTION_SEARCH_DEPTH,
    GITHUB_URL,
    DEFAULT_FEE_RATE,
    SENDS_ENABLED,
    TESTNET,
    ASSUMED_TX_BYTES,
    ORDINALS_EXPLORER_URL,
    RELAYS,
    MAX_ONSALE,
    ORDINALS_WALLET,
    BITCOIN_PRICE_API_URL,
    TURBO_API,
    BLOCKSTREAM_API,
    POOL_API_URL,
    MEMPOOL_API_URL,
    NETWORK,
    ORDINALS_EXPLORER_URL_LEGACY,
    DEFAULT_DERIV_PATH,
    DUMMY_UTXO_VALUE,
    FEE_LEVEL,
    NUMBER_OF_DUMMY_UTXOS_TO_CREATE,
} from './constants';

type ConfigOverrides = {
    NOSTR_RELAY_URL?: string;
    NOSTR_KIND_INSCRIPTION?: number;
    INSCRIPTION_SEARCH_DEPTH?: number;
    GITHUB_URL?: string;
    DEFAULT_FEE_RATE?: number;
    SENDS_ENABLED?: boolean;
    TESTNET?: boolean;
    ASSUMED_TX_BYTES?: number;
    ORDINALS_EXPLORER_URL?: string;
    RELAYS?: string[];
    MAX_ONSALE?: number;
    ORDINALS_WALLET?: string;
    BITCOIN_PRICE_API_URL?: string;
    TURBO_API?: string;
    BLOCKSTREAM_API?: string;
    POOL_API_URL?: string;
    MEMPOOL_API_URL?: string;
    NETWORK?: any;
    ORDINALS_EXPLORER_URL_LEGACY?: string;
    DEFAULT_DERIV_PATH?: string;
    DUMMY_UTXO_VALUE?: number;
    NUMBER_OF_DUMMY_UTXOS_TO_CREATE?: number;
    FEE_LEVEL?: string;

    TAPROOT_MESSAGE?: (domain: string) => string;
};

class Config {
    NOSTR_RELAY_URL = NOSTR_RELAY_URL;
    NOSTR_KIND_INSCRIPTION = NOSTR_KIND_INSCRIPTION;
    INSCRIPTION_SEARCH_DEPTH = INSCRIPTION_SEARCH_DEPTH;
    GITHUB_URL = GITHUB_URL;
    DEFAULT_FEE_RATE = DEFAULT_FEE_RATE;
    SENDS_ENABLED = SENDS_ENABLED;
    TESTNET = TESTNET;
    ASSUMED_TX_BYTES = ASSUMED_TX_BYTES;
    ORDINALS_EXPLORER_URL = ORDINALS_EXPLORER_URL;
    RELAYS = RELAYS;
    MAX_ONSALE = MAX_ONSALE;
    ORDINALS_WALLET = ORDINALS_WALLET;
    BITCOIN_PRICE_API_URL = BITCOIN_PRICE_API_URL;
    TURBO_API = TURBO_API;
    BLOCKSTREAM_API = BLOCKSTREAM_API;
    POOL_API_URL = POOL_API_URL;
    MEMPOOL_API_URL = MEMPOOL_API_URL;
    NETWORK = NETWORK;
    ORDINALS_EXPLORER_URL_LEGACY = ORDINALS_EXPLORER_URL_LEGACY;
    DEFAULT_DERIV_PATH = DEFAULT_DERIV_PATH;
    DUMMY_UTXO_VALUE = DUMMY_UTXO_VALUE;
    FEE_LEVEL = FEE_LEVEL;
    NUMBER_OF_DUMMY_UTXOS_TO_CREATE = NUMBER_OF_DUMMY_UTXOS_TO_CREATE;

    TAPROOT_MESSAGE = (domain) =>
        `Sign this message to generate your Bitcoin Taproot key. This key will be used for your ${domain} transactions.`;

    constructor(configOverrides?: ConfigOverrides) {
        this.NOSTR_RELAY_URL = configOverrides?.NOSTR_RELAY_URL || NOSTR_RELAY_URL;
        this.NOSTR_KIND_INSCRIPTION = configOverrides?.NOSTR_KIND_INSCRIPTION || NOSTR_KIND_INSCRIPTION;
        this.INSCRIPTION_SEARCH_DEPTH = configOverrides?.INSCRIPTION_SEARCH_DEPTH || INSCRIPTION_SEARCH_DEPTH;
        this.GITHUB_URL = configOverrides?.GITHUB_URL || GITHUB_URL;
        this.DEFAULT_FEE_RATE = configOverrides?.DEFAULT_FEE_RATE || DEFAULT_FEE_RATE;
        this.SENDS_ENABLED =
            typeof configOverrides?.SENDS_ENABLED === 'boolean' ? configOverrides?.SENDS_ENABLED : SENDS_ENABLED;
        this.TESTNET = typeof configOverrides?.TESTNET === 'boolean' ? configOverrides?.TESTNET : TESTNET;
        this.ASSUMED_TX_BYTES = configOverrides?.ASSUMED_TX_BYTES || ASSUMED_TX_BYTES;
        this.ORDINALS_EXPLORER_URL = configOverrides?.ORDINALS_EXPLORER_URL || ORDINALS_EXPLORER_URL;
        this.RELAYS = configOverrides?.RELAYS || RELAYS;
        this.MAX_ONSALE = configOverrides?.MAX_ONSALE || MAX_ONSALE;
        this.ORDINALS_WALLET = configOverrides?.ORDINALS_WALLET || ORDINALS_WALLET;
        this.BITCOIN_PRICE_API_URL = configOverrides?.BITCOIN_PRICE_API_URL || BITCOIN_PRICE_API_URL;
        this.TURBO_API = configOverrides?.TURBO_API || TURBO_API;
        this.BLOCKSTREAM_API = configOverrides?.BLOCKSTREAM_API || BLOCKSTREAM_API;
        this.POOL_API_URL = configOverrides?.POOL_API_URL || POOL_API_URL;
        this.MEMPOOL_API_URL = configOverrides?.MEMPOOL_API_URL || MEMPOOL_API_URL;
        this.NETWORK = configOverrides?.NETWORK || NETWORK;
        this.ORDINALS_EXPLORER_URL_LEGACY =
            configOverrides?.ORDINALS_EXPLORER_URL_LEGACY || ORDINALS_EXPLORER_URL_LEGACY;
        this.DEFAULT_DERIV_PATH = configOverrides?.DEFAULT_DERIV_PATH || DEFAULT_DERIV_PATH;
        this.DUMMY_UTXO_VALUE = configOverrides?.DUMMY_UTXO_VALUE || DUMMY_UTXO_VALUE;
        this.FEE_LEVEL = configOverrides?.FEE_LEVEL || FEE_LEVEL;
        this.NUMBER_OF_DUMMY_UTXOS_TO_CREATE =
            configOverrides?.NUMBER_OF_DUMMY_UTXOS_TO_CREATE || NUMBER_OF_DUMMY_UTXOS_TO_CREATE;

        if (configOverrides?.TAPROOT_MESSAGE) {
            this.TAPROOT_MESSAGE = configOverrides?.TAPROOT_MESSAGE;
        }
    }
}

export { Config };
