import * as bitcoin from 'bitcoinjs-lib';

import {
    TESTNET,
    NOSTR_RELAY_URL,
    NOSTR_KIND_INSCRIPTION,
    INSCRIPTION_SEARCH_DEPTH,
    GITHUB_URL,
    DEFAULT_FEE_RATE,
    SENDS_ENABLED,
    ASSUMED_TX_BYTES,
    ORDINALS_EXPLORER_URL,
    RELAYS,
    BITCOIN_PRICE_API_URL,
    TURBO_API,
    BLOCKSTREAM_API,
    POOL_API_URL,
    NUMBER_OF_DUMMY_UTXOS_TO_CREATE,
    MEMPOOL_API_URL,
    NETWORK,
    DEFAULT_DERIV_PATH,
    DUMMY_UTXO_VALUE,
    MIN_OUTPUT_VALUE,
    BOOST_UTXO_VALUE,
    FEE_LEVEL,
    DEEZY_BOOST_API,
    INSCRIBOR_URL,
} from './constants';

type ConfigOverrides = {
    TESTNET?: boolean;
    NOSTR_RELAY_URL?: string;
    NOSTR_KIND_INSCRIPTION?: number;
    INSCRIPTION_SEARCH_DEPTH?: number;
    GITHUB_URL?: string;
    DEFAULT_FEE_RATE?: number;
    SENDS_ENABLED?: boolean;
    ASSUMED_TX_BYTES?: number;
    ORDINALS_EXPLORER_URL?: string;
    RELAYS?: string[];
    BITCOIN_PRICE_API_URL?: string;
    TURBO_API?: string;
    BLOCKSTREAM_API?: string;
    POOL_API_URL?: string;
    NUMBER_OF_DUMMY_UTXOS_TO_CREATE?: number;
    MEMPOOL_API_URL?: string;
    NETWORK?: bitcoin.Network;
    DEFAULT_DERIV_PATH?: string;
    DUMMY_UTXO_VALUE?: number;
    MIN_OUTPUT_VALUE?: number;
    BOOST_UTXO_VALUE?: number;
    FEE_LEVEL?: string;
    DEEZY_BOOST_API?: string;
    INSCRIBOR_URL?: string;

    TAPROOT_MESSAGE?: (domain: string) => string;
};

class Config {
    TESTNET = TESTNET;
    NOSTR_RELAY_URL = NOSTR_RELAY_URL;
    NOSTR_KIND_INSCRIPTION = NOSTR_KIND_INSCRIPTION;
    INSCRIPTION_SEARCH_DEPTH = INSCRIPTION_SEARCH_DEPTH;
    GITHUB_URL = GITHUB_URL;
    DEFAULT_FEE_RATE = DEFAULT_FEE_RATE;
    SENDS_ENABLED = SENDS_ENABLED;
    ASSUMED_TX_BYTES = ASSUMED_TX_BYTES;
    ORDINALS_EXPLORER_URL = ORDINALS_EXPLORER_URL;
    RELAYS = RELAYS;
    BITCOIN_PRICE_API_URL = BITCOIN_PRICE_API_URL;
    TURBO_API = TURBO_API;
    BLOCKSTREAM_API = BLOCKSTREAM_API;
    POOL_API_URL = POOL_API_URL;
    NUMBER_OF_DUMMY_UTXOS_TO_CREATE = NUMBER_OF_DUMMY_UTXOS_TO_CREATE;
    MEMPOOL_API_URL = MEMPOOL_API_URL;
    NETWORK = NETWORK;
    DEFAULT_DERIV_PATH = DEFAULT_DERIV_PATH;
    DUMMY_UTXO_VALUE = DUMMY_UTXO_VALUE;
    MIN_OUTPUT_VALUE = MIN_OUTPUT_VALUE;
    BOOST_UTXO_VALUE = BOOST_UTXO_VALUE;
    FEE_LEVEL = FEE_LEVEL;
    DEEZY_BOOST_API = DEEZY_BOOST_API;
    INSCRIBOR_URL = INSCRIBOR_URL;

    TAPROOT_MESSAGE = (domain) =>
        `Sign this message to generate your Bitcoin Taproot key. This key will be used for your ${domain} transactions.`;

    constructor(configOverrides?: ConfigOverrides) {
        this.TESTNET = typeof configOverrides?.TESTNET === 'boolean' ? configOverrides?.TESTNET : TESTNET;
        this.NOSTR_RELAY_URL = configOverrides?.NOSTR_RELAY_URL || NOSTR_RELAY_URL;
        this.NOSTR_KIND_INSCRIPTION = configOverrides?.NOSTR_KIND_INSCRIPTION || NOSTR_KIND_INSCRIPTION;
        this.INSCRIPTION_SEARCH_DEPTH = configOverrides?.INSCRIPTION_SEARCH_DEPTH || INSCRIPTION_SEARCH_DEPTH;
        this.GITHUB_URL = configOverrides?.GITHUB_URL || GITHUB_URL;
        this.DEFAULT_FEE_RATE = configOverrides?.DEFAULT_FEE_RATE || DEFAULT_FEE_RATE;
        this.SENDS_ENABLED =
            typeof configOverrides?.SENDS_ENABLED === 'boolean' ? configOverrides?.SENDS_ENABLED : SENDS_ENABLED;
        this.ASSUMED_TX_BYTES = configOverrides?.ASSUMED_TX_BYTES || ASSUMED_TX_BYTES;
        this.ORDINALS_EXPLORER_URL = configOverrides?.ORDINALS_EXPLORER_URL || ORDINALS_EXPLORER_URL;
        this.RELAYS = configOverrides?.RELAYS || RELAYS;
        this.BITCOIN_PRICE_API_URL = configOverrides?.BITCOIN_PRICE_API_URL || BITCOIN_PRICE_API_URL;
        this.TURBO_API = configOverrides?.TURBO_API || TURBO_API;
        this.BLOCKSTREAM_API = configOverrides?.BLOCKSTREAM_API || BLOCKSTREAM_API;
        this.POOL_API_URL = configOverrides?.POOL_API_URL || POOL_API_URL;
        this.NUMBER_OF_DUMMY_UTXOS_TO_CREATE =
            configOverrides?.NUMBER_OF_DUMMY_UTXOS_TO_CREATE || NUMBER_OF_DUMMY_UTXOS_TO_CREATE;
        this.MEMPOOL_API_URL = configOverrides?.MEMPOOL_API_URL || MEMPOOL_API_URL;
        this.NETWORK = configOverrides?.NETWORK || NETWORK;
        this.DEFAULT_DERIV_PATH = configOverrides?.DEFAULT_DERIV_PATH || DEFAULT_DERIV_PATH;
        this.DUMMY_UTXO_VALUE = configOverrides?.DUMMY_UTXO_VALUE || DUMMY_UTXO_VALUE;
        this.MIN_OUTPUT_VALUE = configOverrides?.MIN_OUTPUT_VALUE || MIN_OUTPUT_VALUE;
        this.BOOST_UTXO_VALUE = configOverrides?.BOOST_UTXO_VALUE || BOOST_UTXO_VALUE;
        this.FEE_LEVEL = configOverrides?.FEE_LEVEL || FEE_LEVEL;
        this.DEEZY_BOOST_API = configOverrides?.DEEZY_BOOST_API || DEEZY_BOOST_API;
        this.INSCRIBOR_URL = configOverrides?.INSCRIBOR_URL || INSCRIBOR_URL;

        if (configOverrides?.TAPROOT_MESSAGE) {
            this.TAPROOT_MESSAGE = configOverrides?.TAPROOT_MESSAGE;
        }
    }
}

export { Config };
