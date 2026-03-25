import { Router } from 'express';
import { UserService } from '../../services/UserService.js';
import { authenticate, rateLimit, validateBody } from '../middleware/auth.js';
const router = Router();
const userService = new UserService();
router.use(authenticate);
router.get('/', async (req, res) => {
    try {
        const keys = await userService.listApiKeys(req.userId);
        const maskedKeys = keys.map((key) => ({
            id: key.id,
            provider: key.provider,
            name: key.name,
            modelId: key.modelId,
            baseUrl: key.baseUrl,
            tier: key.tier,
            isActive: key.isActive,
            isValidated: key.isValidated,
            lastUsedAt: key.lastUsedAt,
            createdAt: key.createdAt,
        }));
        res.json({ keys: maskedKeys });
    }
    catch (error) {
        console.error('[KeysRoutes] List keys error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to retrieve API keys',
        });
    }
});
router.post('/', rateLimit('api_key', 1), validateBody({
    provider: { type: 'string', required: true },
    name: { type: 'string', required: true },
    apiKey: { type: 'string', required: true },
}), async (req, res) => {
    const { provider, name, apiKey, modelId, baseUrl, tier } = req.body;
    try {
        const existingKeys = await userService.listApiKeys(req.userId);
        const providerKeys = existingKeys.filter((k) => k.provider === provider);
        if (providerKeys.length >= 5) {
            res.status(400).json({
                error: 'Limit Exceeded',
                message: `Maximum 5 keys per provider allowed`,
            });
            return;
        }
        const key = await userService.storeApiKey(req.userId, provider, name, apiKey, {
            modelId,
            baseUrl,
            tier: tier || 1,
        });
        res.status(201).json({
            id: key.id,
            provider: key.provider,
            name: key.name,
            modelId: key.modelId,
            tier: key.tier,
            createdAt: key.createdAt,
        });
    }
    catch (error) {
        console.error('[KeysRoutes] Add key error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to store API key',
        });
    }
});
router.post('/:keyId/test', rateLimit('api_key', 1), async (req, res) => {
    const keyId = req.params.keyId;
    if (!keyId) {
        res.status(400).json({ error: 'Key ID is required' });
        return;
    }
    try {
        const keys = await userService.listApiKeys(req.userId);
        const key = keys.find((k) => k.id === keyId);
        if (!key) {
            res.status(404).json({
                error: 'Not Found',
                message: 'API key not found',
            });
            return;
        }
        const decryptedKey = await userService.getApiKey(req.userId, key.provider, key.name);
        if (!decryptedKey) {
            res.status(500).json({
                error: 'Decryption Error',
                message: 'Failed to decrypt API key',
            });
            return;
        }
        let isValid = false;
        let errorMessage;
        try {
            switch (key.provider.toLowerCase()) {
                case 'openai':
                    isValid = await testOpenAIKey(decryptedKey);
                    break;
                case 'anthropic':
                    isValid = await testAnthropicKey(decryptedKey);
                    break;
                case 'google':
                case 'gemini':
                    isValid = await testGoogleKey(decryptedKey);
                    break;
                default:
                    isValid = true;
            }
        }
        catch (testError) {
            errorMessage = testError instanceof Error ? testError.message : 'Validation failed';
        }
        const updated = await userService.updateApiKeyValidation(keyId, isValid, req.userId);
        if (!updated) {
            res.status(404).json({
                error: 'Not Found',
                message: 'API key not found or access denied',
            });
            return;
        }
        res.json({
            valid: isValid,
            error: errorMessage,
        });
    }
    catch (error) {
        console.error('[KeysRoutes] Test key error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to test API key',
        });
    }
});
router.delete('/:keyId', async (req, res) => {
    const keyId = req.params.keyId;
    if (!keyId) {
        res.status(400).json({ error: 'Key ID is required' });
        return;
    }
    try {
        const deleted = await userService.deleteApiKey(req.userId, keyId);
        if (!deleted) {
            res.status(404).json({
                error: 'Not Found',
                message: 'API key not found or already deleted',
            });
            return;
        }
        res.json({ message: 'API key deleted successfully' });
    }
    catch (error) {
        console.error('[KeysRoutes] Delete key error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to delete API key',
        });
    }
});
async function testOpenAIKey(apiKey) {
    const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok;
}
async function testAnthropicKey(apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
        }),
    });
    return response.ok || response.status === 400;
}
async function testGoogleKey(apiKey) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    return response.ok;
}
export default router;
//# sourceMappingURL=keys.js.map