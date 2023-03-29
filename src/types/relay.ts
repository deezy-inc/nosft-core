import { Event } from 'nostr-tools';

declare global {
    interface Window {
        nostr: {
            getPublicKey(): Promise<string>; // returns a public key as hex
            signEvent(event: Event): Promise<Event>; // takes an event object, adds `id`, `pubkey` and `sig` and returns it
            getRelays(): Promise<{
                [url: string]: { read: boolean; write: boolean };
            }>; // returns a basic map of relay urls to relay policies
            signSchnorr(key: string): Promise<string>;
        };
    }
}

export interface SaleOrder {
    title: string;
    txid: string;
    inscriptionId: string;
    value: number;
    usdPrice: string;
    id: string;
    kind: number;
    pubkey: string;
    created_at: number;
    content: string;
    tags: Array<string[]>;
    sig: string;
    collection: null;
    content_length: number;
    content_type: string;
    created: number;
    escrow: Escrow;
    genesis_fee: number;
    genesis_height: number;
    meta: null;
    num: number;
}

export interface Escrow {
    bought_at: string;
    satoshi_price: number;
    seller_address: string;
}
