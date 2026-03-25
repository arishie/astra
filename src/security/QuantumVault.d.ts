/**
 * QuantumVault - Post-Quantum Cryptography Security Module
 *
 * Provides quantum-resistant encryption for storing sensitive data (API keys, secrets).
 * Implements a hybrid approach combining traditional cryptography with post-quantum algorithms
 * for defense in depth.
 *
 * Algorithms:
 * - CRYSTALS-Kyber: Post-quantum key encapsulation mechanism (KEM)
 * - CRYSTALS-Dilithium: Post-quantum digital signatures
 * - AES-256-GCM: Symmetric encryption (fallback and hybrid mode)
 * - HKDF: Secure key derivation
 *
 * @module QuantumVault
 */
/**
 * Supported post-quantum algorithm variants
 */
export type KyberVariant = 'kyber512' | 'kyber768' | 'kyber1024';
export type DilithiumVariant = 'dilithium2' | 'dilithium3' | 'dilithium5';
/**
 * Encryption modes supported by QuantumVault
 */
export type EncryptionMode = 'hybrid' | 'quantum-only' | 'classical-only';
/**
 * Key pair structure for post-quantum algorithms
 */
export interface QuantumKeyPair {
    publicKey: Buffer;
    privateKey: Buffer;
    algorithm: string;
    createdAt: Date;
    expiresAt: Date;
    keyId: string;
}
/**
 * Encapsulated key structure from Kyber KEM
 */
export interface EncapsulatedKey {
    ciphertext: Buffer;
    sharedSecret: Buffer;
}
/**
 * Digital signature structure
 */
export interface QuantumSignature {
    signature: Buffer;
    algorithm: DilithiumVariant;
    keyId: string;
    timestamp: Date;
}
/**
 * Encrypted data envelope structure
 */
export interface EncryptedEnvelope {
    version: number;
    mode: EncryptionMode;
    keyId: string;
    kemCiphertext?: string;
    iv: string;
    ciphertext: string;
    authTag: string;
    signature?: string;
    timestamp: number;
    metadata?: Record<string, string>;
}
/**
 * Vault storage structure
 */
export interface VaultStorage {
    version: number;
    encryptedSecrets: Record<string, EncryptedEnvelope>;
    keyRotationHistory: KeyRotationRecord[];
    lastRotation: number;
    metadata: VaultMetadata;
}
/**
 * Key rotation record for audit trail
 */
export interface KeyRotationRecord {
    keyId: string;
    algorithm: string;
    rotatedAt: Date;
    reason: string;
    previousKeyId?: string;
}
/**
 * Vault metadata
 */
export interface VaultMetadata {
    createdAt: Date;
    lastModified: Date;
    secretCount: number;
    encryptionMode: EncryptionMode;
}
/**
 * Configuration options for QuantumVault
 */
export interface QuantumVaultConfig {
    vaultPath?: string;
    encryptionMode?: EncryptionMode;
    kyberVariant?: KyberVariant;
    dilithiumVariant?: DilithiumVariant;
    keyRotationIntervalDays?: number;
    enableSignatures?: boolean;
    masterKeySource?: 'env' | 'file' | 'derived';
    masterKeyEnvVar?: string;
}
/**
 * Result of cryptographic operations
 */
export interface CryptoResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
/**
 * QuantumVault - Post-Quantum Cryptographic Vault
 *
 * Provides quantum-resistant encryption for sensitive data storage with:
 * - Hybrid encryption (classical + post-quantum)
 * - Key rotation capabilities
 * - Digital signatures for integrity
 * - Secure key derivation
 */
