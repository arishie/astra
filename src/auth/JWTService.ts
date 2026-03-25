import * as crypto from 'crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

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

export class JWTService {
    private secretKey: Uint8Array;
    private refreshSecretKey: Uint8Array;
    private accessTokenExpiry: string;
    private refreshTokenExpiry: string;
    private issuer: string = 'astra.ai';

    constructor() {
        const jwtSecret = process.env.JWT_SECRET;
        const refreshSecret = process.env.JWT_REFRESH_SECRET;

        if (!jwtSecret || jwtSecret.length < 32) {
            throw new Error(
                '[JWTService] JWT_SECRET environment variable must be set with at least 32 characters'
            );
        }

        if (!refreshSecret || refreshSecret.length < 32) {
            throw new Error(
                '[JWTService] JWT_REFRESH_SECRET environment variable must be set with at least 32 characters'
            );
        }

        this.secretKey = new TextEncoder().encode(jwtSecret);
        this.refreshSecretKey = new TextEncoder().encode(refreshSecret);
        this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    }

    async generateTokenPair(
        userId: string,
        email: string,
        authLevel: number = 1
    ): Promise<TokenPair> {
        const sessionId = crypto.randomUUID();
        const now = new Date();

        const accessToken = await new SignJWT({
            userId,
            email,
            authLevel,
            sessionId,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setIssuer(this.issuer)
            .setExpirationTime(this.accessTokenExpiry)
            .sign(this.secretKey);

        const refreshToken = await new SignJWT({
            userId,
            sessionId,
            type: 'refresh',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setIssuer(this.issuer)
            .setExpirationTime(this.refreshTokenExpiry)
            .sign(this.refreshSecretKey);

        const expiresAt = new Date(now.getTime() + this.parseExpiry(this.accessTokenExpiry));

        return {
            accessToken,
            refreshToken,
            expiresAt,
        };
    }

    async verifyAccessToken(token: string): Promise<TokenPayload | null> {
        try {
            const { payload } = await jwtVerify(token, this.secretKey, {
                issuer: this.issuer,
            });
            return payload as TokenPayload;
        } catch (error) {
            console.warn('[JWTService] Access token verification failed:', error);
            return null;
        }
    }

    async verifyRefreshToken(token: string): Promise<{ userId: string; sessionId: string } | null> {
        try {
            const { payload } = await jwtVerify(token, this.refreshSecretKey, {
                issuer: this.issuer,
            });
            if (payload.type !== 'refresh') {
                return null;
            }
            return {
                userId: payload.userId as string,
                sessionId: payload.sessionId as string,
            };
        } catch (error) {
            console.warn('[JWTService] Refresh token verification failed:', error);
            return null;
        }
    }

    async elevateToken(
        currentToken: string,
        newAuthLevel: number
    ): Promise<string | null> {
        const payload = await this.verifyAccessToken(currentToken);
        if (!payload) return null;

        const elevatedToken = await new SignJWT({
            userId: payload.userId,
            email: payload.email,
            authLevel: newAuthLevel,
            sessionId: payload.sessionId,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setIssuer(this.issuer)
            .setExpirationTime(this.accessTokenExpiry)
            .sign(this.secretKey);

        return elevatedToken;
    }

    private parseExpiry(expiry: string): number {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match || !match[1] || !match[2]) return 15 * 60 * 1000;

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 15 * 60 * 1000;
        }
    }

    hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}
