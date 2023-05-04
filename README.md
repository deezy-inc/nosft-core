# nosft-core

Tools for developing Nosft clients

### Project anatomy

```
lib
 └ src                              → Application sources
    └ app                           → Business logic
       └ nosft                      → Nosft business logic to be exposed by library
       └ deezy                      → Deezy business logic to be exposed by library
       └ nostr                      → Nostr business logic to be exposed by library
       ...
    └ config                        → Constants, Env variables, configuration settings in general
    └ services                      → Application services layer
       └ nosft                      → Nosft integration service
       └ deezy                      → Deezy integration service
       └ nostr                      → Nostr integration service
       ...
 └ index.js                         → Main application entry point
 └ README.md                        → Library documentation.
 └ node_modules (generated)         → NPM dependencies
 └ test                             → Source folder for unit or functional tests
 └ .editorconfig                    → EditorConfig helps maintain consistent coding styles for multiple developers working on the same project across various editors and IDEs
 └ .env.sample                      → Sample of for the .env file
 └ .gitignore                       → Files and folders to ignore by git
 └ .npmrc                           → Npm configuration file
 └ .prettierrc                      → Code formatter configuration
 └ jest.config.js                   → Jest configuration file
 └ tsconfig.json                    → Typescript configuration file
 └ tslint.js                        → Typescript linter
 └ build                            → Esbuild configuration file
 └ justfile                         → just configuration file
```

### Getting inscriptions

```js
import { getInscriptions, getAddress } from 'nosft-core';

const addresss = await getAddress();
const inscriptionts = await getInscriptions(address);
```

## Developing

