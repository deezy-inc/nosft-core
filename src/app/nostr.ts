/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { nostrPool as _nostrPool } from '../services/nostr';
import { getEventHash, validateEvent, verifySignature } from 'nostr-tools';
import axios from 'axios';
import { OpenOrdex } from './openOrdex';
import { Config } from '../config/config';
import { Utxo } from './utxo';

const Nostr = function (config: Config) {
    const ordexModule = OpenOrdex(config);
    const utxoModule = Utxo(config);
    const nostrPool = _nostrPool(config);
    const nostrModule = {
        filterOrders: async (orders) => {
            for (const order of orders) {
                try {
                    const isUtxoSpent = await utxoModule.isSpent({ output: order.tags.find((x) => x?.[0] === 'u')[1] });
                    if (isUtxoSpent.spent) continue;

                    const orderInformation = await ordexModule.getOrderInformation(order);
                    // @ts-ignore
                    if (Number(orderInformation.value) === Number(order.tags.find((x) => x?.[0] === 's')[1])) {
                        return orderInformation;
                    }
                } catch (e) {
                    return undefined;
                }
            }
        },
        getNostrInscription: async (inscription) => {
            const utxo = `${inscription.txid}:${inscription.vout}`;
            const orders = (
                await nostrPool.list([
                    {
                        kinds: [config.NOSTR_KIND_INSCRIPTION],
                        '#u': [utxo],
                    },
                ])
            )
                .filter((a) => a.tags.find((x) => x?.[0] === 's')?.[1])
                .sort(
                    (a, b) =>
                        // @ts-ignore
                        Number(a.tags.find((x) => x?.[0] === 's')[1]) - Number(b.tags.find((x) => x?.[0] === 's')[1])
                );
            for (const order of orders) {
                try {
                    const isUtxoSpent = await utxoModule.isSpent(inscription);
                    if (isUtxoSpent.spent) continue;

                    const orderInformation = await ordexModule.getOrderInformation(order);
                    // @ts-ignore
                    if (Number(orderInformation.value) === Number(order.tags.find((x) => x?.[0] === 's')[1])) {
                        return orderInformation;
                    }
                } catch (e) {
                    return undefined;
                }
            }
            return undefined;
        },
        getNostrInscriptions: async (inscriptionIds) => {
            const nostrOrders = (
                await nostrPool.list([
                    {
                        kinds: [config.NOSTR_KIND_INSCRIPTION],
                        '#i': inscriptionIds,
                    },
                ])
            )
                .filter((a) => a.tags.find((x) => x?.[0] === 's')?.[1])
                .sort(
                    (a, b) =>
                        // @ts-ignore
                        Number(a.tags.find((x) => x?.[0] === 's')[1]) - Number(b.tags.find((x) => x?.[0] === 's')[1])
                );

            // group orders by id into multiple arrays
            const groupedOrders = nostrOrders.reduce((acc, order) => {
                const inscriptionTag = order.tags.find((x) => x?.[0] === 'i');
                if (inscriptionTag) {
                    const inscriptionId = inscriptionTag[1];
                    if (!acc[inscriptionId]) {
                        acc[inscriptionId] = [];
                    }
                    acc[inscriptionId].push(order);
                }
                return acc;
            }, {});

            const result: Array<any> = [];
            for (const [, orders] of Object.entries(groupedOrders)) {
                const order = await nostrModule.filterOrders(orders);
                if (order) result.push(order);
            }
            return result;
        },
        getLatestNostrInscription: async (inscription) => {
            const orders = (
                await nostrPool.list([
                    {
                        kinds: [config.NOSTR_KIND_INSCRIPTION],
                        '#i': [inscription.inscriptionId],
                    },
                ])
            )
                .filter((a) => a.tags.find((x) => x?.[0] === 's')?.[1])
                .sort(
                    (b, a) =>
                        // @ts-ignore
                        Number(a.created_at) - Number(b.created_at)
                );

            return nostrModule.filterOrders(orders);
        },

        getNostrInscriptionByEventId: async (eventId) => {
            const orders = (
                await nostrPool.list([
                    {
                        kinds: [config.NOSTR_KIND_INSCRIPTION],
                        ids: [eventId],
                    },
                ])
            )
                .filter((a) => a.tags.find((x) => x?.[0] === 's')?.[1])
                .sort(
                    (a, b) =>
                        // @ts-ignore
                        Number(a.tags.find((x) => x?.[0] === 's')[1]) - Number(b.tags.find((x) => x?.[0] === 's')[1])
                );

            return nostrModule.filterOrders(orders);
        },

        getEvent: ({
            inscriptionId,
            inscriptionUtxo,
            networkName = config.TESTNET ? 'testnet' : 'mainnet',
            priceInSats,
            signedPsbt,
            type = 'sell',
            pubkey,
        }) => {
            const event = {
                kind: config.NOSTR_KIND_INSCRIPTION,
                pubkey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['n', networkName], // Network name (e.g. "mainnet", "signet")
                    ['t', type], // Type of order (e.g. "sell", "buy")
                    ['i', inscriptionId], // Inscription ID
                    ['u', inscriptionUtxo], // Inscription UTXO
                    ['s', priceInSats.toString()], // Price in sats
                    ['x', 'deezy'], // Exchange name (e.g. "openordex")
                ],
                content: signedPsbt,
                id: '',
            };

            event.id = getEventHash(event);

            return event;
        },

        subscribeOrders: ({
            callback,
            limit = 5,
            filter = {},
        }: {
            callback: (err, data: any) => void;
            limit: number;
            filter: any;
        }) => {
            const nostrFilter = { kinds: [config.NOSTR_KIND_INSCRIPTION], limit, ...filter };
            return nostrPool.subscribe(
                [nostrFilter],
                async (event) => {
                    console.log('event', event);
                    try {
                        const order = await ordexModule.getOrderInformation(event);

                        callback(undefined, order);
                    } catch (e) {
                        console.error(e);
                    }
                },
                () => {
                    console.log(`eose`);
                }
            );
        },

        listOrders: async ({ limit = 5, filter = {} }: { limit: number; filter: any }) => {
            const nostrFilter = { kinds: [config.NOSTR_KIND_INSCRIPTION], limit, ...filter };
            const orders = await nostrPool.list([nostrFilter]);

            return orders
                .map(async (order) => {
                    try {
                        const orderInfo = await ordexModule.getOrderInformation(order);
                        return orderInfo;
                    } catch (e) {
                        return undefined;
                    }
                })
                .filter((a) => a);
        },

        unsubscribeOrders: () => {
            nostrPool.unsubscribeAll();
        },

        // Dutch auction API abstracts the process of signing it and publishing it to nostr
        publishOrder: async ({ utxo, ordinalValue, signedPsbt }) => {
            const data = await axios.post(`${config.AUCTION_URL}/nostr`, {
                psbt: signedPsbt,
                output: utxo.output,
                inscriptionId: utxo.inscriptionId,
                currentPrice: ordinalValue,
            });

            return data.data;
        },

        signAndBroadcastEvent: async ({ utxo, ordinalValue, signedPsbt, pubkey }) => {
            const { inscriptionId } = utxo;
            const inscriptionUtxo = `${utxo.txid}:${utxo.vout}`;

            const event = nostrModule.getEvent({
                inscriptionId,
                inscriptionUtxo,
                priceInSats: ordinalValue,
                signedPsbt,
                pubkey,
            });
            const signedEvent = await nostrPool.sign(event);
            const ok = validateEvent(signedEvent);
            const veryOk = verifySignature(signedEvent);

            // convert the callback to a promise
            if (!ok) {
                throw new Error('Invalid event');
            }

            if (!veryOk) {
                throw new Error('Invalid signature');
            }

            return new Promise((resolve, reject) => {
                nostrPool.publish(signedEvent, resolve, reject);
            });
        },
    };

    return nostrModule;
};

export { Nostr };
