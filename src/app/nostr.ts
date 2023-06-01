/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { nostrPool as _nostrPool } from '../services/nostr';
import { getEventHash } from 'nostr-tools';

import { OpenOrdex } from './openOrdex';
import { Config } from '../config/config';

const Nostr = function (config: Config) {
    const ordexModule = OpenOrdex(config);
    const nostrPool = _nostrPool(config);
    const nostrModule = {
        getNostrInscription: async (utxo) => {
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

            for (const order of orders) {
                try {
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

            // convert the callback to a promise
            return new Promise((resolve, reject) => {
                nostrPool.publish(signedEvent, resolve, reject);
            });
        },
    };

    return nostrModule;
};

export { Nostr };
