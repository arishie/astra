import { type Request, type Response, type NextFunction } from 'express';
import { type TokenPayload } from '../../auth/JWTService.js';
export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
    userId?: string;
}
export declare function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
export declare function requireAuthLevel(minLevel: number): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export declare function rateLimit(operation: string, cost?: number): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function validateBody(schema: Record<string, {
    type: string;
    required?: boolean;
}>): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map