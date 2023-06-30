import { Config } from '../config/config';
import { Crypto } from './crypto';
import * as bitcoin from 'bitcoinjs-lib';
const signerModule = import('@scure/btc-signer');
import { hex } from '@scure/base';
// @ts-ignore
import * as ecc from 'tiny-secp256k1';
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';
import { TESTNET } from '../config/constants';

bitcoin.initEccLib(ecc);

const Address = function (config: Config) {
    const cryptoModule = Crypto(config);
    const addressModule = {
        getAddressInfo: async (pubkey) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            const pubkeyBuffer = Buffer.from(pubkey, 'hex');

            console.log(`Pubkey: ${pubkey.toString()}`);
            if (provider === 'unisat.io') {
                const addrInfo = bitcoin.payments.p2tr({
                    internalPubkey: cryptoModule.toXOnly(pubkeyBuffer),
                    network: config.NETWORK,
                });

                return addrInfo;
            } else if (provider === 'xverse') {
                const module = await signerModule;
                const network = TESTNET ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
                const p2trAddress = module.p2tr(pubkey, undefined, network);
                const result = {
                    ...p2trAddress,
                    tapInternalKey: Buffer.from(p2trAddress.tapInternalKey),
                    output: hex.encode(p2trAddress.script),
                    pubkey: Buffer.from(pubkey, 'hex'),
                };
                return result;
            }

            const addrInfo = bitcoin.payments.p2tr({
                pubkey: pubkeyBuffer,
                network: config.NETWORK,
            });

            return addrInfo;
        },
    };

    return addressModule;
};

export { Address };
