import { Config } from '../config/config';
import { Crypto } from './crypto';
import * as bitcoin from 'bitcoinjs-lib';
const signerModule = import('@scure/btc-signer');
import { hex } from '@scure/base';
// @ts-ignore
import * as ecc from 'tiny-secp256k1';
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';
import { NETWORK } from '../config/constants';
import { validate, Network as _ADDRESS_NETWORK } from 'bitcoin-address-validation';
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
                    network: NETWORK,
                });

                return addrInfo;
            } else if (provider === 'xverse') {
                const module = await signerModule;
                const p2trAddress = module.p2tr(pubkey, undefined, NETWORK);
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
                network: NETWORK,
            });

            return addrInfo;
        },
        getPaymentAddressInfo: async (pubkey: string) => {
            const wpkh = bitcoin.payments.p2wpkh({
                pubkey: Buffer.from(pubkey, 'hex'),
                network: NETWORK,
            });
            const redeemScript = bitcoin.payments.p2sh({ redeem: wpkh, network: NETWORK }).redeem?.output;
            return {
                script: wpkh.output,
                redeemScript,
            };
        },
        validateAddress: async (address: string) => {
            return validate(address, config.TESTNET ? _ADDRESS_NETWORK.testnet : _ADDRESS_NETWORK.mainnet);
        },
    };

    return addressModule;
};

export { Address };
