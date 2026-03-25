import { type Request, type Response, type NextFunction } from 'express';
import { JWTService, type TokenPayload } from '../../auth/JWTService.js';
import { RateLimiter } from '../../middleware/RateLimiter.js';

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
    userId?: string;
}

const jwtService = new JWTService();
const rateLimiter = new RateLimiter();

export async function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid authorization header',
            });
            return;
        }

        const token = authHeader.slice(7);
        const payload = await jwtService.verifyAccessToken(token);

        if (!payload) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token',
            });
            return;
        }

        req.user = payload;
        req.userId = payload.sub;
        next();
    } catch (error) {
        console.error('[AuthMiddleware] Error:', error);
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication failed',
        });
    }
}

export function requireAuthLevel(minLevel: number) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (req.user.authLevel < minLevel) {
            res.status(403).json({
                error: 'Forbidden',
                message: `This action requires auth level ${minLevel}`,
            });
            return;
        }

        next();
    };
}

export function requireAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    if (!req.user?.isAdmin) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required',
        });
        return;
    }
    next();
}

export function rateLimit(operation: string, cost: number = 1) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        try {
            const result = await rateLimiter.checkLimit(req.userId, operation, cost);

            res.setHeader('X-RateLimit-Limit', result.remaining + cost);
            res.setHeader('X-RateLimit-Remaining', result.remaining);
            res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

            if (!result.allowed) {
                res.status(429).json({
                    error: 'Too Many Requests',
                    message: `Rate limit exceeded. Retry after ${result.retryAfter} seconds`,
                    retryAfter: result.retryAfter,
                });
                return;
            }

            next();
        } catch (error) {
            console.error('[RateLimitMiddleware] Error:', error);
            next();
        }
    };
}

export function validateBody(schema: Record<string, { type: string; required?: boolean }>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const errors: string[] = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value !== undefined && value !== null) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== rules.type) {
                    errors.push(`${field} must be of type ${rules.type}`);
                }
            }
        }

        if (errors.length > 0) {
            res.status(400).json({
                error: 'Validation Error',
                message: errors.join(', '),
                details: errors,
            });
            return;
        }

        next();
    };
}
