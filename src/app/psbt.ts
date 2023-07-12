import { serializeTaprootSignature } from 'bitcoinjs-lib/src/psbt/bip371.js';
import { ethers } from 'ethers';
import { BitcoinNetwork, InputToSign, SignTransactionOptions, signTransaction } from 'sats-connect';

import { ECPairFactory } from 'ecpair';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';

// @ts-ignore
import * as ecc from 'tiny-secp256k1';
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';
import axios from 'axios';
import { Crypto } from './crypto';
import { Address } from './address';
import { NETWORK, NETWORK_NAME, BOOST_UTXO_VALUE } from '../config/constants';
import { isMetamaskProvider } from './wallet';

bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

function isHexadecimal(str) {
    const hexRegex = /^[0-9A-Fa-f]*$/;
    return str.length % 2 === 0 && hexRegex.test(str);
}

const getPsbt = (psbtContent) => {
    const psbt = isHexadecimal(psbtContent)
        ? bitcoin.Psbt.fromHex(psbtContent, {
              network: NETWORK,
          })
        : bitcoin.Psbt.fromBase64(psbtContent, {
              network: NETWORK,
          });

    return psbt;
};

const getPsbtBase64 = (psbtContent) => {
    const buffer = Buffer.from(psbtContent, 'hex');
    return buffer.toString('base64');
};

