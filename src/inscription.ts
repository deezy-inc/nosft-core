import { Inscription, RawInscription, RawUtxo } from './types';
import { BLOCKSTREAM_API, TURBO_API } from './constants';
import axios from 'axios';

const getInscriptionsData = async (address: string): Promise<Array<RawInscription>> =>
    (await axios.get(`${TURBO_API}/wallet/${address}/inscriptions`)).data;

const getUtxoForInscription = async (inscription: RawInscription, address: string) => {
    const {
        data: {
            inscription: { outpoint },
        },
    } = await axios.get(`${TURBO_API}/inscription/${inscription.id}/outpoint`);

    const txid = outpoint
        .substring(0, outpoint.length - 8)
        .match(/[a-fA-F0-9]{2}/g)
        .reverse()
        .join('');

    const utxo: RawUtxo = (await axios.get(`${BLOCKSTREAM_API}/tx/${txid}`)).data;
    const { value } = utxo.vout.find((v) => v.scriptpubkey_address === address) || {};
    const { version, locktime, size, weight, fee, status } = utxo;
    return {
        version,
        locktime,
        size,
        weight,
        fee,
        status,
        inscriptionId: inscription?.id,
        ...inscription,
        value,
    };
};

interface GetInscriptionsProps {
    address: string;
    offset: number;
    limit: number;
}

export const getInscriptions = async ({ address, offset = 0, limit }: GetInscriptionsProps) => {
    const from = offset;
    const to = from + limit;
    const inscriptionsData = await getInscriptionsData(address);
    const inscriptionsSlice = inscriptionsData?.slice(from, to);
    const inscriptionsWithUtxo = (
        await Promise.allSettled(inscriptionsSlice.map((inscription) => getUtxoForInscription(inscription, address)))
    )
        .filter((i) => i.status === 'fulfilled')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        .map((i) => i.value as Inscription);
    const result = {
        inscriptions: inscriptionsWithUtxo,
        count: inscriptionsData.length,
        size: inscriptionsWithUtxo.length,
    };
    return result;
};
