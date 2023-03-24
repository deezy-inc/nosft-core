#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const { NodeGlobalsPolyfillPlugin } = require('@esbuild-plugins/node-globals-polyfill');
const { NodeModulesPolyfillPlugin } = require('@esbuild-plugins/node-modules-polyfill');

const wasmPlugin = {
    name: 'wasm',
    setup(build) {
        // Resolve ".wasm" files to a path with a namespace
        build.onResolve({ filter: /\.wasm$/ }, (args) => {
            // If this is the import inside the stub module, import the
            // binary itself. Put the path in the "wasm-binary" namespace
            // to tell our binary load callback to load the binary file.
            if (args.namespace === 'wasm-stub') {
                return {
                    path: args.path,
                    namespace: 'wasm-binary',
                };
            }

            // Otherwise, generate the JavaScript stub module for this
            // ".wasm" file. Put it in the "wasm-stub" namespace to tell
            // our stub load callback to fill it with JavaScript.
            //
            // Resolve relative paths to absolute paths here since this
            // resolve callback is given "resolveDir", the directory to
            // resolve imports against.
            if (args.resolveDir === '') {
                return; // Ignore unresolvable paths
            }
            return {
                path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
                namespace: 'wasm-stub',
            };
        });

        // Virtual modules in the "wasm-stub" namespace are filled with
        // the JavaScript code for compiling the WebAssembly binary. The
        // binary itself is imported from a second virtual module.
        build.onLoad({ filter: /.*/, namespace: 'wasm-stub' }, async (args) => ({
            contents: `import wasm from ${JSON.stringify(args.path)}
        export default (imports) =>
          WebAssembly.instantiate(wasm, imports).then(
            result => result.instance.exports)`,
        }));

        // Virtual modules in the "wasm-binary" namespace contain the
        // actual bytes of the WebAssembly file. This uses esbuild's
        // built-in "binary" loader instead of manually embedding the
        // binary data inside JavaScript code ourselves.
        build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async (args) => ({
            contents: await fs.promises.readFile(args.path),
            loader: 'binary',
        }));
    },
};

let common = {
    entryPoints: ['index.ts'],
    bundle: true,
    sourcemap: 'external',
};

esbuild
    .build({
        ...common,
        outfile: 'lib/esm/nosft.mjs',
        format: 'esm',
        packages: 'external',
    })
    .then(() => {
        const packageJson = JSON.stringify({ type: 'module' });
        fs.writeFileSync(`${__dirname}/lib/esm/package.json`, packageJson, 'utf8');

        console.log('esm build success.');
    });

esbuild
    .build({
        ...common,
        outfile: 'lib/nosft.cjs.js',
        format: 'cjs',
        packages: 'external',
    })
    .then(() => console.log('cjs build success.'));

esbuild
    .build({
        ...common,
        outfile: 'lib/nosft.bundle.js',
        format: 'iife',
        globalName: 'NosftCore',
        define: {
            window: 'self',
            global: 'globalThis',
            process: "{'env': {}}",
        },
        target: 'esnext',
        plugins: [
            NodeGlobalsPolyfillPlugin({
                process: true,
                buffer: true,
            }),
            NodeModulesPolyfillPlugin(),
            wasmPlugin,
        ],
    })
    .then(() => console.log('standalone build success.'));