export declare class QuantumVault {
    private static instance;
    private config;
    private kyber;
    private dilithium;
    private encryptionKeyPair;
    private signingKeyPair;
    private masterKey;
    private storage;
    private secrets;
    private isInitialized;
    /**
     * Create a new QuantumVault instance
     */
    constructor(config?: QuantumVaultConfig);
    /**
     * Get singleton instance of QuantumVault
     */
    static getInstance(config?: QuantumVaultConfig): QuantumVault;
    /**
     * Reset singleton instance (useful for testing)
     */
    static resetInstance(): void;
    /**
     * Initialize the vault
     */
    initialize(): Promise<CryptoResult<void>>;
    /**
     * Derive the master key from configured source
     */
    private deriveMasterKey;
    /**
     * Generate a fallback key for development (not recommended for production)
     */
    private generateFallbackKey;
    /**
     * Initialize encryption and signing key pairs
     */
    private initializeKeyPairs;
    /**
     * Encrypt a private key with the master key
     */
    private encryptKeyWithMaster;
    /**
     * Decrypt a private key with the master key
     */
    private decryptKeyWithMaster;
    /**
     * Create empty vault storage structure
     */
    private createEmptyStorage;
    /**
     * Load vault from storage
     */
    private loadVault;
    /**
     * Save vault to storage
     */
    private saveVault;
    /**
     * Encrypt data with master key (AES-256-GCM)
     */
    private encryptWithMasterKey;
    /**
     * Decrypt data with master key (AES-256-GCM)
     */
    private decryptWithMasterKey;
    /**
     * Check if key rotation is needed
     */
    private checkKeyRotation;
    /**
     * Encrypt sensitive data
     *
     * @param plaintext - The data to encrypt
     * @param metadata - Optional metadata to include in the envelope
     * @returns Encrypted envelope or error
     */
    encrypt(plaintext: string, metadata?: Record<string, string>): Promise<CryptoResult<EncryptedEnvelope>>;
    /**
     * Decrypt an encrypted envelope
     *
     * @param envelope - The encrypted envelope to decrypt
     * @returns Decrypted plaintext or error
     */
    decrypt(envelope: EncryptedEnvelope): Promise<CryptoResult<string>>;
    /**
     * Create an encrypted envelope
     */
    private createEncryptedEnvelope;
    /**
     * Decrypt an encrypted envelope
     */
    private decryptEnvelope;
    /**
     * Create signature data from envelope (excluding the signature field)
     */
    private createSignatureData;
    /**
     * Store a secret in the vault
     *
     * @param key - Unique identifier for the secret
     * @param value - The secret value to store
     * @param metadata - Optional metadata
     */
    storeSecret(key: string, value: string, metadata?: Record<string, string>): Promise<CryptoResult<void>>;
    /**
     * Retrieve a secret from the vault
     *
     * @param key - The secret identifier
     * @returns The decrypted secret value or error
     */
    getSecret(key: string): Promise<CryptoResult<string>>;
    /**
     * Check if a secret exists in the vault
     */
    hasSecret(key: string): boolean;
    /**
     * Delete a secret from the vault
     */
    deleteSecret(key: string): Promise<CryptoResult<void>>;
    /**
     * List all secret keys in the vault
     */
    listSecrets(): string[];
    /**
     * Rotate encryption and signing keys
     *
     * @param reason - Reason for key rotation
     */
    rotateKeys(reason?: string): Promise<CryptoResult<void>>;
    /**
     * Get key rotation history
     */
    getRotationHistory(): KeyRotationRecord[];
    /**
     * Get time until next scheduled key rotation
     */
    getTimeUntilRotation(): number;
    /**
     * Encrypt an API key for storage in ModelRegistry
     *
     * @param apiKey - The API key to encrypt
     * @param provider - The provider name (for metadata)
     * @returns Encrypted envelope as JSON string
     */
    encryptApiKey(apiKey: string, provider: string): Promise<CryptoResult<string>>;
    /**
     * Decrypt an API key from ModelRegistry storage
     *
     * @param encryptedData - The encrypted envelope as JSON string
     * @returns Decrypted API key
     */
    decryptApiKey(encryptedData: string): Promise<CryptoResult<string>>;
    /**
     * Create a secure key derivation for a specific purpose
     *
     * @param purpose - The purpose of the derived key
     * @param context - Additional context for key derivation
     * @returns Derived key as Buffer
     */
    deriveKey(purpose: string, context?: string): Buffer;
    /**
     * Get vault metadata
     */
    getMetadata(): VaultMetadata;
    /**
     * Get current encryption mode
     */
    getEncryptionMode(): EncryptionMode;
    /**
     * Export public keys for external use
     */
    exportPublicKeys(): {
        encryption?: string;
        signing?: string;
    };
    /**
     * Verify vault integrity
     */
    verifyIntegrity(): Promise<CryptoResult<{
        valid: boolean;
        issues: string[];
    }>>;
    /**
     * Secure cleanup of sensitive data
     */
    dispose(): void;
}
/**
 * Create a QuantumVault-compatible encryption wrapper for ModelRegistry
 *
 * This provides a drop-in replacement for the existing encryption in ModelRegistry
 * that uses quantum-resistant cryptography.
 */
export declare function createQuantumEncryptionAdapter(vault: QuantumVault): {
    encrypt(plaintext: string): Promise<{
        iv: string;
        data: string;
        authTag: string;
        quantum?: string;
    }>;
    decrypt(encrypted: {
        iv: string;
        data: string;
        authTag: string;
        quantum?: string;
    }): Promise<string>;
};
/**
 * Default export of the QuantumVault class
 */
export default QuantumVault;
//# sourceMappingURL=QuantumVault.d.ts.map