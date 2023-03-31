/* eslint-env jest */

const { utils } = require('../../lib/nosft.cjs.js');

describe('dummy test', () => {
    test('try out cjs file', async () => {
        expect(utils.normalizeURL('https://google.com')).toBe('https://google.com/');
    });
});
