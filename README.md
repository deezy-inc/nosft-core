# nosft-core

Tools for developing Nosft clients

## Installation

```bash
npm install nosft-core # or yarn add nosft-core
```

## Usage

NodeJs & Browser

```js
const nosftCore = require('nosft-core');

or
const { nosft } = require('nosft-core');

or

import { nosft } = require('nosft-core');
```

### Initialize library

Defaults to mainnet config

```js
const { nosft } = require('nosft-core');

(async () => {
    const inscriptions = await nosft.getAddressInscriptions({
        address: process.env.BTC_ADDRESS,
        offset: 0,
        limit: 2,
    });
    console.log(JSON.stringify(inscriptions, undefined, 4));
})();
```

#### Configure library

If you want to specify your custom configs, you can do so by:

```js
const nosftCore = require('nosft-core');

(async () => {
    const { nosft } = nosftCore.configure({ nosftBaseUrl: 'http://localhost:3000/api', network: 'testnet' });
    const inscriptions = await nosft.getAddressInscriptions({
        address: process.env.BTC_ADDRESS,
        offset: 0,
        limit: 2,
    });

    console.log(JSON.stringify(inscriptions, undefined, 4));
})();
```

### Getting inscriptions

```js
const { nosft } = require('nosft-core');
const inscriptions = await nosft.getAddressInscriptions({
    address: process.env.BTC_ADDRESS,
    offset: 0,
    limit: 2,
});
```

## Developing

1. Install [`just`](https://just.systems/)
2. `just -l`

## License

Public domain.
