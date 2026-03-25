import fs from 'fs';
import path from 'path';
import CryptoJS from 'crypto-js';
export class KeyManager {
    keysFile = 'secure_keys.enc';
    encryptionSecret = 'astra-local-master-secret-2026'; // In prod, use process.env.MASTER_SECRET
    keys = {};
    constructor() {
        this.loadKeys();
    }
    loadKeys() {
        if (fs.existsSync(this.keysFile)) {
            try {
                const encrypted = fs.readFileSync(this.keysFile, 'utf-8');
                const bytes = CryptoJS.AES.decrypt(encrypted, this.encryptionSecret);
                const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                this.keys = JSON.parse(decrypted);
            }
            catch (e) {
                console.error("[KeyManager] Failed to load/decrypt keys. Starting fresh.");
                this.keys = {};
            }
        }
    }
    saveKeys() {
        const stringified = JSON.stringify(this.keys);
        const encrypted = CryptoJS.AES.encrypt(stringified, this.encryptionSecret).toString();
        fs.writeFileSync(this.keysFile, encrypted);
    }
    setKey(provider, key) {
        this.keys[provider.toLowerCase()] = key;
        this.saveKeys();
        console.log(`[KeyManager] Key saved for provider: ${provider}`);
    }
    getKey(provider) {
        return this.keys[provider.toLowerCase()];
    }
    hasKey(provider) {
        return !!this.keys[provider.toLowerCase()];
    }
}
//# sourceMappingURL=KeyManager.js.map