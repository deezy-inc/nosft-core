export interface Collection {
    num_available: number;
    max_supply: number;
    price_sats: number;
    base_price_sats: number;
    fee_rate_multiplier: number;
    max_per_mint: number;
    phase: number;
}

export interface MintInscriptionRequest {
    collection_id: string;
    num_to_mint: number;
    receive_address: string;
    fee_rate: number;
    payment_type: string;
    receive_email: string;
}

export interface MintInscriptionResponse {
    bolt11_invoice: string;
    mint_attempt_id: string;
    payment_intent: string;
    payment_address: string;
    amount_sats: number;
}

export interface MintAttempt {
    mint_id: string;
    collection_id: string;

    num_to_mint: number;
    receive_address: string;

    bolt11_invoice: string;
    payment_hash: string;
    payment_address: string;
    amount_sats: number;

    status: string;
    mint_outpoints: string[];
}

export interface MintCustomInscription {
    file_data_base64: string;
    file_extension: string;
    on_chain_fee_rate: number;
    receive_address: string;
}

export interface CollectionAllowListRequest {
    collection_id: string;
    address: string;
}

export type CollectionAllowList = {
    address: string;
    num_allowed: number;
    num_used: number;
};

export interface UpdateCollectionAllowListRequest {
    collection_id: string;
    address: string;
    num_allowed: number;
    secret_key: string;
}
