import { Address } from './src/app/address';
import { Wallet } from './src/app/wallet';
import { Config } from './src/config/config';

const Nosft = (configOverrides = {}) => {
    const config = new Config(configOverrides);

    const wallet = Wallet(config);
    const address = Address(config);

    return {
        wallet,
        address,
        config,
    };
};

export { Nosft };
