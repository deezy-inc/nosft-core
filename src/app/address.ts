import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

const Address = function (config) {
    const addressModule = {
        getAddressInfo: (publicKey) => {
            console.log(`Pubkey: ${publicKey.toString()}`);
            const pubkeyBuffer = Buffer.from(publicKey, 'hex');
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
