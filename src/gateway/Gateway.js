import * as crypto from 'crypto';
import { JWTService } from '../auth/JWTService.js';
import { OAuthProvider } from '../auth/OAuthProvider.js';
export var AuthLevel;
(function (AuthLevel) {
    AuthLevel[AuthLevel["NONE"] = 0] = "NONE";
    AuthLevel[AuthLevel["BASIC"] = 1] = "BASIC";
    AuthLevel[AuthLevel["HIGH_SECURITY"] = 2] = "HIGH_SECURITY";
})(AuthLevel || (AuthLevel = {}));
export class Gateway {
    jwtService;
    oauthProvider;
    elevationRequests = new Map();
    elevationCallbacks = new Map();
    userServiceCallback;
    constructor() {
        this.jwtService = new JWTService();
        this.oauthProvider = new OAuthProvider();
        this.startElevationCleanup();
    }
    setUserServiceCallback(callback) {
        this.userServiceCallback = callback;
    }
    getAvailableOAuthProviders() {
        return this.oauthProvider.getAvailableProviders();
    }
    generateOAuthUrl(provider) {
        return this.oauthProvider.generateAuthUrl(provider);
    }
    async handleOAuthCallback(provider, code, state) {
        const validProvider = this.oauthProvider.validateState(state);
        if (!validProvider || validProvider !== provider) {
            console.warn('[Gateway] Invalid OAuth state');
            return null;
        }
        const userData = await this.oauthProvider.exchangeCode(provider, code);
        if (!userData) {
            console.warn('[Gateway] Failed to exchange OAuth code');
            return null;
        }
        if (!this.userServiceCallback) {
            console.error('[Gateway] UserService callback not configured');
            return null;
        }
        const user = await this.userServiceCallback(userData);
        if (!user) {
            console.warn('[Gateway] Failed to create/find user');
            return null;
        }
        const tokens = await this.jwtService.generateTokenPair(user.userId, user.email, AuthLevel.BASIC);
        console.log(`[Gateway] User authenticated via ${provider}: ${user.email}`);
        return tokens;
    }
    async authenticateWithToken(accessToken) {
        const payload = await this.jwtService.verifyAccessToken(accessToken);
        if (!payload) {
            return null;
        }
        return {
            userId: payload.userId,
            email: payload.email,
            authLevel: payload.authLevel,
            sessionId: payload.sessionId,
            createdAt: new Date(payload.iat * 1000),
        };
    }
    async refreshTokens(refreshToken) {
        const payload = await this.jwtService.verifyRefreshToken(refreshToken);
        if (!payload) {
            console.warn('[Gateway] Invalid refresh token');
            return null;
        }
        const tokens = await this.jwtService.generateTokenPair(payload.userId, '', AuthLevel.BASIC);
        console.log(`[Gateway] Tokens refreshed for user: ${payload.userId.substring(0, 8)}...`);
        return tokens;
    }
    async requestElevation(accessToken, reason) {
        const session = await this.authenticateWithToken(accessToken);
        if (!session) {
            return null;
        }
        if (session.authLevel >= AuthLevel.HIGH_SECURITY) {
            return { elevationId: '', requiresApproval: false };
        }
        const elevationId = crypto.randomUUID();
        const elevationRequest = {
            userId: session.userId,
            reason,
            requestedAt: new Date(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        };
        this.elevationRequests.set(elevationId, elevationRequest);
        console.log(`[Gateway] Elevation requested: ${elevationId.substring(0, 8)}... for user ${session.userId.substring(0, 8)}...`);
        console.log(`[Gateway] Reason: ${reason}`);
        return { elevationId, requiresApproval: true };
    }
    async approveElevation(elevationId, approved) {
        const request = this.elevationRequests.get(elevationId);
        if (!request) {
            console.warn('[Gateway] Elevation request not found');
            return false;
        }
        if (Date.now() > request.expiresAt.getTime()) {
            this.elevationRequests.delete(elevationId);
            console.warn('[Gateway] Elevation request expired');
            return false;
        }
        const callback = this.elevationCallbacks.get(elevationId);
        if (callback) {
            callback(approved);
            this.elevationCallbacks.delete(elevationId);
        }
        this.elevationRequests.delete(elevationId);
        if (approved) {
            console.log(`[Gateway] Elevation approved: ${elevationId.substring(0, 8)}...`);
        }
        else {
            console.log(`[Gateway] Elevation denied: ${elevationId.substring(0, 8)}...`);
        }
        return approved;
    }
    async waitForElevation(elevationId, timeoutMs = 60000) {
        const request = this.elevationRequests.get(elevationId);
        if (!request) {
            return false;
        }
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.elevationCallbacks.delete(elevationId);
                this.elevationRequests.delete(elevationId);
                resolve(false);
            }, timeoutMs);
            this.elevationCallbacks.set(elevationId, (approved) => {
                clearTimeout(timeout);
                resolve(approved);
            });
        });
    }
    async elevateToken(accessToken) {
        return this.jwtService.elevateToken(accessToken, AuthLevel.HIGH_SECURITY);
    }
    async checkAccess(accessToken, requiredLevel) {
        const session = await this.authenticateWithToken(accessToken);
        if (!session) {
            return false;
        }
        return session.authLevel >= requiredLevel;
    }
    async getUserIdFromToken(accessToken) {
        const session = await this.authenticateWithToken(accessToken);
        return session?.userId || null;
    }
    getPendingElevations() {
        const pending = [];
        const now = Date.now();
        for (const [id, request] of this.elevationRequests.entries()) {
            if (now <= request.expiresAt.getTime()) {
                pending.push({ id, request });
            }
        }
        return pending;
    }
    startElevationCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [id, request] of this.elevationRequests.entries()) {
                if (now > request.expiresAt.getTime()) {
                    this.elevationRequests.delete(id);
                    const callback = this.elevationCallbacks.get(id);
                    if (callback) {
                        callback(false);
                        this.elevationCallbacks.delete(id);
                    }
                }
            }
        }, 30 * 1000);
    }
    generateSystemToken(systemId) {
        const systemSecret = process.env.SYSTEM_SECRET;
        if (!systemSecret) {
            throw new Error('[Gateway] SYSTEM_SECRET environment variable required for system tokens');
        }
        return this.jwtService.generateTokenPair(`system:${systemId}`, `${systemId}@system.astra.ai`, AuthLevel.HIGH_SECURITY);
    }
    async verifySystemToken(accessToken, expectedSystemId) {
        const session = await this.authenticateWithToken(accessToken);
        if (!session) {
            return false;
        }
        return (session.userId === `system:${expectedSystemId}` &&
            session.authLevel === AuthLevel.HIGH_SECURITY);
    }
}
//# sourceMappingURL=Gateway.js.map