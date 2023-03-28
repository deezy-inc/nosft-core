import ApiService from '../utils/httpService';
import { NOSFT_API_URL } from '../config/constants';
import { AddressInscriptions } from '../types/nosft';

export interface AddressInscriptionsRequest {
    offset: number;
    limit: number;
    address: string;
}

export interface NosftConfig {
    baseUrl?: string;
    network?: 'testnet' | 'mainnet';
}

class Nosft extends ApiService {
    constructor(config?: NosftConfig) {
        const apiUrl = config?.baseUrl || NOSFT_API_URL(config?.network);
        if (!apiUrl) {
            throw new Error('DEEZY_API_URL is not defined');
        }

        super(apiUrl);
    }

    public async getAddressInscriptions({
        offset = 0,
        limit = 5,
        address,
    }: AddressInscriptionsRequest): Promise<AddressInscriptions> {
        return this.query(`/inscriptions/${address}`, {
            offset,
            limit,
        });
    }
}

export function get(config?: NosftConfig): Nosft {
    return new Nosft(config);
}

export default Nosft;
