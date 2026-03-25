import fs from 'fs';
import path from 'path';
import CryptoJS from 'crypto-js';
export class Vault {
    vaultFile = 'secure_vault.enc';
    masterSecret;
    secrets = new Map();
    constructor() {
        // In a real production env, this secret should come from process.env.ASTRA_MASTER_KEY
        // or retrieved from the OS Keychain using a native module like 'keytar'.
        // For this implementation, we default to a hardcoded placeholder if env is missing,
        // but warn the user.
        this.masterSecret = process.env.ASTRA_MASTER_KEY || 'astra-local-master-secret-2026-CHANGE-ME';
        if (!process.env.ASTRA_MASTER_KEY) {
            console.warn("[Vault] ⚠️ WARNING: Using default master secret. Set ASTRA_MASTER_KEY environment variable for security.");
        }
        this.loadVault();
    }
    loadVault() {
        if (fs.existsSync(this.vaultFile)) {
            try {
                const encrypted = fs.readFileSync(this.vaultFile, 'utf-8');
                const bytes = CryptoJS.AES.decrypt(encrypted, this.masterSecret);
                const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                const rawObj = JSON.parse(decrypted);
                for (const key in rawObj) {
                    this.secrets.set(key, rawObj[key]);
                }
                console.log("[Vault] 🔓 Secure Vault unlocked.");
            }
            catch (e) {
                console.error("[Vault] ❌ Failed to unlock Vault. Master key mismatch or corruption.");
            }
        }
        else {
            console.log("[Vault] No existing vault found. Initializing new one.");
        }
    }
    saveVault() {
        const obj = Object.fromEntries(this.secrets);
        const stringified = JSON.stringify(obj);
        const encrypted = CryptoJS.AES.encrypt(stringified, this.masterSecret).toString();
        fs.writeFileSync(this.vaultFile, encrypted);
    }
    storeSecret(key, value) {
        this.secrets.set(key, value);
        this.saveVault();
        console.log(`[Vault] 🔒 Secret stored: ${key}`);
    }
    getSecret(key) {
        return this.secrets.get(key);
    }
    hasSecret(key) {
        return this.secrets.has(key);
    }
    deleteSecret(key) {
        this.secrets.delete(key);
        this.saveVault();
        console.log(`[Vault] 🗑️ Secret deleted: ${key}`);
    }
}
//# sourceMappingURL=Vault.js.map