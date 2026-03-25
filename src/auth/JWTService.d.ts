import { type JWTPayload } from 'jose';
export interface TokenPayload extends JWTPayload {
    userId: string;
    email: string;
    authLevel: number;
    sessionId: string;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}
export declare class JWTService {
    private secretKey;
    private refreshSecretKey;
    private accessTokenExpiry;
    private refreshTokenExpiry;
    private issuer;
    constructor();
    generateTokenPair(userId: string, email: string, authLevel?: number): Promise<TokenPair>;
    verifyAccessToken(token: string): Promise<TokenPayload | null>;
    verifyRefreshToken(token: string): Promise<{
        userId: string;
        sessionId: string;
    } | null>;
    elevateToken(currentToken: string, newAuthLevel: number): Promise<string | null>;
    private parseExpiry;
    hashToken(token: string): string;
}
//# sourceMappingURL=JWTService.d.ts.map