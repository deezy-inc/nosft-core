import { nosft } from '..';

(async () => {
    const address = 'bc1p6hsehjafcdzzht5shm4qmm3w2aspwlh843w5r9s33ejhhwesy9qss2hxhp';
    const result = await nosft.getAddressInscriptions({ address, offset: 0, limit: 1 });
    console.log('inscriptions', JSON.stringify(result, null, 2));
})();

// Run this file
// npx @digitak/esrun examples/address.example.ts
