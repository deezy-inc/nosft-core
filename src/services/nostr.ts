import { SimplePool, getEventHash, Sub } from 'nostr-tools';

import SessionStorage, { SessionsStorageKeys } from './session-storage';
import { Psbt } from '../app/psbt';
import { Config } from '../config/config';

function cleanEvent(event) {
    return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: event.sig,
    };
}

class NostrRelay {
    config: Config;
    psbt;
    pool = new SimplePool();
    subs: Array<Sub> = [];
    relays: Array<string> = [];
    events = [];

    constructor(config: Config) {
        this.config = config;
        if (!config) {
            throw new Error('Config is required in order to initialize Nostr.');
        }

        this.psbt = Psbt(config);
        this.relays = [...config.RELAYS];
    }

    subscribe(filter, onEvent, onEose) {
        const sub = this.pool.sub([...this.relays], filter);
        sub.on('event', onEvent);
        sub.on('eose', onEose);
        this.subs.push(sub);
        return sub;
    }

    unsubscribeAll() {
        this.subs.forEach((sub) => {
            sub.unsub();
        });
    }

    publish(_event, onSuccess, onError) {
        const event = cleanEvent(_event);

        const pubs = this.pool.publish(this.relays, event);
        const pubList = !Array.isArray(pubs) ? [pubs] : pubs;

        let notified = false;
        let totalPubsFailed = 0;

        // loop over all pubs and wait for all to be done
        pubList.forEach((pub) => {
            pub.on('ok', () => {
                // Callback success only once
                if (onSuccess && !notified) {
                    notified = true;
                    onSuccess();
                }
            });
            pub.on('failed', (reason) => {
                console.error(`failed to publish ${reason}`);
                // Callback error only if all pubs failed
                totalPubsFailed += 1;
                if (totalPubsFailed === pubList.length - 1) {
                    if (onError) onError(reason);
                }
            });
        });
    }

    async list(filter) {
        const events = await this.pool.list([...this.relays], filter);
        return events;
    }

    // eslint-disable-next-line class-methods-use-this
    async sign(event) {
        const metamaskDomain = SessionStorage.get(SessionsStorageKeys.DOMAIN);
        const eventBase = { ...event, created_at: Math.floor(Date.now() / 1000) };
        const newEvent = {
            ...eventBase,
            id: getEventHash(eventBase),
        };
        if (metamaskDomain) {
            const metamaskSigner = await this.psbt.getMetamaskSigner(metamaskDomain);
            const signature = await metamaskSigner.signSchnorr(Buffer.from(newEvent.id, 'hex'));
            return {
                ...newEvent,
                sig: signature.toString('hex'),
            };
        }
        return window.nostr.signEvent(newEvent);
    }
}

const nostrPool = (config: Config) => new NostrRelay(config);

export { nostrPool };
