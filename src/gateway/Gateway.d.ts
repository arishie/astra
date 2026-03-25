import { type TokenPair } from '../auth/JWTService.js';
import { type OAuthUserData } from '../auth/OAuthProvider.js';
export declare enum AuthLevel {
    NONE = 0,
    BASIC = 1,
    HIGH_SECURITY = 2
}
export interface UserSession {
    userId: string;
    email: string;
    authLevel: AuthLevel;
    sessionId: string;
    createdAt: Date;
    elevatedAt?: Date;
}
export interface ElevationRequest {
    userId: string;
    reason: string;
    requestedAt: Date;
    expiresAt: Date;
}
export declare class Gateway {
    private jwtService;
    private oauthProvider;
    private elevationRequests;
    private elevationCallbacks;
    private userServiceCallback?;
    constructor();
    setUserServiceCallback(callback: (oauthData: OAuthUserData) => Promise<{
        userId: string;
        email: string;
    } | null>): void;
    getAvailableOAuthProviders(): string[];
    generateOAuthUrl(provider: string): {
        url: string;
        state: string;
    } | null;
    handleOAuthCallback(provider: string, code: string, state: string): Promise<TokenPair | null>;
    authenticateWithToken(accessToken: string): Promise<UserSession | null>;
    refreshTokens(refreshToken: string): Promise<TokenPair | null>;
    requestElevation(accessToken: string, reason: string): Promise<{
        elevationId: string;
        requiresApproval: boolean;
    } | null>;
    approveElevation(elevationId: string, approved: boolean): Promise<boolean>;
    waitForElevation(elevationId: string, timeoutMs?: number): Promise<boolean>;
    elevateToken(accessToken: string): Promise<string | null>;
    checkAccess(accessToken: string, requiredLevel: AuthLevel): Promise<boolean>;
    getUserIdFromToken(accessToken: string): Promise<string | null>;
    getPendingElevations(): Array<{
        id: string;
        request: ElevationRequest;
    }>;
    private startElevationCleanup;
    generateSystemToken(systemId: string): Promise<TokenPair>;
    verifySystemToken(accessToken: string, expectedSystemId: string): Promise<boolean>;
}
//# sourceMappingURL=Gateway.d.ts.map