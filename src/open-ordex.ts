import { TESTNET, NOSTR_RELAY_URL, NOSTR_KIND_INSCRIPTION } from './constants';
import { getAddress, toXOnly } from './address';
import { getUtxos } from './utxos';
import { relayInit, getEventHash, Relay, Event } from 'nostr-tools';
import { serializeTaprootSignature } from 'bitcoinjs-lib/src/psbt/bip371';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { Observable } from 'rxjs';
import { SaleOrder } from './types';

const nostrOrderEventKind = 802;
const isProduction = !TESTNET;
const isBrowser = typeof window !== 'undefined';
const ordinalsExplorerUrl = isProduction ? 'https://ordinals.com' : 'https://explorer-signet.openordex.org';
const network = isProduction ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const networkName = isProduction ? 'mainnet' : 'signet';
const baseMempoolUrl = isProduction ? 'https://mempool.space' : 'https://mempool.space/signet';
const baseMempoolApiUrl = `${baseMempoolUrl}/api`;
const exchangeName = 'nosft';

type Order = {}; // TODO: fix me

interface OpenOrdexFactoryOptions {
    nostrRelayUrl: string;
    bitcoinPriceApiUrl: string;
    baseMempoolApiUrl: string;
    feeLevel: string;
    network: any; // Replace this with the actual Network type if available
}

type fetchBitcoinPriceProps = {
    bitcoinPriceApiUrl: string;
    baseMempoolApiUrl: string;
    feeLevel: string;
};

async function fetchBitcoinPrice({ bitcoinPriceApiUrl, baseMempoolApiUrl, feeLevel }: fetchBitcoinPriceProps): Promise<{
    bitcoinPrice: number;
    recommendedFeeRate: number;
}> {
    const bitcoinPriceResponse = await fetch(bitcoinPriceApiUrl);
    const bitcoinPriceData = await bitcoinPriceResponse.json();
    const bitcoinPrice = bitcoinPriceData.USD.last;

    const recommendedFeeRateResponse = await fetch(`${baseMempoolApiUrl}/v1/fees/recommended`);
    const recommendedFeeRateData = await recommendedFeeRateResponse.json();
    const recommendedFeeRate = recommendedFeeRateData[feeLevel];

    return { bitcoinPrice, recommendedFeeRate };
}

async function getInscriptionHtml(inscriptionId: string): Promise<string> {
    const response = await fetch(`${ordinalsExplorerUrl}/inscription/${inscriptionId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch inscription data for ID ${inscriptionId}`);
    }
    const html = await response.text();
    return html;
}

async function doesUtxoContainInscription(utxo: { txid: string; vout: number }): Promise<boolean> {
    const html = await fetch(`${ordinalsExplorerUrl}/output/${utxo.txid}:${utxo.vout}`).then((response) =>
        response.text()
    );

    return html.match(/class=thumbnails/) !== null;
}

function btcToSat(btc: number): number {
    return Math.floor(Number(btc) * 10 ** 8);
}

function satToBtc(sat: number): number {
    return Number(sat) / 10 ** 8;
}

function calculateFee(vins: number, vouts: number, recommendedFeeRate: number, includeChangeOutput = true): number {
    const baseTxSize = 10;
    const inSize = 180;
    const outSize = 34;

    const txSize = baseTxSize + vins * inSize + vouts * outSize + (includeChangeOutput ? outSize : 0);
    const fee = txSize * recommendedFeeRate;

    return fee;
}