const Psbt = function (config) {
    const addressModule = Address(config);
    const cryptoModule = Crypto(config);

    const psbtModule = {
        getPsbt,
        getPsbtBase64,
        getMetamaskSigner: async (metamaskDomain) => {
            // @ts-ignore
            const { ethereum } = window;
            let ethAddress = ethereum.selectedAddress;

            if (!ethAddress) {
                await ethereum.request({ method: 'eth_requestAccounts' });
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

        signSigHash: ({ sigHash }: { sigHash: any; address?: string }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);

            if (provider === 'xverse') {
                throw new Error('Signing with xverse is not supported yet.');
            }

            if (provider === 'unisat.io') {
                throw new Error('Signing with unisat.io is not supported yet.');
            }

            if (isMetamaskProvider(provider)) {
                return psbtModule.signMetamask(sigHash, provider);
            }

            return psbtModule.signNostr(sigHash);
        },

        getInputParams: ({ utxo, inputAddressInfo, sighashType }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            const pubKey = provider === 'unisat.io' ? inputAddressInfo.internalPubkey : inputAddressInfo.pubkey;

            const params = {
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    value: utxo.value,
                    script: Buffer.from(inputAddressInfo.output, 'hex'),
                },
                tapInternalKey: pubKey,
                sequence: 0xfffffffd,
            };

            if (sighashType) {
                // @ts-ignore
                params.sighashType = sighashType;
            }

            return params;
        },

        createPsbt: ({ utxo, inputAddressInfo, destinationBtcAddress, sendFeeRate, output, sighashType }: any) => {
            const psbt = new bitcoin.Psbt({ network: config.NETWORK });
            // Input
            const inputParams = psbtModule.getInputParams({ utxo, inputAddressInfo, sighashType });
            psbt.addInput(inputParams);

            const psbtOutputValue = output || cryptoModule.outputValue(utxo, sendFeeRate);

            psbt.addOutput({
                address: destinationBtcAddress,
                value: psbtOutputValue,
            });

            return psbt;
        },
        createPsbtForBoost: async ({ pubKey, utxo, destinationBtcAddress }) => {
            const inputAddressInfo = await addressModule.getAddressInfo(pubKey);
            const psbt = psbtModule.createPsbt({
                utxo,
                inputAddressInfo,
                destinationBtcAddress,
                output: BOOST_UTXO_VALUE,
            });

            return psbt.toHex();
        },

        signPsbtForBoostByXverse: async ({ psbt, address }) => {
            const signPsbtOptions: SignTransactionOptions = {
                onFinish: () => {},
                onCancel: () => {},
                payload: {
                    network: {
                        type: NETWORK_NAME,
                    } as BitcoinNetwork,
                    message: 'Sign Transaction',
                    psbtBase64: psbt.toBase64(),
                    broadcast: false,
                    inputsToSign: [
                        {
                            address,
                            signingIndexes: [0],
                        },
                    ],
                },
            };

            const psbtBase64 = await new Promise<string>((resolve, reject) => {
                signPsbtOptions.onFinish = ({ psbtBase64: _psbtBase64 }) => {
                    resolve(_psbtBase64);
                };

                signPsbtOptions.onCancel = () => {
                    reject(new Error('Request canceled.'));
                };

                signTransaction(signPsbtOptions);
            });

            const finalPsbt = bitcoin.Psbt.fromBase64(psbtBase64, {
                network: NETWORK,
            }).finalizeInput(0);

            return finalPsbt.toHex();
        },

        signPsbtForBoost: async ({ psbt, address }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            if (provider === 'xverse') {
                return psbtModule.signPsbtForBoostByXverse({ psbt, address });
            }

            if (provider === 'unisat.io') {
                return window.unisat.signPsbt(psbt.toHex());
            }

            const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
                0,
                psbt.data.inputs.map((input) => input.witnessUtxo.script),
                psbt.data.inputs.map((input) => input.witnessUtxo.value), // eslint-disable-next-line no-bitwise
                bitcoin.Transaction.SIGHASH_ALL
            );
            const signed = await psbtModule.signSigHash({ sigHash });
            psbt.updateInput(0, {
                // @ts-ignore
                tapKeySig: serializeTaprootSignature(Buffer.from(signed, 'hex'), [bitcoin.Transaction.SIGHASH_ALL]),
            });

            // Finalize the PSBT. Note that the transaction will not be broadcast to the Bitcoin network yet.
            psbt.finalizeInput(0);
            return psbt.toHex();
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

        broadcastUnisat: async ({ psbt, utxo, destinationBtcAddress, sendFeeRate }) => {
            // If is an inscription, send it to unisat
            if (utxo.inscriptionId) {
                return window.unisat.sendInscription(destinationBtcAddress, utxo.inscriptionId, {
                    feeRate: sendFeeRate,
                });
            }

            const signedPsbt = await window.unisat.signPsbt(psbt.toHex());
            return window.unisat.pushPsbt(signedPsbt);
        },

        signAndBroadcastUtxoByXverse: async ({ pubKey, address, utxo, destinationBtcAddress, sendFeeRate }) => {
            const inputAddressInfo = await addressModule.getAddressInfo(pubKey);
            const basePsbt = await psbtModule.createPsbt({
                utxo,
                inputAddressInfo,
                destinationBtcAddress,
                sendFeeRate,
            });

            const signPsbtOptions: SignTransactionOptions = {
                onFinish: () => {},
                onCancel: () => {},
                payload: {
                    network: {
                        type: NETWORK_NAME,
                    } as BitcoinNetwork,
                    message: 'Sign Transaction',
                    psbtBase64: basePsbt.toBase64(),
                    broadcast: false,
                    inputsToSign: [
                        {
                            address,
                            signingIndexes: [0],
                        },
                    ],
                },
            };

            const psbtBase64 = await new Promise<string>((resolve, reject) => {
                signPsbtOptions.onFinish = ({ psbtBase64: _psbtBase64 }) => {
                    resolve(_psbtBase64);
                };

                signPsbtOptions.onCancel = () => {
                    reject(new Error('Request canceled.'));
                };

                signTransaction(signPsbtOptions);
            });

            const psbt = bitcoin.Psbt.fromBase64(psbtBase64, {
                network: NETWORK,
            }).finalizeAllInputs();

            return psbtModule.broadcastPsbt(psbt);
        },

        signAndBroadcastUtxo: async ({ pubKey, utxo, destinationBtcAddress, sendFeeRate, address }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            if (provider === 'xverse') {
                return psbtModule.signAndBroadcastUtxoByXverse({
                    pubKey,
                    address,
                    utxo,
                    destinationBtcAddress,
                    sendFeeRate,
                });
            }
            const inputAddressInfo = await addressModule.getAddressInfo(pubKey);

            // @ts-ignore
            const psbt = psbtModule.createPsbt({ utxo, inputAddressInfo, destinationBtcAddress, sendFeeRate });

            if (provider === 'unisat.io') {
                return psbtModule.broadcastUnisat({ psbt, utxo, destinationBtcAddress, sendFeeRate });
            }

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

        createAndSignPsbtForBoost: async ({ pubKey, utxo, destinationBtcAddress, sighashType }) => {
            const inputAddressInfo = await addressModule.getAddressInfo(pubKey);
            const psbt = psbtModule.createPsbt({
                utxo,
                inputAddressInfo,
                destinationBtcAddress,
                sighashType,
                output: config.BOOST_UTXO_VALUE,
            });

            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            if (provider === 'unisat.io') {
                return window.unisat.signPsbt(psbt.toHex());
            }

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

        signPsbtListingXverse: async ({ psbt, address }) => {
            const signPsbtOptions: SignTransactionOptions = {
                onFinish: () => {},
                onCancel: () => {},
                payload: {
                    network: {
                        type: NETWORK_NAME,
                    } as BitcoinNetwork,
                    message: 'Sign Transaction',
                    psbtBase64: psbt.toBase64(),
                    broadcast: false,
                    inputsToSign: [
                        {
                            address,
                            signingIndexes: [0],
                            sigHash: 131,
                        },
                    ],
                },
            };

            const psbtBase64 = await new Promise<string>((resolve, reject) => {
                signPsbtOptions.onFinish = ({ psbtBase64: _psbtBase64 }) => {
                    resolve(_psbtBase64);
                };

                signPsbtOptions.onCancel = () => {
                    reject(new Error('Request canceled.'));
                };

                signTransaction(signPsbtOptions);
            });

            const finalPsbt = bitcoin.Psbt.fromBase64(psbtBase64, {
                network: NETWORK,
            }).finalizeInput(0);

            return finalPsbt;
        },

        signPsbtMessage: async (psbt, address, getPsbt = false, ignoreFinalizeDummies = false) => {
            const virtualToSign = bitcoin.Psbt.fromBase64(psbt, {
                network: NETWORK,
            });
            // if only 1 input, then this is a PSBT listing
            if (virtualToSign.inputCount === 1 && virtualToSign.txOutputs.length === 1) {
                const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
                if (provider === 'xverse') {
                    return psbtModule.signPsbtListingXverse({
                        psbt: virtualToSign,
                        address,
                    });
                }

                if (provider === 'unisat.io') {
                    const unisatSigned = await window.unisat.signPsbt(virtualToSign.toHex());

                    return bitcoin.Psbt.fromHex(unisatSigned, {
                        network: NETWORK,
                    });
                }

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
                if (!input.finalScriptWitness && !input.witnessUtxo) {
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
                const isDummy = i === 0 || i === 1;
                const finalizeFirstInputs = ignoreFinalizeDummies && isDummy;
                // Ignore first 2 dummy inputs
                if (!input.finalScriptWitness && !finalizeFirstInputs) {
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

            if (getPsbt) {
                return virtualToSign;
            }

            return virtualToSign.extractTransaction();
        },
        signBuyOrderWithXverse: async ({ psbt, address }) => {
            const inputsToSign: InputToSign[] = [];
            console.log('signBuyOrderWithXverse', psbt.toBase64());
            const currentPsbt = bitcoin.Psbt.fromBase64(psbt.toBase64(), {
                network: NETWORK,
            });

            for (const [i, input] of currentPsbt.data.inputs.entries()) {
                if (input.sighashType === bitcoin.Transaction.SIGHASH_ALL && input.redeemScript) {
                    inputsToSign.push({
                        address,
                        signingIndexes: [i],
                        sigHash: bitcoin.Transaction.SIGHASH_ALL,
                    });
                }
            }
            const signPsbtOptions: SignTransactionOptions = {
                onFinish: () => {},
                onCancel: () => {},
                payload: {
                    network: {
                        type: NETWORK_NAME,
                    } as BitcoinNetwork,
                    message: 'Sign Transaction',
                    psbtBase64: psbt.toBase64(),
                    broadcast: false,
                    inputsToSign,
                },
            };

            const signedPsbtBase64: string = await new Promise((resolve, reject) => {
                signPsbtOptions.onFinish = ({ psbtBase64: _psbtBase64, txId: _txId }) => {
                    resolve(_psbtBase64);
                };
                signPsbtOptions.onCancel = () => {
                    reject(new Error('Request canceled.'));
                };
                try {
                    signTransaction(signPsbtOptions);
                } catch (error) {
                    console.error(error);
                    reject(error);
                }
            });

            const finalPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64, {
                network: NETWORK,
            });

            for (const i in inputsToSign) {
                finalPsbt.finalizeInput(inputsToSign[i].signingIndexes[0]);
            }

            return finalPsbt.toBase64();
        },

        signPsbtListingForBuy: async ({ psbt, ordinalAddress, paymentAddress }): Promise<string> => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            let signedPsbt;
            if (provider === 'unisat.io') {
                const finalPopulatedPsbt = await window.unisat.signPsbt(psbt.toHex(), { autoFinalize: false });
                const buffer = Buffer.from(finalPopulatedPsbt, 'hex');
                signedPsbt = buffer.toString('base64');
            } else if (provider === 'xverse') {
                signedPsbt = await psbtModule.signBuyOrderWithXverse({
                    psbt,
                    address: paymentAddress,
                });
            } else {
                const finalPopulatedPsbt = await psbtModule.signPsbtMessage(
                    psbt.toBase64(),
                    ordinalAddress,
                    true,
                    true
                );
                // @ts-ignore
                signedPsbt = finalPopulatedPsbt.toBase64();
            }

            return signedPsbt;
        },
    };

    return psbtModule;
};

export { Psbt };
