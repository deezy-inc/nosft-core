import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { TESTNET } from '../config/constants';

bitcoin.initEccLib(ecc);

export const getAddress = (nostrPublicKey: string) => {
    const pubkeyBuffer = Buffer.from(nostrPublicKey, 'hex');
    const addrInfo = bitcoin.payments.p2tr({
        pubkey: pubkeyBuffer,
        network: TESTNET ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
    });
    return addrInfo;
};

export const toXOnly = (key: Buffer) => (key.length === 33 ? key.slice(1, 33) : key);
