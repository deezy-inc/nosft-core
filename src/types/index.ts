export interface Meta {
    name: string;
}

export interface UtxoStatus {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
}

export interface RawInscription {
    collection: unknown;
    content_type: string;
    escrow: number | undefined;
    id: string;
    meta: Meta | undefined;
    num: number;
}

export interface BaseUtxo {
    txid: string;
    vout: number;
    status: UtxoStatus;
    value: number;
}

export interface RawUtxo {
    txid: string;
    version: number;
    locktime: number;
    vin: Vin[];
    vout: Vout[];
    size: number;
    weight: number;
    fee: number;
    status: UtxoStatus;
}

export interface Vin {
    txid: string;
    vout: number;
    prevout: null[];
    scriptsig: string;
    scriptsig_asm: string;
    witness: null[];
    is_coinbase: boolean;
    sequence: number;
}

export interface Vout {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
}
