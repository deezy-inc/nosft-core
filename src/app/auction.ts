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

                const auction = inscriptions.find((i) => i.utxo.inscriptionId === order.inscriptionId);
                if (auction) {
                    auction.endDate = getAuctionEndDate(auction);
                    // If endDate is negative, it means the auction has ended
                    if (auction.endDate < 0) {
                        callback(undefined, order);
                    }
                }

                callback(undefined, { ...order, auction });
            };
            return nostrModule.subscribeOrders({
                callback: cb,
                limit,
                filter: { '#i': inscriptions.map((i) => i.utxo.inscriptionId) },
            });
        },

        getAuctionByInscription: async (inscriptionId) => {
            const auctions: Array<AuctionInscription> = await auctionService.getInscription(inscriptionId);

            return auctions?.map((auction) => {
                auction.endDate = getAuctionEndDate(auction);
                auction.next = getNextMetadata(auction);
                auction.current = auction.metadata.find((meta) => meta.price === auction.currentPrice);
                return auction;
            });
        },
    };

    return auctionModule;
};

export { Auction };
