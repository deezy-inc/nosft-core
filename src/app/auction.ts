/* eslint-disable no-restricted-syntax, no-await-in-loop */
import { Nostr } from './nostr';
import { AuctionInscription, auctionService as _auctionService } from '../services/auction';
import { Config } from '../config/config';

const getAuctionEndDate = (auction) => {
    const currentEvent = auction.metadata.find((meta) => meta.price === auction.currentPrice);
    return currentEvent.scheduledTime * 1000 + auction.timeBetweenEachDecrease * 1000;
};

const getNextMetadata = (auction) => {
    return auction.metadata.find((meta) => meta.price === auction.currentPrice - auction.decreaseAmount);
};

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
                if (auction) {
                    auction.endDate = getAuctionEndDate(auction);
                    // If endDate is negative, it means the auction has ended
                    if (auction.endDate < 0) {
                        callback(undefined, order);
                    }
                }

                callback(undefined, { ...order, auction });
            };

            // Display only running inscriptions
            const metadata = inscriptions
                .filter((i) => i.status === 'RUNNING')
                .reduce((acc: Array<string>, i) => {
                    const events = i.metadata.map((m) => m.nostrEventId);
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
                if (auction) {
                    auction.endDate = getAuctionEndDate(auction);
                    // If endDate is negative, it means the auction has ended
                    if (auction.endDate < 0) {
                        callback(undefined, order);
                    }
                }

                callback(undefined, { ...order, auction });
            };

            // Display only running inscriptions
            const metadata = inscriptions.reduce((acc: Array<string>, i) => {
                const events = i.metadata.map((m) => m.nostrEventId);
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
            const auctions: Array<AuctionInscription> = await auctionService.getInscription(inscriptionId);

            return auctions?.map((auction) => {
                auction.endDate = getAuctionEndDate(auction);
                auction.next = getNextMetadata(auction); // There might not be a next event if is the last
                return auction;
            });
        },

        createAuction: async (auction: AuctionInscription) => {
            return auctionService.create(auction);
        },
    };

    return auctionModule;
};

export { Auction };
