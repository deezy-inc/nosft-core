// import { DEEZY_API_URL, Network } from '../config/constants';

import ApiService from '../utils/httpService';
import { Config } from '../config/config';

export interface AuctionMetadata {
    price: number;
    scheduledTime: number;
}
export interface AuctionInscription {
    utxo: {
        inscriptionId: string;
    };
    endDate?: number;
    metadata: Array<AuctionMetadata>;
    next?: AuctionMetadata;
    current?: AuctionMetadata;
    currentPrice: number;
}

class Auction extends ApiService {
    config: Config;

    constructor(config: Config) {
        if (!config) {
            throw new Error('Config is required in order to initialize Auction.');
        }

        super(config.AUCTION_URL);
        this.config = config;
    }

    public async list(): Promise<Array<AuctionInscription>> {
        return this.get(`/auctions`);
    }

    public async getInscription(inscriptionId): Promise<Array<AuctionInscription>> {
        return this.get(`/inscription/${inscriptionId}`);
    }
}

const auctionService = (config: Config) => new Auction(config);

export { auctionService };
