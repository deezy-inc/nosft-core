# nosft-core

Tools for developing Nosft clients

## Installation

```bash
npm install nosft-core # or yarn add nosft-core
```

## Usage

NodeJs & Browser

```js
const nosft = require('nosft-core');
const { utils } = nosft;

console.log(utils.normalizeURL('https://google.com'));
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

## License

Public domain.
