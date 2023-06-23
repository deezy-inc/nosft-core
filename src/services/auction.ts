import ApiService from '../utils/httpService';
import { Config } from '../config/config';

export type AuctionId = string;
export type AuctionStatus = 'SPENT' | 'RUNNING' | 'PENDING' | 'FINISHED' | 'CLOSED' | 'STOPPED';

export interface AuctionMetadata {
    scheduledTime: number;
    endTime: number;
    id: string;
    nostrEventId?: string;
    price: number;
    signedPsbt: string;
    index: number;
    isLastEvent: boolean;
}

export interface AuctionInscription {
    startTime: number;
    scheduledISODate: string;
    metadata: AuctionMetadata[];
    inscriptionId: string;
    btcAddress: string;
    output: string;
    status: AuctionStatus;
    decreaseAmount: number;
    id: AuctionId;
    reservePrice: number;
    currentPrice: number;
    secondsBetweenEachDecrease: number;
    initialPrice: number;
}

export type AuctionInput = {
    startTime: number;
    decreaseAmount: number;
    secondsBetweenEachDecrease: number;
    initialPrice: number;
    reservePrice: number;
    metadata: {
        price: number;
        signedPsbt: string;
    }[];
    btcAddress: string;
    output: string;
    inscriptionId: string;
};

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

    public async getInscription(inscriptionId: string): Promise<Array<AuctionInscription>> {
        return this.get(`/auctions/inscription/${inscriptionId}`);
    }

    public async cancelAuction(auctionId): Promise<void> {
        return this.delete(`/auction/${auctionId}`);
    }

    public async create(auction: AuctionInput): Promise<AuctionInscription> {
        return this.post(`/auction`, auction);
    }

    public async getByAddress(address: string): Promise<Array<AuctionInscription>> {
        return this.get(`/auctions/address/${address}`);
    }
}

const auctionService = (config: Config) => new Auction(config);

export { auctionService };
