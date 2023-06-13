import * as bitcoin from 'bitcoinjs-lib';
// @ts-ignore
import * as ecc from 'tiny-secp256k1';
import { ethers } from 'ethers';
import { BIP32Factory } from 'bip32';
import { Crypto } from './crypto';
import SessionStorage, { SessionsStorageKeys } from '../services/session-storage';

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
// Used to prove ownership of addpusress and associated ordinals
// https://github.com/LegReq/bip0322-signatures/blob/master/BIP0322_signing.ipynb

const Wallet = function (config) {
    const cryptoModule = Crypto(config);
    const walletModule = {
        getUnisatPubKey: async () => {
            await window.unisat.requestAccounts();
            return window.unisat.getPublicKey();
        },
        getEthPubKey: async () => {
            const { ethereum } = window;
            let ethAddress = ethereum.selectedAddress;
            if (!ethAddress) {
                await ethereum.request({ method: 'eth_requestAccounts' });
                ethAddress = ethereum.selectedAddress;
            }
            // @ts-ignore
            const provider = new ethers.providers.Web3Provider(window.ethereum);

            const toSign = `0x${Buffer.from(config.TAPROOT_MESSAGE(provider)).toString('hex')}`;
            const signature = await provider.send('personal_sign', [toSign, ethAddress]);
            const seed = ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.arrayify(signature)));
            const root = bip32.fromSeed(Buffer.from(seed));
            const taprootChild = root.derivePath(config.DEFAULT_DERIV_PATH);
            const taprootAddress = bitcoin.payments.p2tr({
                internalPubkey: cryptoModule.toXOnly(taprootChild.publicKey),
            });
            return taprootAddress?.pubkey?.toString('hex');
        },
        getNostrPubKey: async () => {
            // @ts-ignore
            if (window.nostr && window.nostr.enable) {
                // @ts-ignore
                await window.nostr.enable();
            } else {
                throw new Error(
                    "Oops, it looks like you haven't set up your Nostr key yet or installed Metamask." +
                        'Go to your Alby Account Settings and create or import a Nostr key.'
                );
            }
            // @ts-ignore
            return window.nostr.getPublicKey();
        },
        connectWallet: async (provider) => {
            const { ethereum } = window;

            if (provider === 'unisat.io' && window.unisat) {
                return walletModule.getUnisatPubKey();
            }

            if (ethereum && provider) {
                return walletModule.getEthPubKey();
            }

            return walletModule.getNostrPubKey();
        },
        onAccountChange: (callback) => {
            const provider = SessionStorage.get(SessionsStorageKeys.DOMAIN);
            if (provider === 'unisat.io') {
                window.unisat.on('accountsChanged', callback);
            }
        },
    };

    return walletModule;
};

// Export the module
export { Wallet };
