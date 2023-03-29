import Nosft, { get as nosftGet } from './src/services/nosft';
import { NostrRelay } from './src/services/relay';

export function configure({ network, nosftBaseUrl }: { network: 'testnet' | 'mainnet'; nosftBaseUrl?: string }) {
    const nosftService: Nosft = nosftGet({ baseUrl: nosftBaseUrl, network });
    return {
        nosft: nosftService,
    };
}

const nosft: Nosft = nosftGet();
export { nosft };
export { NostrRelay };
export * from './src/types/relay';
