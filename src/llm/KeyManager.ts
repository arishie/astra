import fs from 'fs';
import path from 'path';
import CryptoJS from 'crypto-js';

export class KeyManager {
    private keysFile: string = 'secure_keys.enc';
    private encryptionSecret: string = 'astra-local-master-secret-2026'; // In prod, use process.env.MASTER_SECRET
    private keys: Record<string, string> = {};

    constructor() {
        this.loadKeys();
    }

    private loadKeys() {
        if (fs.existsSync(this.keysFile)) {
            try {
                const encrypted = fs.readFileSync(this.keysFile, 'utf-8');
                const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionSecret);
                const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                this.keys = JSON.parse(decrypted);
            } catch (e) {
                console.error("[KeyManager] Failed to load/decrypt keys. Starting fresh.");
                this.keys = {};
            }
        }
    }

    private saveKeys() {
        const stringified = JSON.stringify(this.keys);
        const encrypted = CryptoJS.AES.encrypt(stringified, this.encryptionSecret).toString();
        fs.writeFileSync(this.keysFile, encrypted);
    }

    public setKey(provider: string, key: string) {
        this.keys[provider.toLowerCase()] = key;
        this.saveKeys();
        console.log(`[KeyManager] Key saved for provider: ${provider}`);
    }

    public getKey(provider: string): string | undefined {
        return this.keys[provider.toLowerCase()];
    }

    public hasKey(provider: string): boolean {
        return !!this.keys[provider.toLowerCase()];
    }
}
