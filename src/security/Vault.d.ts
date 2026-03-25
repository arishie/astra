export declare class Vault {
    private vaultFile;
    private masterSecret;
    private secrets;
    constructor();
    private loadVault;
    private saveVault;
    storeSecret(key: string, value: string): void;
    getSecret(key: string): string | undefined;
    hasSecret(key: string): boolean;
    deleteSecret(key: string): void;
}
//# sourceMappingURL=Vault.d.ts.map