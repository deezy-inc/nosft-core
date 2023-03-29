export enum FeeLevel {
    FastestFee = 'fastestFee',
    HalfHourFee = 'halfHourFee',
    HourFee = 'hourFee',
    EconomyFee = 'economyFee',
    MinimumFee = 'minimumFee',
}

export interface RawInscriptionData {
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
