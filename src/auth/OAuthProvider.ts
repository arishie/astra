import * as crypto from 'crypto';

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

export class OAuthProvider {
    private configs: Map<string, OAuthConfig> = new Map();
    private stateStore: Map<string, { provider: string; expiresAt: number }> = new Map();

    constructor() {
        this.initializeProviders();
        this.startStateCleanup();
    }

    private initializeProviders() {
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            this.configs.set('google', {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/callback',
            });
        }

        if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
            this.configs.set('github', {
                clientId: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/callback',
            });
        }

        if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
            this.configs.set('apple', {
                clientId: process.env.APPLE_CLIENT_ID,
                clientSecret: process.env.APPLE_CLIENT_SECRET,
                redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/callback',
            });
        }

        console.log(`[OAuthProvider] Initialized providers: ${Array.from(this.configs.keys()).join(', ')}`);
    }

    generateAuthUrl(provider: string): { url: string; state: string } | null {
        const config = this.configs.get(provider);
        if (!config) {
            console.warn(`[OAuthProvider] Provider '${provider}' not configured`);
            return null;
        }

        const state = crypto.randomBytes(32).toString('hex');
        this.stateStore.set(state, {
            provider,
            expiresAt: Date.now() + 10 * 60 * 1000,
        });

        let authUrl: string;

        switch (provider) {
            case 'google':
                authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                    `client_id=${encodeURIComponent(config.clientId)}` +
                    `&redirect_uri=${encodeURIComponent(config.redirectUri + '/google')}` +
                    `&response_type=code` +
                    `&scope=${encodeURIComponent('openid email profile')}` +
                    `&state=${state}` +
                    `&access_type=offline` +
                    `&prompt=consent`;
                break;

            case 'github':
                authUrl = `https://github.com/login/oauth/authorize?` +
                    `client_id=${encodeURIComponent(config.clientId)}` +
                    `&redirect_uri=${encodeURIComponent(config.redirectUri + '/github')}` +
                    `&scope=${encodeURIComponent('read:user user:email')}` +
                    `&state=${state}`;
                break;

            case 'apple':
                authUrl = `https://appleid.apple.com/auth/authorize?` +
                    `client_id=${encodeURIComponent(config.clientId)}` +
                    `&redirect_uri=${encodeURIComponent(config.redirectUri + '/apple')}` +
                    `&response_type=code` +
                    `&scope=${encodeURIComponent('name email')}` +
                    `&state=${state}` +
                    `&response_mode=form_post`;
                break;

            default:
                return null;
        }

        return { url: authUrl, state };
    }

    validateState(state: string): string | null {
        const stored = this.stateStore.get(state);
        if (!stored) return null;

        if (Date.now() > stored.expiresAt) {
            this.stateStore.delete(state);
            return null;
        }

        this.stateStore.delete(state);
        return stored.provider;
    }

    async exchangeCode(provider: string, code: string): Promise<OAuthUserData | null> {
        const config = this.configs.get(provider);
        if (!config) return null;

        try {
            switch (provider) {
                case 'google':
                    return await this.handleGoogleCallback(config, code);
                case 'github':
                    return await this.handleGithubCallback(config, code);
                case 'apple':
                    return await this.handleAppleCallback(config, code);
                default:
                    return null;
            }
        } catch (error) {
            console.error(`[OAuthProvider] Error exchanging code for ${provider}:`, error);
            return null;
        }
    }

    private async handleGoogleCallback(config: OAuthConfig, code: string): Promise<OAuthUserData | null> {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri + '/google',
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            console.error('[OAuthProvider] Google token exchange failed');
            return null;
        }

        const tokens = await tokenResponse.json() as OAuthTokenResponse;

        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userResponse.ok) {
            console.error('[OAuthProvider] Google user info fetch failed');
            return null;
        }

        const userData = await userResponse.json() as {
            id: string;
            email: string;
            name?: string;
            picture?: string;
        };

        return {
            provider: 'google',
            providerId: userData.id,
            email: userData.email,
            name: userData.name,
            avatarUrl: userData.picture,
        };
    }

    private async handleGithubCallback(config: OAuthConfig, code: string): Promise<OAuthUserData | null> {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                redirect_uri: config.redirectUri + '/github',
            }),
        });

        if (!tokenResponse.ok) {
            console.error('[OAuthProvider] GitHub token exchange failed');
            return null;
        }

        const tokens = await tokenResponse.json() as OAuthTokenResponse;

        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        if (!userResponse.ok) {
            console.error('[OAuthProvider] GitHub user info fetch failed');
            return null;
        }

        const userData = await userResponse.json() as {
            id: number;
            login: string;
            name?: string;
            avatar_url?: string;
            email?: string;
        };

        let email = userData.email;
        if (!email) {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            if (emailResponse.ok) {
                const emails = await emailResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
                const primary = emails.find(e => e.primary && e.verified);
                email = primary?.email || emails[0]?.email;
            }
        }

        if (!email) {
            console.error('[OAuthProvider] GitHub: No email found');
            return null;
        }

        return {
            provider: 'github',
            providerId: userData.id.toString(),
            email,
            name: userData.name || userData.login,
            avatarUrl: userData.avatar_url,
        };
    }

    private async handleAppleCallback(config: OAuthConfig, code: string): Promise<OAuthUserData | null> {
        const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.redirectUri + '/apple',
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            console.error('[OAuthProvider] Apple token exchange failed');
            return null;
        }

        const tokens = await tokenResponse.json() as OAuthTokenResponse;

        if (!tokens.id_token) {
            console.error('[OAuthProvider] Apple: No ID token');
            return null;
        }

        const idTokenParts = tokens.id_token.split('.');
        if (idTokenParts.length !== 3 || !idTokenParts[1]) {
            console.error('[OAuthProvider] Apple: Invalid ID token format');
            return null;
        }

        const payload = JSON.parse(Buffer.from(idTokenParts[1], 'base64').toString()) as {
            sub: string;
            email?: string;
        };

        if (!payload.email) {
            console.error('[OAuthProvider] Apple: No email in token');
            return null;
        }

        return {
            provider: 'apple',
            providerId: payload.sub,
            email: payload.email,
        };
    }

    getAvailableProviders(): string[] {
        return Array.from(this.configs.keys());
    }

    private startStateCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [state, data] of this.stateStore.entries()) {
                if (now > data.expiresAt) {
                    this.stateStore.delete(state);
                }
            }
        }, 60 * 1000);
    }
}
