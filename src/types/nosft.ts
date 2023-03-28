import { Meta, UtxoStatus } from './index';

export interface AddressInscriptions {
    data: Data;
    total: number;
    size: number;
    page: number;
}

export interface Data {
    inscriptions: Inscription[];
}

export interface Collection {
    creator_address: string | null;
    name: string;
    slug: string;
}

export interface Inscription {
    txid: string;
    version: number;
    locktime: number;
    size: number;
    weight: number;
    fee: number;
    status: UtxoStatus;
    inscriptionId: string;
    collection: Collection;
    content_type: string;
    escrow: number | null;
    id: string;
    meta: Meta;
    num: number;
    value: number;
}
