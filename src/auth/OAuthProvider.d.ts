export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export interface OAuthUserData {
    provider: 'google' | 'apple' | 'github';
    providerId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
}
export interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    id_token?: string;
}
export declare class OAuthProvider {
    private configs;
    private stateStore;
    constructor();
    private initializeProviders;
    generateAuthUrl(provider: string): {
        url: string;
        state: string;
    } | null;
    validateState(state: string): string | null;
    exchangeCode(provider: string, code: string): Promise<OAuthUserData | null>;
    private handleGoogleCallback;
    private handleGithubCallback;
    private handleAppleCallback;
    getAvailableProviders(): string[];
    private startStateCleanup;
}
//# sourceMappingURL=OAuthProvider.d.ts.map