async function selectUtxos(
    utxos: { value: number; txid: string; vout: number }[],
    amount: number,
    vins: number,
    vouts: number,
    recommendedFeeRate: number,
    dummyUtxoValue: number
): Promise<{ value: number; txid: string; vout: number }[]> {
    const selectedUtxos: { value: number; txid: string; vout: number }[] = [];
    let selectedAmount = 0;

    // Sort descending by value, and filter out dummy utxos
    utxos = utxos.filter((x) => x.value > dummyUtxoValue).sort((a, b) => b.value - a.value);

    for (const utxo of utxos) {
        // Never spend a utxo that contains an inscription for cardinal purposes
        if (await doesUtxoContainInscription(utxo)) {
            continue;
        }
        selectedUtxos.push(utxo);
        selectedAmount += utxo.value;

        if (
            selectedAmount >=
            amount + dummyUtxoValue + calculateFee(vins + selectedUtxos.length, vouts, recommendedFeeRate)
        ) {
            break;
        }
    }

    if (selectedAmount < amount) {
        throw new Error(`Not enough cardinal spendable funds.
Address has:  ${satToBtc(selectedAmount)} BTC
Needed:          ${satToBtc(amount)} BTC`);
    }

    return selectedUtxos;
}

async function getInscriptionDataById(
    inscriptionId: string,
    verifyIsInscriptionNumber?: string
): Promise<RawInscriptionData> {
    const html = await getInscriptionHtml(inscriptionId);

    const data: { [key: string]: string } = [...html.matchAll(/<dt>(.*?)<\/dt>\s*<dd.*?>(.*?)<\/dd>/gm)]
        .map((x) => {
            x[2] = x[2].replace(/<.*?>/gm, '');
            return x;
        })
        .reduce((a, b) => ({ ...a, [b[1]]: b[2] }), {});

    const error = `Inscription ${
        verifyIsInscriptionNumber || inscriptionId
    } not found (maybe you're on signet and looking for a mainnet inscription or vice versa)`;

    let inscriptionNumber;

    try {
        const numberMatch = html.match(/<h1>Inscription (\d*)<\/h1>/);
        if (numberMatch) {
            inscriptionNumber = numberMatch[1];
        } else {
            console.error(`Failed to find inscription number for ID ${inscriptionId}`);
        }
    } catch (error) {
        console.error(`Failed to parse inscription data for ID ${inscriptionId}: ${error}`);
    }

    if (verifyIsInscriptionNumber && String(inscriptionNumber) !== verifyIsInscriptionNumber) {
        throw new Error(error);
    }

    return { ...data, number: inscriptionNumber || '' } as RawInscriptionData;
}

function isSaleOrder(order: NostrEvent): string | undefined {
    return order.tags.find((x) => x?.[0] == 's')?.[1];
}

function getInscriptionId(order: NostrEvent): string {
    return order.tags.find((x) => x?.[0] == 'i')?.[1] || '';
}

function isProcessed(orders: NostrEvent[], inscriptionId: string): NostrEvent | undefined {
    return orders.find((x) => x.id === inscriptionId);
}

