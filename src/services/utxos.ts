import { TESTNET } from '../config/constants';
import axios from 'axios';
import { BaseUtxo } from '../types';

// eslint-disable-next-line no-promise-executor-return
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// We use blockstream.info for mainnet because it has a higher rate limit than mempool.space (same API).
const baseMempoolUrl = TESTNET ? 'https://mempool.space/signet' : 'https://blockstream.info';
export const getUtxos = async (address: string) => {
    // Some addresses have too many utxos and mempool.space throws an erorr. In this case we need to manually
    // search through all transactions, find the outputs, and then remove the outputs that have been spent.
    const outputs: Array<BaseUtxo> = []; // This tracks all outputs that have been seen on the address.
    const spentOutpoints = new Set(); // This tracks all outputs that have been spent from this address.
    let resp;
    try {
        const url = `${baseMempoolUrl}/api/address/${address}/utxo`;
        // eslint-disable-next-line no-await-in-loop
        resp = await axios.get(url);
        const txs = resp.data;
        if (txs.length === 0) return outputs;
        // eslint-disable-next-line no-restricted-syntax
        for (const tx of txs) {
            outputs.push({
                txid: tx.txid,
                vout: tx.vout,
                status: tx.status,
                value: tx.value,
            });
        }
        return outputs;
    } catch (e) {
        let lastSeenTxId = null;
        // We do one pass through to find all outputs and spent outputs.
        while (true) {
            // Short delay to help get around rate limits.
            // eslint-disable-next-line no-await-in-loop
            await delay(100);
            // eslint-disable-next-line no-await-in-loop
            console.log(lastSeenTxId);
            const url: string = `${baseMempoolUrl}/api/address/${address}/txs${
                lastSeenTxId ? `/chain/${lastSeenTxId}` : ''
            }`;
            try {
                // eslint-disable-next-line no-await-in-loop
                resp = await axios.get(url);
            } catch (e2) {
                console.log(`Error`);
                console.error(e2);
                // eslint-disable-next-line no-await-in-loop
                await delay(5000);
                // eslint-disable-next-line no-continue
                continue;
            }
            const txs = resp.data;
            if (txs.length === 0) break;
            // eslint-disable-next-line no-restricted-syntax
            for (const tx of txs) {
                // eslint-disable-next-line no-restricted-syntax
                for (const input of tx.vin) {
                    spentOutpoints.add(`${input.txid}:${input.vout}`);
                }
                for (let n = 0; n < tx.vout.length; n++) {
                    const output = tx.vout[n];
                    if (output.scriptpubkey_address === address) {
                        outputs.push({
                            txid: tx.txid,
                            vout: n,
                            status: tx.status,
                            value: output.value,
                        });
                    }
                }
            }
            lastSeenTxId = txs[txs.length - 1].txid;
        }
        // Now we filter out all outputs that have been spent.
        return outputs.filter((it) => !spentOutpoints.has(`${it.txid}:${it.vout}`));
    }
};
