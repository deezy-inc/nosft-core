export interface SpentResponse {
    spent: boolean;
    txid?: string;
    vin?: number;
    status?: Status;
    confirmations?: number;
}

export interface Status {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
}
