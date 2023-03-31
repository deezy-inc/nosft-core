# nosft-core

Tools for developing Nosft clients

## Quick start

```bash
npm install nosft-core # or yarn add nosft-core

just -l # list avaialable commands
```

NodeJs & Browser

```js
const nosft = require('nosft-core');
const { utils } = nosft;

console.log(utils.normalizeURL('https://google.com'));
```

### Project anatomy

```
lib
 └ src                              → Application sources
    └ app                           → Business logic
       └ nosft                      → Nosft business logic to be exposed by library
       └ deezy                      → Deezy business logic to be exposed by library
       └ nostr                      → Nostr business logic to be exposed by library
    └ config                        → Constants, Env variables, configuration settings in general
    └ services                      → Application services layer
       └ nosft                      → Nosft integration service
       └ deezy                      → Deezy integration service
       └ nostr                      → Nostr integration service
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

## License

Public domain.
