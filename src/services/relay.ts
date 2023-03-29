import { SimplePool, Filter, Event, Sub } from 'nostr-tools';
import { NOSTR_KIND_INSCRIPTION, NOSTR_RELAY_URL } from '../config/constants';
import { SaleOrder } from '../types/relay';
import { openOrdex } from './open-ordex';

export type SubscribeOrdersProps = {
    limit: number;
    relays?: string[];
    onOrder: (order: SaleOrder) => void;
    onEose: () => void;
};

export class NostrRelay {
    private pool: SimplePool;
    private subs: Sub[];
    private relays: string[];
    private subscriptionOrders: Sub | null;

    constructor() {
        this.pool = new SimplePool();
        this.subs = [];
        this.relays = [];
        this.subscriptionOrders = null;
    }

    getSubscriptionOrders(): Sub | null {
        return this.subscriptionOrders;
    }

    setRelays(relays: string[]): void {
        this.relays = [...relays];
    }

    unsubscribeOrders(): void {
        if (this.subscriptionOrders) {
            this.subs = this.subs.filter((sub) => sub !== this.subscriptionOrders);
            this.subscriptionOrders.unsub();
            this.subscriptionOrders = null;
        }
    }

    subscribeOrders({ limit = 10, onOrder, onEose, relays = [NOSTR_RELAY_URL] }: SubscribeOrdersProps) {
        try {
            this.unsubscribeOrders();
            this.setRelays(relays);
            this.subscriptionOrders = this.subscribe(
                [{ kinds: [NOSTR_KIND_INSCRIPTION], limit }],
                async (event) => {
                    const order = await openOrdex.parseOrderEvent(event);
                    if (order) {
                        onOrder(order);
                    }
                },
                onEose
            );
            return this.subscriptionOrders;
        } catch (error) {
            throw error;
        }
    }

    private subscribe(filter: Filter[], onEvent: (event: Event) => void, onEose: () => void): Sub {
        if (!this.relays.length)
            throw new Error('No relays configured, please call setRelays([<url>,...[<url>]]) first');
        const sub = this.pool.sub([...this.relays], filter);
        sub.on('event', onEvent);
        sub.on('eose', onEose);
        this.subs.push(sub);
        return sub;
    }
}
