/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue, react/forbid-prop-types, radix, no-empty, guard-for-in */
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';
import { Address } from './address';
import { Crypto } from './crypto';
import { Utxo } from './utxo';
import { Psbt } from './psbt';
import * as bitcoin from 'bitcoinjs-lib';
import { NETWORK } from '../config/constants';
// @ts-ignore
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

bitcoin.initEccLib(ecc);

const schnorrValidator = (pubkey, msghash, signature) => {
    return ecc.verifySchnorr(msghash, pubkey, signature);
};

const ecdsaValidator = (pubkey, msghash, signature) => {
    return ECPairFactory(ecc).fromPublicKey(pubkey).verify(msghash, signature);
};

type SelectUtxos = {
    utxos: any[];
    amount: number;
    vins: number;
    vouts: number;
    recommendedFeeRate: number;
};

type GenerateDeezyPSBTListingForBid = {
    paymentAddress: string;
    bidPrice: number;
    utxoPrice: number;
    paymentUtxos: any[];
    psbt: any;
    paymentPublicKey: string;
    ordinalsPublicKey: string;
    selectedFeeRate: number;
};

const OpenOrdex = function (config) {
    const utxoModule = Utxo(config);
    const cryptoModule = Crypto(config);
    const addressModule = Address(config);
    const psbtModule = Psbt(config);

    const ordexModule = {
        isSaleOrder: (order) => {
            return order.tags.find((x) => x?.[0] === 's')?.[1];
        },

        getInscriptionId: (order) => {
            return order.tags.find((x) => x?.[0] === 'i')[1];
        },

        getInscriptionDataById: async (inscriptionId, verifyIsInscriptionNumber?) => {
            const html = await fetch(`${config.ORDINALS_EXPLORER_URL}/inscription/${inscriptionId}`).then((response) =>
                response.text()
            );

            // Refactor the map to not reassign x[2]
            const data = [...html.matchAll(/<dt>(.*?)<\/dt>\s*<dd.*?>(.*?)<\/dd>/gm)]
                .map((x) => {
                    // eslint-disable-next-line no-param-reassign
                    x[2] = x[2].replace(/<.*?>/gm, '');
                    return x;
                })
                .reduce((a, b) => ({ ...a, [b[1]]: b[2] }), {});

            const error = `Inscription ${
                verifyIsInscriptionNumber || inscriptionId
            } not found (maybe you're on signet and looking for a mainnet inscription or vice versa)`;
            try {
                // use array destructuring to get the first match of html.match(/<h1>Inscription (\d*)<\/h1>/)
                // @ts-ignore
                const [_, number] = html.match(/<h1>Inscription (\d*)<\/h1>/);
                // @ts-ignore
                data.number = number;
            } catch {
                throw new Error(error);
            }
            // @ts-ignore
            if (verifyIsInscriptionNumber && String(data.number) !== String(verifyIsInscriptionNumber)) {
                throw new Error(error);
            }

            return data;
        },

        validatePbst: (psbt, utxo, validateSignatures = false) => {
            const sellerInput = psbt.txInputs[0];
            const sellerSignedPsbtInput = `${sellerInput.hash.reverse().toString('hex')}:${sellerInput.index}`;

            if (sellerSignedPsbtInput !== utxo) {
                throw new Error(`Seller signed PSBT does not match this inscription\n\n${sellerSignedPsbtInput}`);
            }

            if (psbt.txInputs.length !== 1 || psbt.txInputs.length !== 1) {
                throw new Error(`Invalid seller signed PSBT`);
            }

            try {
                psbt.extractTransaction(true);
            } catch (e) {
                // @ts-ignore
                if (e.message === 'Not finalized') {
                    throw new Error('PSBT not signed');
                }

                // @ts-ignore
                if (e.message !== 'Outputs are spending more than Inputs') {
                    // @ts-ignore
                    throw new Error(`Invalid PSBT ${e.message || e}`);
                }
            }

            if (validateSignatures) {
                try {
                    const input = psbt.data.inputs[0];
                    const validator = input.tapInternalKey ? schnorrValidator : ecdsaValidator;

                    const valid = psbt.validateSignaturesOfAllInputs(validator);
                    if (!valid) {
                        throw new Error('Invalid signature');
                    }
                } catch (e) {
                    // @ts-ignores
                    throw new Error(`Invalid PSBT ${e.message || e}`);
                }
            }
        },

        getPsbtPrice: (psbt) => {
            const sellerOutput = psbt.txOutputs[0];
            return Number(sellerOutput.value);
        },

        getOrderInformation: async (order) => {
            let sellerSignedPsbt: bitcoin.Psbt;

            const psbtContent = order.content;

            try {
                sellerSignedPsbt = psbtModule.getPsbt(psbtContent);
            } catch (error) {
                console.error(error);
                throw new Error('Invalid PSBT', psbtContent);
            }

            const inscriptionId = ordexModule.getInscriptionId(order);

            // TODO: Remove this call, not needed.
            const inscription = await ordexModule.getInscriptionDataById(inscriptionId);

            // @ts-ignore
            ordexModule.validatePbst(sellerSignedPsbt, inscription.output);

            const value = ordexModule.getPsbtPrice(sellerSignedPsbt);

            return {
                inscriptionId,
                ...order,
                value,
            };
        },

        selectUtxos: async ({ utxos, amount, vins, vouts, recommendedFeeRate }: SelectUtxos) => {
            const selectedUtxos = [];
            let selectedAmount = 0;

            // Sort descending by value, and filter out unconfirmed utxos greater than 10.000 sats
            const spendableUtxos = utxos
                .filter((x) => x.status.confirmed && x.value >= 10000)
                .sort((a, b) => b.value - a.value); //

            for (const utxo of spendableUtxos) {
                // Never spend a utxo that contains an inscription for cardinal purposes
                if (await utxoModule.doesUtxoContainInscription(utxo)) {
                    continue;
                }
                // @ts-ignore
                selectedUtxos.push(utxo);
                selectedAmount += utxo.value;

                const calculatedFee = cryptoModule.calculateFee({
                    vins: vins + selectedUtxos.length,
                    vouts,
                    recommendedFeeRate,
                });
                if (selectedAmount >= amount + calculatedFee) {
                    break;
                }
            }

            if (selectedAmount < amount) {
                throw new Error(`Not enough cardinal spendable funds.
        Address has:  ${cryptoModule.satToBtc(selectedAmount)} BTC
        Needed:          ${cryptoModule.satToBtc(amount)} BTC`);
            }

            return selectedUtxos;
        },

        getAvailableUtxosWithoutInscription: async ({ address, price }) => {
            const payerUtxos = await utxoModule.getAddressUtxos(address);
            if (!payerUtxos.length) {
                throw new Error(`No utxos found for address ${address}`);
            }

            // We require at least 2 dummy utxos for taker
            const dummyUtxos = [];
            // Sort ascending by value, and filter out unconfirmed utxos
            const potentialDummyUtxos = payerUtxos.filter((x) => x.status.confirmed).sort((a, b) => a.value - b.value);
            for (const potentialDummyUtxo of potentialDummyUtxos) {
                if (!(await utxoModule.doesUtxoContainInscription(potentialDummyUtxo))) {
                    // Dummy utxo found
                    // @ts-ignore
                    dummyUtxos.push(potentialDummyUtxo);
                    if (dummyUtxos.length === config.NUMBER_OF_DUMMY_UTXOS_TO_CREATE) {
                        break;
                    }
                }
            }

            let minimumValueRequired;
            let vins;
            let vouts;

            if (dummyUtxos.length < 2) {
                // showDummyUtxoElements();
                minimumValueRequired = config.NUMBER_OF_DUMMY_UTXOS_TO_CREATE * config.DUMMY_UTXO_VALUE;
                vins = 0;
                vouts = config.NUMBER_OF_DUMMY_UTXOS_TO_CREATE;
            } else {
                minimumValueRequired = price + config.NUMBER_OF_DUMMY_UTXOS_TO_CREATE * config.DUMMY_UTXO_VALUE;
                vins = 1;
                vouts = 2 + config.NUMBER_OF_DUMMY_UTXOS_TO_CREATE;
            }

            const recommendedFeeRate = await cryptoModule.fetchRecommendedFee();

            const selectedUtxos = await ordexModule.selectUtxos({
                utxos: payerUtxos,
                amount: minimumValueRequired,
                vins,
                vouts,
                recommendedFeeRate,
            });

            return { selectedUtxos, dummyUtxos };
        },

        getAvailableUtxosWithoutDummies: async ({ address, price, psbt, fee, selectedFeeRate }) => {
            const payerUtxos = await utxoModule.getAddressUtxos(address);
            if (!payerUtxos.length) {
                throw new Error(`No utxos found for address ${address}`);
            }

            // We require at least 2 dummy utxos for taker
            const dummyUtxos = [psbt.data.inputs[0].witnessUtxo.value, psbt.data.inputs[1].witnessUtxo.value];

            let minimumValueRequired;
            let vins;
            let vouts;

            minimumValueRequired =
                price + psbt.data.inputs[0].witnessUtxo.value + psbt.data.inputs[1].witnessUtxo.value;
            vins = 1;
            vouts = 2;

            const feeRate = fee || selectedFeeRate || (await cryptoModule.fetchRecommendedFee());

            const selectedUtxos = await ordexModule.selectUtxos({
                utxos: payerUtxos,
                amount: minimumValueRequired,
                vins,
                vouts,
                recommendedFeeRate: feeRate,
            });

            return { selectedUtxos, dummyUtxos };
        },

        getFundingUtxos: async ({ address, price, psbt, selectedFeeRate }) => {
            const payerUtxos = await utxoModule.getAddressUtxos(address);
            if (!payerUtxos.length) {
                throw new Error(`No utxos found for address ${address}`);
            }

            // Just take the dummy utxos
            // price amount + dummy amount
            const minimumValueRequired = psbt.data.inputs
                .filter((i) => !i.nonWitnessUtxo)
                .reduce((acc, curr) => curr.witnessUtxo.value + acc, price);

            if (typeof selectedFeeRate !== 'number' || selectedFeeRate <= 0) throw new Error('Invalid fee rate.');

            const selectedUtxos = await ordexModule.selectUtxos({
                utxos: payerUtxos,
                amount: minimumValueRequired,
                vins: psbt.data.inputs.length,
                vouts: psbt.data.outputs.length,
                recommendedFeeRate: selectedFeeRate,
            });

            return { selectedUtxos };
        },

        generatePSBTListingInscriptionForSale: async ({ utxo, paymentAddress, price, pubkey }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            let inputAddressInfo;
            if (provider === 'xverse') {
                inputAddressInfo = await addressModule.getAddressInfo(pubkey);
            }

            const psbt = new bitcoin.Psbt({ network: config.NETWORK });
            const ordinalUtxoTxId = utxo.txid;
            const ordinalUtxoVout = utxo.vout;

            const tx = bitcoin.Transaction.fromHex(await cryptoModule.getTxHexById(ordinalUtxoTxId));

            for (const output in tx.outs) {
                try {
                    tx.setWitness(parseInt(output), []);
                } catch {}
            }

            const input = {
                hash: ordinalUtxoTxId,
                index: parseInt(ordinalUtxoVout, 10),
                witnessUtxo: tx.outs[ordinalUtxoVout],
                // Maybe we should add it
                // eslint-disable-next-line no-bitwise
                sighashType: bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY,
                sequence: 0xfffffffd,
                ...(inputAddressInfo
                    ? { tapInternalKey: inputAddressInfo.tapInternalKey }
                    : { nonWitnessUtxo: tx.toBuffer() }),
            };

            psbt.addInput(input);

            psbt.addOutput({
                address: paymentAddress,
                value: price,
            });

            return psbt;
        },

        generateBidPSBT: async ({ utxo, ownerAddresss, price }) => {
            const psbt = new bitcoin.Psbt({ network: config.NETWORK });
            const ordinalUtxoTxId = utxo.txid;
            const ordinalUtxoVout = utxo.vout;

            const tx = bitcoin.Transaction.fromHex(await cryptoModule.getTxHexById(ordinalUtxoTxId));

            for (const output in tx.outs) {
                try {
                    tx.setWitness(parseInt(output), []);
                } catch {}
            }

            const input = {
                hash: ordinalUtxoTxId,
                index: parseInt(ordinalUtxoVout, 10),
                witnessUtxo: tx.outs[ordinalUtxoVout],
                // Maybe we should add it
                // eslint-disable-next-line no-bitwise
                sequence: 0xfffffffd,
                nonWitnessUtxo: tx.toBuffer(),
            };

            psbt.addInput(input);

            psbt.addOutput({
                address: ownerAddresss,
                value: price,
            });

            return psbt;
        },

        generatePSBTListingInscriptionForBuy: async ({
            paymentAddress,
            receiverAddress,
            price,
            paymentUtxos,
            dummyUtxos,
            sellerSignedPsbt,
            inscription,
        }) => {
            const psbt = new bitcoin.Psbt({ network: config.NETWORK });

            let totalPaymentValue = 0;
            let totalDummyValue = 0;

            // Add dummy utxo inputs
            for (const dummyUtxo of dummyUtxos) {
                const txHex = await cryptoModule.getTxHexById(dummyUtxo.txid);
                const tx = bitcoin.Transaction.fromHex(txHex);
                for (const output in tx.outs) {
                    try {
                        tx.setWitness(parseInt(output), []);
                    } catch {}
                }
                psbt.addInput({
                    hash: dummyUtxo.txid,
                    index: dummyUtxo.vout,
                    nonWitnessUtxo: tx.toBuffer(),
                });

                totalDummyValue += dummyUtxo.value;
            }

            // Add value A+B dummy output
            psbt.addOutput({
                address: receiverAddress,
                value: totalDummyValue,
            });

            // Add input for the ordinal to be sold
            psbt.addInput({
                ...sellerSignedPsbt.data.globalMap.unsignedTx.tx.ins[0],
                ...sellerSignedPsbt.data.inputs[0],
            });

            // Add output for the inscription
            psbt.addOutput({
                address: receiverAddress,
                value: inscription.value,
            });

            // Add output for the payment to the seller
            psbt.addOutput({
                ...sellerSignedPsbt.data.globalMap.unsignedTx.tx.outs[0],
            });

            // Add payment utxo inputs
            for (const utxo of paymentUtxos) {
                const utxoTx = bitcoin.Transaction.fromHex(await cryptoModule.getTxHexById(utxo.txid));
                for (const output in utxoTx.outs) {
                    try {
                        utxoTx.setWitness(parseInt(output), []);
                    } catch {}
                }

                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout,
                    nonWitnessUtxo: utxoTx.toBuffer(),
                });

                totalPaymentValue += utxo.value;
            }

            // Calculate change value and add output for change
            const recommendedFeeRate = await cryptoModule.fetchRecommendedFee();
            const fee = cryptoModule.calculateFee({
                vins: psbt.txInputs.length,
                vouts: psbt.txOutputs.length,
                recommendedFeeRate,
            });

            const changeValue = totalPaymentValue - totalDummyValue - price - fee;

            if (changeValue < 0) {
                const msg = `Your wallet address doesn't have enough funds to buy this inscription.
                Price:      ${cryptoModule.satToBtc(price)} BTC
                Fees:       ${cryptoModule.satToBtc(fee)} BTC
                You have:   ${cryptoModule.satToBtc(totalPaymentValue)} BTC
                Required:   ${cryptoModule.satToBtc(price + fee)} BTC
                Missing:    ${cryptoModule.satToBtc(-changeValue)} BTC`;
                throw new Error(msg);
            }

            psbt.addOutput({
                address: paymentAddress,
                value: changeValue,
            });

            return psbt;
        },
        calculateRequiredFeeForBuy: async ({ price, paymentUtxos, psbt, selectedFeeRate }) => {
            let totalPaymentValue = 0;
            const totalDummyValue = psbt.data.inputs[0].witnessUtxo.value + psbt.data.inputs[1].witnessUtxo.value;
            for (const utxo of paymentUtxos) {
                totalPaymentValue += utxo.value;
            }

            const fee = cryptoModule.calculateFee({
                vins: psbt.txInputs.length + paymentUtxos.length,
                vouts: psbt.txOutputs.length,
                recommendedFeeRate: selectedFeeRate,
            });
            const changeValue = totalPaymentValue - totalDummyValue - price - fee;
            return { changeValue, totalPaymentValue, fee, totalDummyValue };
        },
        calculateRequiredFeeForBid: async ({ bidPrice, utxoPrice, paymentUtxos, psbt, selectedFeeRate }) => {
            let totalPaymentValue = 0;
            for (const utxo of paymentUtxos) {
                totalPaymentValue += utxo.value;
            }

            const fee = cryptoModule.calculateFee({
                vins: psbt.txInputs.length + paymentUtxos.length,
                vouts: psbt.txOutputs.length,
                recommendedFeeRate: selectedFeeRate,
            });
            const changeValue = utxoPrice + totalPaymentValue - bidPrice - fee - 10000; // 10000: fixed output value for bid
            return { changeValue, totalPaymentValue, fee };
        },
        generateDeezyPSBTListingForBuy: async ({
            paymentAddress,
            price,
            paymentUtxos,
            psbt,
            paymentPublicKey,
            ordinalsPublicKey = null,
            selectedFeeRate = null,
        }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            const isXverse = provider === 'xverse';
            const paymentAddressInfo = isXverse ? await addressModule.getPaymentAddressInfo(paymentPublicKey) : null;

            // For some reason, when adding the input to psbt it doesn't work, it throws an error
            // but cloning the same psbt to another one works fine
            const psbtx = bitcoin.Psbt.fromBase64(psbt.toBase64(), { network: NETWORK });

            // for (const dummyUtxo of psbt.data.inputs) {
            //     if (dummyUtxo.witnessUtxo) {
            //         totalDummyValue += dummyUtxo.witnessUtxo.value;
            //     }
            // }

            // Add payment utxo inputs
            for (const utxo of paymentUtxos) {
                if (provider !== 'unisat.io') {
                    const utxoTx = bitcoin.Transaction.fromHex(await cryptoModule.getTxHexById(utxo.txid));
                    for (const output in utxoTx.outs) {
                        try {
                            utxoTx.setWitness(parseInt(output), []);
                        } catch {}
                    }

                    const { redeemScript, script } = paymentAddressInfo || {};

                    const inputData = {
                        hash: utxo.txid,
                        index: utxo.vout,
                        ...(!isXverse ? { nonWitnessUtxo: utxoTx.toBuffer() } : {}),
                        ...(redeemScript && script
                            ? {
                                  redeemScript,
                                  witnessUtxo: {
                                      script: script,
                                      value: Number(utxo.value),
                                  },
                              }
                            : {}),
                        sequence: 0xfffffffd,
                        sighashType: bitcoin.Transaction.SIGHASH_ALL,
                    };

                    psbtx.addInput(inputData);
                }

                if (provider === 'unisat.io') {
                    const inputAddressInfo = await addressModule.getAddressInfo(ordinalsPublicKey);
                    const inputParams = await psbtModule.getInputParams({
                        utxo,
                        inputAddressInfo,
                        sighashType: bitcoin.Transaction.SIGHASH_ALL,
                    });
                    psbtx.addInput(inputParams);
                }
            }

            const { changeValue, totalPaymentValue, fee } = await ordexModule.calculateRequiredFeeForBuy({
                price,
                paymentUtxos,
                psbt,
                selectedFeeRate,
            });

            if (changeValue < 0) {
                const msg = `Your wallet address doesn't have enough funds to buy this inscription.
              Price:      ${cryptoModule.satToBtc(price)} BTC
              Fees:       ${cryptoModule.satToBtc(fee)} BTC
              You have:   ${cryptoModule.satToBtc(totalPaymentValue)} BTC
              Required:   ${cryptoModule.satToBtc(price + fee)} BTC
              Missing:    ${cryptoModule.satToBtc(-changeValue)} BTC`;
                throw new Error(msg);
            }

            psbtx.addOutput({
                address: paymentAddress,
                value: changeValue,
            });

            return { psbt: psbtx };
        },
        generateDeezyPSBTListingForBid: async ({
            paymentAddress,
            bidPrice,
            utxoPrice,
            paymentUtxos,
            psbt,
            paymentPublicKey,
            ordinalsPublicKey,
            selectedFeeRate,
        }: GenerateDeezyPSBTListingForBid) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            const isXverse = provider === 'xverse';
            const paymentAddressInfo = isXverse ? await addressModule.getPaymentAddressInfo(paymentPublicKey) : null;

            const psbtx = bitcoin.Psbt.fromBase64(psbt.toBase64(), { network: NETWORK });

            // Add payment utxo inputs
            for (const utxo of paymentUtxos) {
                if (provider !== 'unisat.io') {
                    const utxoTx = bitcoin.Transaction.fromHex(await cryptoModule.getTxHexById(utxo.txid));
                    for (const output in utxoTx.outs) {
                        try {
                            utxoTx.setWitness(parseInt(output), []);
                        } catch {}
                    }

                    const { redeemScript, script } = paymentAddressInfo || {};

                    const inputData = {
                        hash: utxo.txid,
                        index: utxo.vout,
                        ...(!isXverse ? { nonWitnessUtxo: utxoTx.toBuffer() } : {}),
                        ...(redeemScript && script
                            ? {
                                  redeemScript,
                                  witnessUtxo: {
                                      script: script,
                                      value: Number(utxo.value),
                                  },
                              }
                            : {}),
                        sequence: 0xfffffffd,
                        sighashType: bitcoin.Transaction.SIGHASH_ALL,
                    };

                    psbtx.addInput(inputData);
                }

                if (provider === 'unisat.io') {
                    const inputAddressInfo = await addressModule.getAddressInfo(ordinalsPublicKey);
                    const inputParams = await psbtModule.getInputParams({
                        utxo,
                        inputAddressInfo,
                        sighashType: bitcoin.Transaction.SIGHASH_ALL,
                    });
                    psbtx.addInput(inputParams);
                }
            }

            const { changeValue, totalPaymentValue, fee } = await ordexModule.calculateRequiredFeeForBid({
                bidPrice,
                utxoPrice,
                paymentUtxos,
                psbt,
                selectedFeeRate,
            });

            if (changeValue < 0) {
                const msg = `Your wallet address doesn't have enough funds to buy this inscription.
              Price:      ${cryptoModule.satToBtc(bidPrice)} BTC
              Fees:       ${cryptoModule.satToBtc(fee)} BTC
              You have:   ${cryptoModule.satToBtc(totalPaymentValue)} BTC
              Required:   ${cryptoModule.satToBtc(bidPrice + fee)} BTC
              Missing:    ${cryptoModule.satToBtc(-changeValue)} BTC`;
                throw new Error(msg);
            }

            psbtx.addOutput({
                address: paymentAddress,
                value: changeValue,
            });

            return { psbt: psbtx };
        },
    };

    return ordexModule;
};

export { OpenOrdex };