1. Install [`just`](https://just.systems/)
2. `just -l`

## Usage

You can install the Nosft Core SDK by running:

```bash
npm install nosft-core
```

### Configuration

You can ovewrite any nosft configuration variable available by passing the object on initialization.

```js
import { Nosft } from 'nosft-core';

const localConfig = {
    // Overwrite RELAY URL
    NOSTR_RELAY_URL: 'ws://localhost:7006',
};

const nosft = Nosft({ ...localConfig });
```

-   [Here](https://github.com/deezy-inc/nosft-core/blob/main/src/config/config.ts#L84) you can see the list of available configurations.

### Wallet

The `connectWallet` method allows you to connect your wallet to the Nosft SDK:

```javascript
const { connectWallet } = nosft.wallet;
const pubKey = await connectWallet();
```

### Address

You can retrieve address information using the `getAddressInfo` method:

```javascript
const { getAddressInfo } = nosft.address;
const addressInfo = await getAddressInfo(address);
```

### UTXO

To check if a UTXO contains an inscription, use the `doesUtxoContainInscription` method. You can also retrieve the UTXOs associated with an address using the `getAddressUtxos` method:

```javascript
const { doesUtxoContainInscription, getAddressUtxos } = nosft.utxo;

const hasInscription = await doesUtxoContainInscription(utxo);
const utxos = await getAddressUtxos(address);
```

### Inscriptions

The `getInscription` method allows you to retrieve a specific inscription, and the `getInscriptions` method retrieves all available inscriptions:

```javascript
const { getInscription, getInscriptions } = nosft.inscriptions;

const inscription = await getInscription(inscriptionId);
const inscriptions = await getInscriptions();
```

### PSBT

You can use the `signPsbtMessage` method to sign a PSBT message, and the `broadcastTx` method to broadcast a transaction to the Bitcoin network. The `signAndBroadcastUtxo` method signs and broadcasts a UTXO transaction. The `getMetamaskSigner` method retrieves the signer used by Metamask, and the `signSigHash` method signs a message with the sighash flag:

```javascript
const { signPsbtMessage, broadcastTx, signAndBroadcastUtxo, getMetamaskSigner, signSigHash } = nosft.psbt;

const signedPsbt = await signPsbtMessage(psbt, wallet);
await broadcastTx(signedTxHex);
const signedAndBroadcastedTx = await signAndBroadcastUtxo(wallet, psbt);
const metamaskSigner = await getMetamaskSigner();
const signedSigHash = await signSigHash(wallet, sighash);
```

### Open Ordex

The `getAvailableUtxosWithoutInscription` method retrieves all available UTXOs without an inscription, and the `generatePSBTListingInscriptionForBuy` and `generatePSBTListingInscriptionForSale` methods generate PSBT messages for buying and selling, respectively. The `getOrderInformation` method retrieves order information:

```javascript
const {
    getAvailableUtxosWithoutInscription,
    generatePSBTListingInscriptionForBuy,
    generatePSBTListingInscriptionForSale,
    getOrderInformation,
} = nosft.openOrdex;
```

## Usage

Here is the list of all required methods to create a client just like nosft.

```javascript
import { Nosft } from 'nosft-core';
import { localConfig } from '@lib/constants.config';

const nosft = Nosft({ ...localConfig });

const { connectWallet } = nosft.wallet;
const { getAddressInfo } = nosft.address;
const { doesUtxoContainInscription, getAddressUtxos } = nosft.utxo;
const { getInscription, getInscriptions } = nosft.inscriptions;
const { signPsbtMessage, broadcastTx, signAndBroadcastUtxo, getMetamaskSigner, signSigHash } = nosft.psbt;
const { signAndBroadcastEvent, getNostrInscription, subscribeOrders, unsubscribeOrders } = nosft.nostr;

const {
    getAvailableUtxosWithoutInscription,
    generatePSBTListingInscriptionForBuy,
    generatePSBTListingInscriptionForSale,
    getOrderInformation,
} = nosft.openOrdex;

const {
    shortenStr,
    satsToFormattedDollarString,
    fetchBitcoinPrice,
    outputValue,
    toXOnly,
    sortUtxos,
    parseOutpoint,
    fetchRecommendedFee,
    satToBtc,
    calculateFee,
    getTxHexById,
    tweakSigner,
} = nosft.crypto;

const { config } = nosft;

const {
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

    BITCOIN_PRICE_API_URL,
    TURBO_API,
    BLOCKSTREAM_API,
    POOL_API_URL,
    MEMPOOL_API_URL,
    NETWORK,
    DEFAULT_DERIV_PATH,
    DUMMY_UTXO_VALUE,
    FEE_LEVEL,
    TAPROOT_MESSAGE,
} = config;

export default nosft;
export {
    getAddressInfo,
    connectWallet,

    // Crypto
    shortenStr,
    satsToFormattedDollarString,
    fetchBitcoinPrice,
    outputValue,
    toXOnly,
    sortUtxos,
    parseOutpoint,
    fetchRecommendedFee,
    satToBtc,
    calculateFee,
    getTxHexById,
    tweakSigner,

    // utxo
    doesUtxoContainInscription,
    getAddressUtxos,

    // inscriptions
    getInscription,
    getInscriptions,

    // psbt
    signPsbtMessage,
    broadcastTx,
    signAndBroadcastUtxo,
    getMetamaskSigner,
    signSigHash,

    // open ordex
    getAvailableUtxosWithoutInscription,
    generatePSBTListingInscriptionForBuy,
    generatePSBTListingInscriptionForSale,
    getOrderInformation,

    // nostr
    signAndBroadcastEvent,
    getNostrInscription,
    subscribeOrders,
    unsubscribeOrders,

    // Config variables
    TAPROOT_MESSAGE,
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
    BITCOIN_PRICE_API_URL,
    TURBO_API,
    BLOCKSTREAM_API,
    POOL_API_URL,
    MEMPOOL_API_URL,
    NETWORK,
    DEFAULT_DERIV_PATH,
    DUMMY_UTXO_VALUE,
    FEE_LEVEL,
};
```

### Get owned ordinals

This function returns all of the user utxo's, if you only need inscription, filter them
/to the ones that has inscriptionId defined.

```javascript
import { connectWallet, getInscriptions } from '@services/nosft';

const pubKey = await connectWallet(metamask);

const utxos = await getInscriptions(nostrAddress);
```

### Get specific inscription

```javascript
const inscriptionId = 'YOUR INSCRIPTION ID';
const { inscription, collection } = await getInscription(slug);
```

### Get list of listed inscriptions in nostr

```javascript
import { subscribeOrders as subscribeNosftOrders, unsubscribeOrders } from '@services/nosft';

const callback = (err, data) => { ... } // your callback

const orderEvent = (err, event) => {
   if (err) {
         callback(err);
   } else {
         callback(null, event);
   }
};

// Returns subs
const subscriptionOrders = subscribeNosftOrders({ callback: orderEvent, limit });

// To unsuscribe
if (subscriptionOrders) {
      unsubscribeOrders();
      subscriptionOrders.unsub();
      subscriptionOrders = null;
}
```

## Sell your own inscription

```javascript
import {
    shortenStr,
    fetchBitcoinPrice,
    satsToFormattedDollarString,
    generatePSBTListingInscriptionForSale,
    signAndBroadcastEvent,
} from '@services/nosft';

const psbt = await generatePSBTListingInscriptionForSale({
    utxo,
    paymentAddress: destinationBtcAddress,
    price: ordinalValue,
});

const signedPsbt = await signPsbtMessage(psbt);

await signAndBroadcastEvent({
    utxo,
    ordinalValue,
    signedPsbt: signedPsbt.toBase64(),
    pubkey: nostrPublicKey,
});
```

### Buy an inscription

For buying we need to get the signed psbt from nostr first.
To get the inscription and nostr information we can do as follows

```javascript
import { getAddressInfo, getInscription, getNostrInscription } from '@services/nosft';

const fetchInscription = async (inscriptionId) => {
    const { inscription: _inscription, collection: _collection } = await getInscription(inscriptionId);
    setInscription(_inscription);
    setCollection(_collection);
};

const inscription = await fetchInscription(inscriptionId);
const nostr = await getNostrInscription(inscriptionId);
```

Once we have the inscription and nostr data we can continue with the buy.

```javascript
import {
    signPsbtMessage,
    broadcastTx,
    getAvailableUtxosWithoutInscription,
    generatePSBTListingInscriptionForBuy,
} from '@services/nosft';

// If buying with BTC, user should get at least 2 dummy utxos
const updatePayerAddress = async (address) => {
    try {
        const { selectedUtxos: _selectedUtxos, dummyUtxos: _dummyUtxos } = await getAvailableUtxosWithoutInscription({
            address,
            price: utxo.value,
        });

        if (_dummyUtxos.length < 2) {
            throw new Error('No dummy UTXOs found. Please create them before continuing.');
        }

        setSelectedUtxos(_selectedUtxos);
        setDummyUtxos(_dummyUtxos);
    } catch (e) {
        setSelectedUtxos([]);
        throw e;
    }
};

const buy = async () => {
    try {
        await updatePayerAddress(destinationBtcAddress);
    } catch (e) {
        setIsBtcInputAddressValid(false);
        toast.error(e.message);
        return;
    }

    try {
        const sellerSignedPsbt = bitcoin.Psbt.fromBase64(nostr.content, { network: NETWORK });

        const psbt = await generatePSBTListingInscriptionForBuy({
            payerAddress: destinationBtcAddress,
            receiverAddress: destinationBtcAddress,
            price: nostr.value,
            paymentUtxos: selectedUtxos,
            dummyUtxos,
            sellerSignedPsbt,
            inscription: utxo,
        });

        const tx = await signPsbtMessage(psbt);
        const txId = await broadcastTx(tx);
    } catch (e) {
        toast.error(e.message);
    }
};
```

## License

# Public domain.
