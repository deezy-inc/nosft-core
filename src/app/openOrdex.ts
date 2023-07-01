/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue, react/forbid-prop-types, radix, no-empty, guard-for-in */
import { NETWORK } from '../config/constants';
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';
import { Address } from './address';
import { Crypto } from './crypto';
import { Utxo } from './utxo';
import * as bitcoin from 'bitcoinjs-lib';
// @ts-ignore
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const OpenOrdex = function (config) {
    const utxoModule = Utxo(config);
    const cryptoModule = Crypto(config);
    const addressModule = Address(config);

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

        validatePbst: (psbt, utxo) => {
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
        },

        getPsbtPrice: (psbt) => {
            const sellerOutput = psbt.txOutputs[0];
            return Number(sellerOutput.value);
        },

        getOrderInformation: async (order) => {
            const sellerSignedPsbt = bitcoin.Psbt.fromBase64(order.content, {
                network: config.NETWORK,
            });

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

        selectUtxos: async ({ utxos, dummyUtxos, amount, vins, vouts, recommendedFeeRate }) => {
            const selectedUtxos = [];
            let selectedAmount = 0;

            // Sort ascending by value, and filter out unconfirmed utxos
            const spendableUtxos = utxos.filter((x) => x.status.confirmed).sort((a, b) => a.value - b.value);

            for (const utxo of spendableUtxos) {
                // Never spend a utxo that contains an inscription for cardinal purposes
                if (await utxoModule.doesUtxoContainInscription(utxo)) {
                    continue;
                }
                if (dummyUtxos.includes(utxo)) {
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
            debugger;
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
                dummyUtxos,
                amount: minimumValueRequired,
                vins,
                vouts,
                recommendedFeeRate,
            });

            return { selectedUtxos, dummyUtxos };
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

        generatePSBTListingInscriptionForBuy: async ({
            payerAddress,
            payerPubkey,
            receiverAddress,
            price,
            paymentUtxos,
            dummyUtxos,
            sellerSignedPsbt,
            inscription,
        }) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            let redeemScript;

            if (provider === 'xverse') {
                // Calculate P2WPKH script
                const wpkh = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(payerPubkey, 'hex'), network: NETWORK });
                if (wpkh) {
                    redeemScript = wpkh.output;
                }
            }

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

                debugger;
                psbt.addInput({
                    hash: dummyUtxo.txid,
                    index: dummyUtxo.vout,
                    nonWitnessUtxo: tx.toBuffer(),
                    ...(redeemScript ? { redeemScript } : {}),
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
                address: payerAddress,
                value: changeValue,
            });

            debugger;

            return psbt;
        },
    };

    return ordexModule;
};

export { OpenOrdex };
