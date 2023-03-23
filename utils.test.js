/* eslint-env jest */

const { utils, getAddress, getInscriptions } = require('./lib/nosft.cjs');

describe('dummy test', () => {
    test('try out cjs file', async () => {
        expect(utils.normalizeURL('https://google.com')).toBe('https://google.com/');
    });
});

describe('crypto', () => {
    it('It should get a valid address from nostr Public Key', () => {
        const address = 'bc1p6hsehjafcdzzht5shm4qmm3w2aspwlh843w5r9s33ejhhwesy9qss2hxhp';
        const nostrPublicKey = 'd5e19bcba9c3442bae90beea0dee2e5760177ee7ac5d4196118e657bbb302141';
        const result = getAddress(nostrPublicKey);
        expect(result.address).toBe(address);
    });
});

describe('services', () => {
    it('It should get inscriptions from address', async () => {
        const address = 'bc1p6hsehjafcdzzht5shm4qmm3w2aspwlh843w5r9s33ejhhwesy9qss2hxhp';
        const result = await getInscriptions({ address, offset: 0, limit: 2 });
        expect(result).toHaveProperty('inscriptions');
    });
});
