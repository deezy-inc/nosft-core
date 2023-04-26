import { Address } from './src/app/address';
import { Wallet } from './src/app/wallet';
import { Crypto } from './src/app/crypto';
import { Inscriptions } from './src/app/inscriptions';
import { Utxo } from './src/app/utxo';
import { Config } from './src/config/config';
import { Psbt } from './src/app/psbt';
import { OpenOrdex } from './src/app/openOrdex';
import { Nostr } from './src/app/nostr';

const Nosft = (configOverrides = {}) => {
    const config = new Config(configOverrides);

    const wallet = Wallet(config);
    const address = Address(config);
    const crypto = Crypto(config);
    const inscriptions = Inscriptions(config);
    const utxo = Utxo(config);
    const psbt = Psbt(config);
    const openOrdex = OpenOrdex(config);
    const nostr = Nostr(config);

    return {
        wallet,
        address,
        crypto,
        inscriptions,
        utxo,
        psbt,
        openOrdex,
        nostr,
        config,
    };
};

export { Nosft };
