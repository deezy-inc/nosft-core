import { TESTNET, NOSTR_RELAY_URL, NOSTR_KIND_INSCRIPTION } from './constants';
import { getAddress, toXOnly } from './address';
import { getUtxos } from './utxos';
import { relayInit, getEventHash, Relay } from 'nostr-tools';
import { serializeTaprootSignature } from 'bitcoinjs-lib/src/psbt/bip371';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { Observable } from 'rxjs';

const isBrowser = typeof window !== 'undefined';

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

export {};
