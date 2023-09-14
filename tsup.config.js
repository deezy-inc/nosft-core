const { NodeGlobalsPolyfillPlugin } = require('@esbuild-plugins/node-globals-polyfill');
const { NodeModulesPolyfillPlugin } = require('@esbuild-plugins/node-modules-polyfill');
const wasmPlugin = require('./wasmPlugin');

module.exports = {
    entryPoints: ['src/index.ts'],
    format: ['cjs', 'esm', 'iife'],
    external: [],
    esbuildPlugins: [
        NodeGlobalsPolyfillPlugin({
            process: true,
            buffer: true,
        }),
        NodeModulesPolyfillPlugin(),
        wasmPlugin,
    ],
};
