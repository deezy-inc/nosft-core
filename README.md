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

### Getting OnSale Ordinals

#### Server Side/Node

```ts
import 'websocket-polyfill'; // only for nodejs/server-side
import { NostrRelay } from 'nosft-core';

(async () => {
    const relay = new NostrRelay();
    relay.subscribeOrders({
        limit: 10,
        onOrder: (order) => {
            console.log('new order');
            console.log(order.id);
        },
        onEose: () => {
            console.log('eose');
        },
    });
})();
```

#### Nextjs (React Web App)

```ts
import { nosft, NostrRelay, SaleOrder } from 'nosft-core';
import { useEffect, useState } from 'react';

export default function App() {
    const [orders, setOrders] = useState<SaleOrder[]>([]);
    useEffect(() => {
        const relay = new NostrRelay();
        relay.subscribeOrders({
            limit: 100,
            onOrder: (order) => {
                console.log('new order');
                console.log(order.id);
                setOrders((orders) => [...orders, order]);
            },
            onEose: () => {
                console.log('eose');
            },
        });
        return () => {
            relay.unsubscribeOrders();
        };
    }, []);

    return (
        <>
            <main>
                {orders.map((order) => (
                    <div>{order.id}</div>
                ))}
            </main>
        </>
    );
}
```

## Developing

1. Install [`just`](https://just.systems/)
2. `just -l`

## License

Public domain.
