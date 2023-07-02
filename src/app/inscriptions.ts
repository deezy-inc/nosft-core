import axios from 'axios';
import LocalStorage, { LocalStorageKeys } from '../services/local-storage';
import { Crypto } from './crypto';
import { Utxo } from './utxo';

const Inscriptions = function (config) {
    const utxoModule = Utxo(config);
    const cryptoModule = Crypto(config);
    const inscriptionsModule = {
        // TODO: Implement also some type of server side caching.
        // TODO: after buy, sell an inscription we should invalidate the cache.
        getOutpointFromCache: async (inscriptionId) => {
            try {
                const key = `${LocalStorageKeys.INSCRIPTIONS_OUTPOINT}:${inscriptionId}`;
                const cachedOutpoint = await LocalStorage.get(key);
                if (cachedOutpoint) {
                    return cachedOutpoint;
                }

                const result = await axios.get(`${config.TURBO_API}/inscription/${inscriptionId}/outpoint`);

                const [txid, vout] = cryptoModule.parseOutpoint(result.data.inscription.outpoint);
                const utxoKey = `${LocalStorageKeys.INSCRIPTIONS_OUTPOINT}:${txid}:${vout}`;

                await LocalStorage.set(key, result.data);
                await LocalStorage.set(utxoKey, result.data);

                return result.data;
            } catch (error) {
                console.error(error);
            }

            return undefined;
        },

        getOutpoint: async (inscriptionId) => {
            try {
                const result = await axios.get(`${config.TURBO_API}/inscription/${inscriptionId}/outpoint`);
                return result.data;
            } catch (error) {
                console.error(error);
            }
            return undefined;
        },

        getInscriptionsByUtxoKey: async (inscriptions) => {
            const inscriptionsByUtxoKey = {};
            const batchPromises = [];
            const populateInscriptionsMap = async (ins) => {
                const outpointData = await inscriptionsModule.getOutpoint(ins.id);
                if (outpointData) {
                    const {
                        inscription: { outpoint },
                    } = outpointData;
                    const [txid, vout] = cryptoModule.parseOutpoint(outpoint);

                    inscriptionsByUtxoKey[`${txid}:${vout}`] = ins;
                }
                return inscriptionsByUtxoKey;
            };

            for (const ins of inscriptions) {
                // @ts-ignore
                batchPromises.push(populateInscriptionsMap(ins));
                if (batchPromises.length === 15) {
                    await Promise.allSettled(batchPromises);
                    batchPromises.length = 0;
                }
            }

            await Promise.allSettled(batchPromises);
            return inscriptionsByUtxoKey;
        },

        addInscriptionDataToUtxos: (utxos, inscriptionsByUtxoKey) =>
            utxos.map((utxo) => {
                const ins = inscriptionsByUtxoKey[utxo.key];
                return {
                    ...utxo,
                    inscriptionId: ins?.id,
                    ...ins,
                };
            }),

        getInscriptionsForAddress: async (address) => {
            const response = await axios.get(`${config.TURBO_API}/wallet/${address}/inscriptions`);
            return response.data;
        },

        getInscriptions: async (address) => {
            debugger;
            const addressUtxos = await utxoModule.getAddressUtxos(address);
            const utxos = await cryptoModule.sortUtxos(addressUtxos);
            const inscriptions = await inscriptionsModule.getInscriptionsForAddress(address);

            const inscriptionsByUtxoKey = await inscriptionsModule.getInscriptionsByUtxoKey(inscriptions);
            const finalMatch = inscriptionsModule.addInscriptionDataToUtxos(utxos, inscriptionsByUtxoKey);
            debugger;
            return finalMatch;
        },

        getInscription: async (inscriptionId) => {
            const props: any = {};

            const { data: inscriptionData } = await axios.get(`${config.TURBO_API}/inscription/${inscriptionId}`);

            const outpointResult = await inscriptionsModule.getOutpoint(inscriptionId);
            const {
                inscription: { outpoint },
                owner,
            } = outpointResult;

            const [txid, vout] = cryptoModule.parseOutpoint(outpoint);
            // Get related transaction
            const { data: utxo } = await axios.get(`${config.MEMPOOL_API_URL}/api/tx/${txid}`);

            // get value of the utxo
            const { value } = utxo.vout[vout];

            if (inscriptionData?.collection?.name) {
                try {
                    const { data: collection } = await axios.get(
                        `${config.TURBO_API}/collection/${inscriptionData?.collection?.slug}`
                    );
                    props.collection = collection;
                } catch (e) {
                    console.warn('No collection found');
                }
            }

            props.inscription = { ...inscriptionData, inscriptionId, ...utxo, vout, value, owner };

            return props;
        },

        isTextInscription: (utxo) => /(text\/plain|application\/json)/.test(utxo?.content_type),
        isImageInscription: (utxo) => /(^image)(\/)[a-zA-Z0-9_]*/gm.test(utxo?.content_type),
        shouldReplaceInscription: (existingInscription, newInscription) =>
            existingInscription.value > newInscription.value ||
            (existingInscription.value === newInscription.value &&
                existingInscription.created_at < newInscription.created_at),
        takeLatestInscription: (existingInscription, newInscription) =>
            existingInscription.created_at < newInscription.created_at,
    };

    return inscriptionsModule;
};

export { Inscriptions };
