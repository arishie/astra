export declare class KeyManager {
    private keysFile;
    private encryptionSecret;
    private keys;
    constructor();
    private loadKeys;
    private saveKeys;
    setKey(provider: string, key: string): void;
    getKey(provider: string): string | undefined;
    hasKey(provider: string): boolean;
}
//# sourceMappingURL=KeyManager.d.ts.map