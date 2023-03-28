/* eslint-env jest */

const { nosft } = require('./lib/nosft.cjs');

describe('inscription', () => {
    it('It should get inscriptions from address', async () => {
        const address = 'bc1p6hsehjafcdzzht5shm4qmm3w2aspwlh843w5r9s33ejhhwesy9qss2hxhp';
        const result = await nosft.getAddressInscriptions({ address, offset: 0, limit: 1 });
        expect(result.data).toHaveProperty('inscriptions');
    });
});
