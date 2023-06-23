export {};

declare global {
    interface Window {
        ethereum: any;
        nostr: any;
        unisat: any;
    }
}
