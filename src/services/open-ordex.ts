import { Event } from 'nostr-tools';
import * as bitcoin from 'bitcoinjs-lib';
import axios from 'axios';

import { FeeLevel, RawInscriptionData } from '../types/open-order';
import { TESTNET } from '../config/constants';
import { SaleOrder } from '../types/relay';

const isProduction = !TESTNET;
const ordinalsExplorerUrl = isProduction ? 'https://ordinals.com' : 'https://explorer-signet.openordex.org';
const network = isProduction ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const baseMempoolUrl = isProduction ? 'https://mempool.space' : 'https://mempool.space/signet';
const baseMempoolApiUrl = `${baseMempoolUrl}/api`;
const bitcoinPriceApiUrl = 'https://blockchain.info/ticker?cors=true';

function isSaleOrder(order: Event): string | undefined {
    return order.tags.find((x) => x?.[0] == 's')?.[1];
}

function getInscriptionId(order: Event): string {
    return order.tags.find((x) => x?.[0] == 'i')?.[1] || '';
}

function isProcessed(orders: Event[], inscriptionId: string): Event | undefined {
    return orders.find((x) => x.id === inscriptionId);
}

async function getInscriptionHtml(inscriptionId: string): Promise<string> {
    const response = await axios.get(`${ordinalsExplorerUrl}/inscription/${inscriptionId}`);
    const html = response.data;
    return html;
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

    return { ...data, number: inscriptionNumber || '' } as RawInscriptionData; // TODO: remove casting?
}

async function fetchBitcoinPrice(): Promise<{
    bitcoinPrice: number;
    recommendedFeeRate: number;
}> {
    const bitcoinPriceResponse = await axios.get(bitcoinPriceApiUrl);
    const bitcoinPriceData = bitcoinPriceResponse.data;
    const bitcoinPrice = bitcoinPriceData.USD.last;

    const recommendedFeeRateResponse = await axios.get(`${baseMempoolApiUrl}/v1/fees/recommended`);
    const recommendedFeeRateData = recommendedFeeRateResponse.data;
    const recommendedFeeRate = recommendedFeeRateData[FeeLevel.HourFee];

    return { bitcoinPrice, recommendedFeeRate };
}

function satToBtc(sat: number): number {
    return Number(sat) / 10 ** 8;
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
    private bitcoinPrice: number | undefined;
    private recommendedFeeRate: number | undefined;
    private sellerSignedPsbt: bitcoin.Psbt | undefined;
    private price: number | undefined;

    constructor() {
        this.bitcoinPrice = undefined;
        this.recommendedFeeRate = undefined;
        this.sellerSignedPsbt = undefined;
        this.price = undefined;
        try {
            this.initBitcoinPrice();
        } catch (err) {}
    }

    private async initBitcoinPrice() {
        const { bitcoinPrice, recommendedFeeRate } = await fetchBitcoinPrice();
        this.bitcoinPrice = bitcoinPrice;
        this.recommendedFeeRate = recommendedFeeRate;
    }

    private async getBitcoinPrice(): Promise<number> {
        if (!this.bitcoinPrice) {
            await this.initBitcoinPrice();
        }
        if (!this.bitcoinPrice) throw new Error(`Error getting Bitcoin price`);
        return this.bitcoinPrice;
    }

    private async validateSellerPSBTAndExtractPrice(
        sellerSignedPsbtBase64: string,
        utxo: string
    ): Promise<number | undefined> {
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

    async parseOrderEvent(order: Event, orders: Event[] = []): Promise<SaleOrder | undefined> {
        if (!isSaleOrder(order)) return;

        const inscriptionId = getInscriptionId(order);
        if (isProcessed(orders, inscriptionId)) return;

        const inscriptionDataResponse = await axios.get(
            `https://turbo.ordinalswallet.com/inscription/${inscriptionId}`
        );
        const inscriptionData = inscriptionDataResponse.data;

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
}

const openOrdex = new OpenOrdexFactory();

export { openOrdex };
