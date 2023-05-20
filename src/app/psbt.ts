import { serializeTaprootSignature } from 'bitcoinjs-lib/src/psbt/bip371.js';
import { ethers } from 'ethers';

import { ECPairFactory } from 'ecpair';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';

// @ts-ignore
import * as ecc from 'tiny-secp256k1';
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';
import axios from 'axios';
import { Crypto } from './crypto';
import { Address } from './address';

bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

const Psbt = function (config) {
    const addressModule = Address(config);
    const cryptoModule = Crypto(config);

    const psbtModule = {
        getMetamaskSigner: async (metamaskDomain) => {
            // @ts-ignore
            const { ethereum } = window;
            let ethAddress = ethereum.selectedAddress;

            if (!ethAddress) {
                await ethereum.srequest({ method: 'eth_requestAccounts' });
                ethAddress = ethereum.selectedAddress;
            }

            // @ts-ignore
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const toSign = `0x${Buffer.from(config.TAPROOT_MESSAGE(metamaskDomain)).toString('hex')}`;
            const signature = await provider.send('personal_sign', [toSign, ethAddress]);
            const seed = ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.arrayify(signature)));
            const root = bip32.fromSeed(Buffer.from(seed));
            const taprootChild = root.derivePath(config.DEFAULT_DERIV_PATH);
            const { privateKey } = taprootChild;

            // @ts-ignore
            const keyPair = ECPair.fromPrivateKey(privateKey);
            return cryptoModule.tweakSigner(keyPair);
        },

        signMetamask: async (sigHash, metamaskDomain) => {
            const tweakedSigner = await psbtModule.getMetamaskSigner(metamaskDomain);
            // @ts-ignore
            return tweakedSigner.signSchnorr(sigHash);
        },

        signNostr: (sigHash) => {
            // @ts-ignore
            return window.nostr.signSchnorr(sigHash.toString('hex'));
        },

        signSigHash: ({ sigHash }) => {
            const metamaskDomain = SessionStorage.get(SessionsStorageKeys.DOMAIN);

            if (metamaskDomain) {
                return psbtModule.signMetamask(sigHash, metamaskDomain);
            }

            return psbtModule.signNostr(sigHash);
        },

        getInputParams: ({ utxo, inputAddressInfo }) => {
            return {
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    value: utxo.value,
                    script: Buffer.from(inputAddressInfo.output, 'hex'),
                },
                tapInternalKey: inputAddressInfo.pubkey,
            };
        },

        createPsbt: ({ utxo, inputAddressInfo, destinationBtcAddress, sendFeeRate, output }: any) => {
            const psbt = new bitcoin.Psbt({ network: config.NETWORK });
            // Input
            const inputParams = psbtModule.getInputParams({ utxo, inputAddressInfo });
            psbt.addInput(inputParams);

            const psbtOutputValue = output || cryptoModule.outputValue(utxo, sendFeeRate);

            psbt.addOutput({
                address: destinationBtcAddress,
                value: psbtOutputValue,
            });

            return psbt;
        },

        broadcastTx: async (tx) => {
            const hex = tx.toBuffer().toString('hex');
            const fullTx = bitcoin.Transaction.fromHex(hex);
            await axios.post(`https://mempool.space/api/tx`, hex);

            return fullTx.getId();
        },

        broadcastPsbt: async (psbt) => {
            const tx = psbt.extractTransaction();
            return psbtModule.broadcastTx(tx);
        },

        signAndBroadcastUtxo: async ({ pubKey, utxo, destinationBtcAddress, sendFeeRate }) => {
            const inputAddressInfo = await addressModule.getAddressInfo(pubKey);

            // @ts-ignore
            const psbt = psbtModule.createPsbt({ utxo, inputAddressInfo, destinationBtcAddress, sendFeeRate });

            // @ts-ignore
            const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
                0,
                [inputAddressInfo.output],
                [utxo.value],
                bitcoin.Transaction.SIGHASH_DEFAULT
            );

            const signed = await psbtModule.signSigHash({ sigHash });

            psbt.updateInput(0, {
                // @ts-ignore
                tapKeySig: serializeTaprootSignature(Buffer.from(signed, 'hex')),
            });

            // Finalize the PSBT. Note that the transaction will not be broadcast to the Bitcoin network yet.
            psbt.finalizeAllInputs();
            // Send it!
            return psbtModule.broadcastPsbt(psbt);
        },

        createAndSignPsbtForBoost: async ({ pubKey, utxo, destinationBtcAddress }) => {
            const inputAddressInfo = await addressModule.getAddressInfo(pubKey);
            const psbt = psbtModule.createPsbt({
                utxo,
                inputAddressInfo,
                destinationBtcAddress,
                output: config.BOOST_UTXO_VALUE,
            });

            // @ts-ignore
            const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
                0,
                [inputAddressInfo.output],
                [utxo.value],
                // eslint-disable-next-line no-bitwise
                bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY
            );

            const signed = await psbtModule.signSigHash({ sigHash });

            psbt.updateInput(0, {
                // @ts-ignore
                tapKeySig: serializeTaprootSignature(Buffer.from(signed, 'hex'), [
                    // @ts-ignore
                    bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY,
                ]),
            });

            // Finalize the PSBT. Note that the transaction will not be broadcast to the Bitcoin network yet.
            psbt.finalizeAllInputs();
            return psbt.toHex();
        },

        signPsbtMessage: async (message) => {
            const virtualToSign = bitcoin.Psbt.fromBase64(message);
            // if only 1 input, then this is a PSBT listing
            if (virtualToSign.inputCount === 1 && virtualToSign.txOutputs.length === 1) {
                // @ts-ignore
                const sigHash = virtualToSign.__CACHE.__TX.hashForWitnessV1(
                    0,
                    // @ts-ignore
                    [virtualToSign.data.inputs[0].witnessUtxo.script],
                    // @ts-ignore
                    [virtualToSign.data.inputs[0].witnessUtxo.value],
                    // eslint-disable-next-line no-bitwise
                    bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY
                );
                // @ts-ignore
                const sign = await psbtModule.signSigHash({ sigHash });
                virtualToSign.updateInput(0, {
                    // @ts-ignore
                    tapKeySig: serializeTaprootSignature(Buffer.from(sign, 'hex'), [
                        // eslint-disable-next-line no-bitwise
                        bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY,
                    ]),
                });
                virtualToSign.finalizeAllInputs();
                return virtualToSign;
            }
            const witnessScripts = [];
            const witnessValues = [];
            // update all witnesses and values
            virtualToSign.data.inputs.forEach((input, i) => {
                if (!input.finalScriptWitness) {
                    // @ts-ignore
                    const tx = bitcoin.Transaction.fromBuffer(virtualToSign.data.inputs[i].nonWitnessUtxo);
                    const output = tx.outs[virtualToSign.txInputs[i].index];
                    virtualToSign.updateInput(i, {
                        witnessUtxo: output,
                    });
                    // @ts-ignore
                    witnessScripts.push(output.script);
                    // @ts-ignore
                    witnessValues.push(output.value);
                } else {
                    // @ts-ignore
                    witnessScripts.push(virtualToSign.data.inputs[i].witnessUtxo.script);
                    // @ts-ignore
                    witnessValues.push(virtualToSign.data.inputs[i].witnessUtxo.value);
                }
            });
            // create and update resultant sighashes
            // eslint-disable-next-line no-restricted-syntax
            for (const [i, input] of virtualToSign.data.inputs.entries()) {
                if (!input.finalScriptWitness) {
                    // @ts-ignore
                    const sigHash = virtualToSign.__CACHE.__TX.hashForWitnessV1(
                        i,
                        witnessScripts,
                        witnessValues,
                        bitcoin.Transaction.SIGHASH_DEFAULT
                    );
                    // eslint-disable-next-line no-await-in-loop
                    const signature = await psbtModule.signSigHash({ sigHash });
                    virtualToSign.updateInput(i, {
                        // @ts-ignore
                        tapKeySig: serializeTaprootSignature(Buffer.from(signature, 'hex')),
                    });
                    virtualToSign.finalizeInput(i);
                }
            }
            console.log(virtualToSign.toBase64());
            return virtualToSign.extractTransaction();
        },
    };

    return psbtModule;
};

export { Psbt };
