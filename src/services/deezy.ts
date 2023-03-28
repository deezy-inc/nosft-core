import { DEEZY_API_URL } from '../config/constants';
import { Collection } from '../types/nosft';
import {
    MintInscriptionRequest,
    MintInscriptionResponse,
    MintAttempt,
    MintCustomInscription,
    CollectionAllowListRequest,
    CollectionAllowList,
    UpdateCollectionAllowListRequest,
} from '../types/deezy';
import ApiService from '../utils/httpService';

interface MintCustomInscriptionResponse {
    bolt11_invoice: string;
    mint_attempt_id: string;
}

interface BoostResponse {
    bolt11_invoice: string;
}

class Deezy extends ApiService {
    constructor() {
        const apiUrl = DEEZY_API_URL();
        if (!apiUrl) {
            throw new Error('DEEZY_BOOST_URL is not defined');
        }

        super(apiUrl);
    }

    public async getInscriptionsByCollectionId(collectionId: string): Promise<Collection> {
        return this.query(`/v1/inscriptions/collections/info`, { collection_id: collectionId });
    }

    public async mintInscription(mintInscriptionRequest: MintInscriptionRequest): Promise<MintInscriptionResponse> {
        return this.post('/v1/inscriptions/mint', mintInscriptionRequest);
    }

    public async getMintAttempt(mintAttemptId: string): Promise<MintAttempt> {
        return this.get('/v1/inscriptions/mint', mintAttemptId);
    }

    public async mintCustomInscription(mintCustomInscription: MintCustomInscription): Promise<MintAttempt> {
        const { mint_attempt_id } = await this.post<MintCustomInscriptionResponse>(
            '/v1/inscriptions/mint/custom',
            mintCustomInscription
        );

        return this.getMintAttempt(mint_attempt_id);
    }

    public async getCollectionAllowList(params: CollectionAllowListRequest): Promise<CollectionAllowList[]> {
        return this.query('/v1/inscriptions/collections/allowlist', params);
    }

    public async updateCollectionAllowList(params: UpdateCollectionAllowListRequest): Promise<void> {
        return this.put('/v1/inscriptions/collections/allowlist', params);
    }

    public async boost(psbt: string, feeRate: number): Promise<string> {
        const { bolt11_invoice } = await this.post<BoostResponse>(`/v1/inscriptions/collections/info`, {
            psbt,
            fee_rate: feeRate,
        });

        return bolt11_invoice;
    }
}

export default new Deezy();
