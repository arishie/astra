import { Router, type Response } from 'express';
import { UserService } from '../../services/UserService.js';
import { authenticate, type AuthenticatedRequest, validateBody } from '../middleware/auth.js';

const router = Router();
const userService = new UserService();

router.use(authenticate);

router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = await userService.getUserById(req.userId!);

        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            oauthProvider: user.oauthProvider,
            isAdmin: user.isAdmin,
            settings: user.settings,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
        });
    } catch (error) {
        console.error('[UserRoutes] Get profile error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve profile',
        });
    }
});

router.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
    const { name, settings } = req.body;

    try {
        const updates: { name?: string; settings?: Record<string, any> } = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.length > 100) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Name must be a string with max 100 characters',
                });
                return;
            }
            updates.name = name;
        }

        if (settings !== undefined) {
            if (typeof settings !== 'object' || Array.isArray(settings)) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Settings must be an object',
                });
                return;
            }
            updates.settings = settings;
        }

        const user = await userService.updateUser(req.userId!, updates);

        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                name: user.name,
                settings: user.settings,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        console.error('[UserRoutes] Update profile error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to update profile',
        });
    }
});

router.delete('/account', async (req: AuthenticatedRequest, res: Response) => {
    const { confirm } = req.body;

    if (confirm !== 'DELETE_MY_ACCOUNT') {
        res.status(400).json({
            error: 'Confirmation Required',
            message: 'Set confirm to "DELETE_MY_ACCOUNT" to delete your account',
        });
        return;
    }

    try {
        const deleted = await userService.deleteUser(req.userId!);

        if (!deleted) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found or already deleted',
            });
            return;
        }

        res.json({
            message: 'Account deleted successfully',
        });
    } catch (error) {
        console.error('[UserRoutes] Delete account error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to delete account',
        });
    }
});

router.get('/usage', async (req: AuthenticatedRequest, res: Response) => {
    const { period = 'month' } = req.query;

    try {
        res.json({
            period,
            usage: {
                chatMessages: 0,
                hiveOperations: 0,
                documentsIngested: 0,
                tokensUsed: 0,
            },
            limits: {
                chatMessages: { used: 0, limit: 1000, resetAt: null },
                hiveOperations: { used: 0, limit: 100, resetAt: null },
                documentsIngested: { used: 0, limit: 500, resetAt: null },
            },
        });
    } catch (error) {
        console.error('[UserRoutes] Get usage error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve usage data',
        });
    }
});

router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = await userService.getUserById(req.userId!);

        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }

        res.json({
            settings: user.settings || {},
        });
    } catch (error) {
        console.error('[UserRoutes] Get settings error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve settings',
        });
    }
});

router.patch('/settings', async (req: AuthenticatedRequest, res: Response) => {
    const updates = req.body;

    if (typeof updates !== 'object' || Array.isArray(updates)) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'Request body must be an object',
        });
        return;
    }

    try {
        const user = await userService.getUserById(req.userId!);

        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }

        const newSettings = { ...user.settings, ...updates };

        const updatedUser = await userService.updateUser(req.userId!, {
            settings: newSettings,
        });

        res.json({
            message: 'Settings updated successfully',
            settings: updatedUser?.settings || newSettings,
        });
    } catch (error) {
        console.error('[UserRoutes] Update settings error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to update settings',
        });
    }
});

export default router;