function satsToFormattedDollarString(sats: number, bitcoinPrice: number): string {
    const btc = satToBtc(sats);
    const usd = btc * bitcoinPrice;
    return usd.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

class OpenOrdexFactory {
    private txHexByIdCache: { [txId: string]: string } = {};
    connected: boolean;
    bitcoinPrice: number | undefined;
    recommendedFeeRate: number | undefined;
    nostrRelay: Relay;
    orders: { [key: string]: Order }; // TODO: fix me
    sellerSignedPsbt: any;
    price: number | undefined;
    paymentUtxos: any;
    dummyUtxo: any;

    constructor(private options: OpenOrdexFactoryOptions) {
        this.connected = false;
        this.bitcoinPrice = undefined;
        this.recommendedFeeRate = undefined;
        this.nostrRelay = relayInit(options.nostrRelayUrl);
        this.orders = {};
        this.sellerSignedPsbt = undefined;
        this.price = undefined;
        this.paymentUtxos = undefined;
        this.dummyUtxo = undefined;
        this.connect();
    }

    async connect() {
        if (this.connected || !isBrowser) return;
        await this.nostrRelay.connect();
        this.connected = true;
        try {
            await this.initBitcoinPrice();
        } catch (err) {}
    }

    async initBitcoinPrice() {
        const { bitcoinPrice, recommendedFeeRate } = await fetchBitcoinPrice({
            bitcoinPriceApiUrl: this.options.bitcoinPriceApiUrl,
            baseMempoolApiUrl: this.options.baseMempoolApiUrl,
            feeLevel: this.options.feeLevel,
        });
        this.bitcoinPrice = bitcoinPrice;
        this.recommendedFeeRate = recommendedFeeRate;
    }

    async getBitcoinPrice(): Promise<number> {
        if (!this.bitcoinPrice) {
            await this.initBitcoinPrice();
        }
        if (!this.bitcoinPrice) throw new Error(`Error getting Bitcoin price`);
        return this.bitcoinPrice;
    }

    async validateSellerPSBTAndExtractPrice(sellerSignedPsbtBase64: string, utxo: string): Promise<number | undefined> {
        try {
            this.sellerSignedPsbt = bitcoin.Psbt.fromBase64(sellerSignedPsbtBase64, {
                network,
            });
            const sellerInput = this.sellerSignedPsbt.txInputs[0];
            const sellerSignedPsbtInput = `${sellerInput.hash.reverse().toString('hex')}:${sellerInput.index}`;

            if (sellerSignedPsbtInput !== utxo) {
                throw `Seller signed PSBT does not match this inscription\n\n${sellerSignedPsbtInput}\n!=\n${utxo}`;
            }

            if (this.sellerSignedPsbt.txInputs.length !== 1 || this.sellerSignedPsbt.txInputs.length !== 1) {
                throw `Invalid seller signed PSBT`;
            }

            try {
                await this.sellerSignedPsbt.extractTransaction(true);
            } catch (e) {
                if (e! instanceof Error) {
                    if (e.message === 'Not finalized') {
                        throw 'PSBT not signed';
                    } else if (e.message !== 'Outputs are spending more than Inputs') {
                        throw 'Invalid PSBT ' + e.message;
                    }
                } else {
                    throw 'Invalid PSBT ' + e;
                }
            }

            const sellerOutput = this.sellerSignedPsbt.txOutputs[0];
            this.price = sellerOutput.value;

            return Number(this.price);
        } catch (e) {
            console.error(e);
        }
    }

    async getProcessedOrder(order: NostrEvent, orders: NostrEvent[] = []): Promise<SaleOrder | undefined> {
        if (!isSaleOrder(order)) return;

        const inscriptionId = getInscriptionId(order);
        if (isProcessed(orders, inscriptionId)) return;

        const inscriptionDataResponse = await fetch(`https://turbo.ordinalswallet.com/inscription/${inscriptionId}`);
        const inscriptionData = await inscriptionDataResponse.json();

        const inscriptionRawData = await getInscriptionDataById(inscriptionId);
        const validatedPrice = await this.validateSellerPSBTAndExtractPrice(order.content, inscriptionRawData.output);

        if (!validatedPrice) return;

        const btcPrice = await this.getBitcoinPrice();
        const newOrder: SaleOrder = {
            title: `$${satsToFormattedDollarString(validatedPrice, btcPrice)}`,
            txid: order.id,
            inscriptionId,
            value: validatedPrice,
            usdPrice: `$${satsToFormattedDollarString(validatedPrice, btcPrice)}`,
            ...order,
            ...inscriptionData,
        };

        return newOrder;
    }

    // can we clean the cache?
    async getTxHexById(txId: string): Promise<string> {
        if (!this.txHexByIdCache[txId]) {
            this.txHexByIdCache[txId] = await fetch(`${baseMempoolApiUrl}/tx/${txId}/hex`).then((response) =>
                response.text()
            );
        }

        return this.txHexByIdCache[txId];
    }

    async generatePSBTListingInscriptionForSale(
        ordinalOutput: string,
        price: number,
        paymentAddress: string
    ): Promise<string> {
        const psbt = new bitcoin.Psbt({ network });

        const pk = await window.nostr.getPublicKey();
        const publicKey = Buffer.from(pk, 'hex');
        const inputAddressInfo = getAddress(pk);

        const [ordinalUtxoTxId, ordinalUtxoVout] = ordinalOutput.split(':');
        const tx = bitcoin.Transaction.fromHex(await this.getTxHexById(ordinalUtxoTxId));
        for (const output in tx.outs) {
            try {
                tx.setWitness(parseInt(output), []);
            } catch {}
        }

        psbt.addInput({
            hash: ordinalUtxoTxId,
            index: parseInt(ordinalUtxoVout),
            witnessUtxo: {
                value: price,
                script: inputAddressInfo.output!, // TODO: check !
            },
            tapInternalKey: toXOnly(publicKey),
        });

        psbt.addOutput({
            address: paymentAddress,
            value: price, // @danny does this need outputValue(price, feeRate)?
        });

        // TODO: __CACHE is private
        const sigHash = psbt.__CACHE.__TX.hashForWitnessV1(
            0,
            [inputAddressInfo.output],
            [price],
            bitcoin.Transaction.SIGHASH_SINGLE | bitcoin.Transaction.SIGHASH_ANYONECANPAY
        );

        const sig = await window.nostr.signSchnorr(sigHash.toString('hex'));
        psbt.updateInput(0, {
            tapKeySig: serializeTaprootSignature(Buffer.from(sig, 'hex')),
        });

        psbt.finalizeAllInputs();
        return psbt.toBase64();
    }

    async publishSellerPsbt(
        signedSalePsbt: string,
        inscriptionId: string,
        inscriptionUtxo: string,
        priceInSats: number
    ): Promise<void> {
        const pk = await window.nostr.getPublicKey();

        const event: NostrEvent = {
            kind: NOSTR_KIND_INSCRIPTION,
            pubkey: pk,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['n', networkName], // Network name (e.g. "mainnet", "signet")
                ['t', 'sell'], // Type of order (e.g. "sell", "buy")
                ['i', inscriptionId], // Inscription ID
                ['u', inscriptionUtxo], // Inscription UTXO
                ['s', priceInSats.toString()], // Price in sats
                ['x', exchangeName], // Exchange name (e.g. "openordex")
            ],
            content: signedSalePsbt,
            id: '', // This value will be set later
            sig: '', // This value will be set later
        };

        event.id = getEventHash(event);
        const signedEvent = await window.nostr.signEvent(event);

        await this.nostrRelay.publish(signedEvent);
    }

    // TODO: fix type
    async submitSignedSalePsbt(inscription: any, price: number, signedSalePsbt: string): Promise<void> {
        try {
            bitcoin.Psbt.fromBase64(signedSalePsbt, {
                network,
            }).extractTransaction(true);
        } catch (e: any) {
            if (e.message === 'Not finalized') {
                return alert('Please sign and finalize the PSBT before submitting it');
            }
            if (e.message !== 'Outputs are spending more than Inputs') {
                console.error(e);
                return alert(`Invalid PSBT ${e.message || e}`);
            }
        }

        try {
            await this.publishSellerPsbt(
                signedSalePsbt,
                inscription.inscriptionId,
                inscription.txid, // TODO: Make sure this is the correct UTXO
                btcToSat(price)
            );
        } catch (e: any) {
            console.error(e);
            alert(`Error publishing seller PSBT ${e.message || e}`);
        }
    }
}

////////////////////////////////////////////////////////////////
// TYPES
////////////////////////////////////////////////////////////////

interface RawInscriptionData {
    id: string;
    address: string;
    'output value': string;
    sat: string;
    preview: string;
    content: string;
    'content length': string;
    'content type': string;
    timestamp: string;
    'genesis height': string;
    'genesis fee': string;
    'genesis transaction': string;
    location: string;
    output: string;
    offset: string;
    number: string;
}

type NostrEvent = Event;
