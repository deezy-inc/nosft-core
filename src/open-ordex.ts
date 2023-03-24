import { TESTNET, NOSTR_RELAY_URL, NOSTR_KIND_INSCRIPTION } from './constants';
import { getAddress, toXOnly } from './address';
import { getUtxos } from './utxos';
import { relayInit, getEventHash, Relay } from 'nostr-tools';
import { serializeTaprootSignature } from 'bitcoinjs-lib/src/psbt/bip371';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { Observable } from 'rxjs';

const isProduction = !TESTNET;
const isBrowser = typeof window !== 'undefined';
const ordinalsExplorerUrl = isProduction ? 'https://ordinals.com' : 'https://explorer-signet.openordex.org';

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

async function doesUtxoContainInscription(utxo: { txid: string; vout: number }): Promise<boolean> {
    const html = await fetch(`${ordinalsExplorerUrl}/output/${utxo.txid}:${utxo.vout}`).then((response) =>
        response.text()
    );

    return html.match(/class=thumbnails/) !== null;
}

function satsToFormattedDollarString(sats: number, bitcoinPrice: number): string {
    return (satToBtc(sats) * bitcoinPrice).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
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

class OpenOrdexFactory {
    connected: boolean;
    bitcoinPrice: number | undefined;
    recommendedFeeRate: number | undefined;
    nostrRelay: Relay;
    orders: { [key: string]: Order }; // TODO: fix me
    txHexByIdCache: { [key: string]: string };
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
        this.txHexByIdCache = {};
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
}
