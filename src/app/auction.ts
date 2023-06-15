/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { Nostr } from './nostr';
import { AuctionInput, auctionService as _auctionService } from '../services/auction';
import { Config } from '../config/config';

const Auction = function (config: Config) {
    const nostrModule = Nostr(config);
    const auctionService = _auctionService(config);
    const auctionModule = {
        subscribeOrders: async ({ callback, limit = 5 }: { callback: (err, data?: any) => void; limit: number }) => {
            const inscriptions = await auctionService.list();
            const cb = async (error, order) => {
                if (error) {
                    callback(error);
                }

                const auction = inscriptions.find((i) => i.inscriptionId === order.inscriptionId);

                callback(undefined, { ...order, auction });
            };

            // Display only running inscriptions
            const metadata = inscriptions
                .filter((i) => i.status === 'RUNNING')
                .reduce((acc: Array<string>, i) => {
                    const events = i.metadata.filter((m) => m.nostrEventId).map((m) => m.nostrEventId || '');
                    return acc.concat(...events);
                }, []);

            // Get specific auction events!
            return nostrModule.subscribeOrders({
                callback: cb,
                limit,
                filter: { ids: metadata },
            });
        },

        subscribeMyAuctions: async ({
            callback,
            address,
            limit = 5,
        }: {
            callback: (err, data?: any) => void;
            address: string;
            limit: number;
        }) => {
            const inscriptions = await auctionService.getByAddress(address);

            const cb = async (error, order) => {
                if (error) {
                    callback(error);
                }

                const auction = inscriptions.find((i) => i.inscriptionId === order.inscriptionId);

                callback(undefined, { ...order, auction });
            };

            // Display only running inscriptions
            const metadata = inscriptions.reduce((acc: Array<string>, i) => {
                const events = i.metadata.filter((m) => m.nostrEventId).map((m) => m.nostrEventId || '');
                return acc.concat(...events);
            }, []);

            // Get specific auction events!
            return nostrModule.subscribeOrders({
                callback: cb,
                limit,
                filter: { ids: metadata },
            });
        },

        getAuctionByInscription: async (inscriptionId) => {
            const auctions = await auctionService.getInscription(inscriptionId);
            return auctions;
        },

        createAuction: async (auction: AuctionInput) => {
            return auctionService.create(auction);
        },

        cancelAuction: async (auctionId: string) => {
            return auctionService.cancelAuction(auctionId);
        },
    };

    return auctionModule;
};

export { Auction };
