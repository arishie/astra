/**
 * Astra AI Agent Framework - OpenAPI 3.0 Specification
 */

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Astra AI Agent API',
        version: '1.0.0',
        description: `
# Astra AI Agent Framework

A privacy-first, multi-tenant AI agent platform that runs on your own hardware.

## Features
- Multi-LLM support (OpenAI, Anthropic, Google)
- Local RAG with vector search
- Multi-platform messaging (WhatsApp, Telegram, Discord, Slack)
- Secure sandboxed execution
- BYOK (Bring Your Own Keys) model

## Authentication
All API endpoints (except health and OAuth) require a Bearer token.
Obtain a token via OAuth login.

## Rate Limits
- Chat: 60 requests/minute
- Memory: 50 ingestions/day
- API Keys: 10 operations/hour
        `,
        license: {
            name: 'CC BY-NC 4.0',
            url: 'https://creativecommons.org/licenses/by-nc/4.0/',
        },
        contact: {
            name: 'Astra Support',
            url: 'https://github.com/astra-ai/astra',
        },
    },
    servers: [
        { url: '/api/v1', description: 'API v1' },
        { url: 'http://localhost:3000/api/v1', description: 'Local Development' },
    ],
    tags: [
        { name: 'Auth', description: 'OAuth authentication' },
        { name: 'User', description: 'User profile and settings' },
        { name: 'API Keys', description: 'Manage LLM provider keys' },
        { name: 'Platforms', description: 'Messaging platform connections' },
        { name: 'Chat', description: 'AI chat interactions' },
        { name: 'Memory', description: 'RAG and knowledge base' },
        { name: 'Admin', description: 'Admin operations' },
        { name: 'Health', description: 'System health' },
    ],
    paths: {
        // Auth
        '/auth/oauth/{provider}': {
            get: {
                tags: ['Auth'],
                summary: 'Get OAuth authorization URL',
                description: 'Returns the OAuth authorization URL for the specified provider',
                parameters: [
                    {
                        name: 'provider',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', enum: ['google', 'github', 'apple'] },
                    },
                ],
                responses: {
                    200: {
                        description: 'Authorization URL',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        url: { type: 'string', format: 'uri' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/auth/oauth/{provider}/callback': {
            get: {
                tags: ['Auth'],
                summary: 'OAuth callback handler',
                parameters: [
                    { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
                    { name: 'state', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Authentication tokens',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AuthTokens' },
                            },
                        },
                    },
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Refresh access token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['refreshToken'],
                                properties: {
                                    refreshToken: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'New tokens',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AuthTokens' },
                            },
                        },
                    },
                    401: { description: 'Invalid refresh token' },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Logout',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Logged out successfully' },
                },
            },
        },
        '/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get current user',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Current user info',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/User' },
                            },
                        },
                    },
                },
            },
        },

        // User
        '/user/profile': {
            get: {
                tags: ['User'],
                summary: 'Get user profile',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/User' },
                            },
                        },
                    },
                },
            },
            put: {
                tags: ['User'],
                summary: 'Update user profile',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    avatar_url: { type: 'string', format: 'uri' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Profile updated' },
                },
            },
        },
        '/user/settings': {
            get: {
                tags: ['User'],
                summary: 'Get user settings',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UserSettings' },
                            },
                        },
                    },
                },
            },
            patch: {
                tags: ['User'],
                summary: 'Update user settings',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UserSettings' },
                        },
                    },
                },
                responses: {
                    200: { description: 'Settings updated' },
                },
            },
        },
        '/user/usage': {
            get: {
                tags: ['User'],
                summary: 'Get usage statistics',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/UsageStats' },
                            },
                        },
                    },
                },
            },
        },

        // API Keys
        '/keys': {
            get: {
                tags: ['API Keys'],
                summary: 'List API keys',
                description: 'Returns all API keys (masked for security)',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/ApiKey' },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['API Keys'],
                summary: 'Add API key',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['provider', 'key', 'name'],
                                properties: {
                                    provider: { type: 'string', enum: ['openai', 'anthropic', 'google'] },
                                    key: { type: 'string' },
                                    name: { type: 'string' },
                                    modelId: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Key added' },
                    400: { description: 'Invalid key' },
                },
            },
        },
        '/keys/{keyId}': {
            delete: {
                tags: ['API Keys'],
                summary: 'Delete API key',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'keyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: { description: 'Key deleted' },
                    404: { description: 'Key not found' },
                },
            },
        },
        '/keys/{keyId}/test': {
            post: {
                tags: ['API Keys'],
                summary: 'Test API key validity',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'keyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: { description: 'Key is valid' },
                    400: { description: 'Key is invalid' },
                },
            },
        },

        // Platforms
        '/platforms': {
            get: {
                tags: ['Platforms'],
                summary: 'List connected platforms',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Platform' },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/platforms/whatsapp/connect': {
            post: {
                tags: ['Platforms'],
                summary: 'Connect WhatsApp',
                description: 'Initiates WhatsApp connection (returns QR code for Baileys mode)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    mode: { type: 'string', enum: ['baileys', 'business'], default: 'baileys' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Connection initiated' },
                },
            },
        },
        '/platforms/whatsapp/qr': {
            get: {
                tags: ['Platforms'],
                summary: 'Get WhatsApp QR code',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'QR code data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        qr: { type: 'string' },
                                        status: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/platforms/{platform}/disconnect': {
            delete: {
                tags: ['Platforms'],
                summary: 'Disconnect platform',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Disconnected' },
                },
            },
        },

        // Chat
        '/chat': {
            post: {
                tags: ['Chat'],
                summary: 'Send chat message',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    message: { type: 'string' },
                                    context: { type: 'object' },
                                    useMemory: { type: 'boolean', default: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ChatResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/chat/stream': {
            post: {
                tags: ['Chat'],
                summary: 'Stream chat response',
                description: 'Server-Sent Events stream',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    message: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'SSE stream',
                        content: { 'text/event-stream': {} },
                    },
                },
            },
        },
        '/chat/hive': {
            post: {
                tags: ['Chat'],
                summary: 'ThinkingHive multi-agent',
                description: 'Uses multiple AI agents for complex reasoning',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['task'],
                                properties: {
                                    task: { type: 'string' },
                                    maxRounds: { type: 'integer', default: 3 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Hive response' },
                },
            },
        },
        '/chat/history': {
            get: {
                tags: ['Chat'],
                summary: 'Get chat history',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                    { name: 'before', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/ChatMessage' },
                                },
                            },
                        },
                    },
                },
            },
        },

        // Memory
        '/memory/ingest': {
            post: {
                tags: ['Memory'],
                summary: 'Ingest document',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary' },
                                    metadata: { type: 'string' },
                                },
                            },
                        },
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['text'],
                                properties: {
                                    text: { type: 'string' },
                                    metadata: { type: 'object' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Document ingested' },
                },
            },
        },
        '/memory/search': {
            get: {
                tags: ['Memory'],
                summary: 'Search memory',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                ],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/MemoryResult' },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/memory/stats': {
            get: {
                tags: ['Memory'],
                summary: 'Get memory statistics',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/MemoryStats' },
                            },
                        },
                    },
                },
            },
        },
        '/memory/{documentId}': {
            delete: {
                tags: ['Memory'],
                summary: 'Delete document',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: { description: 'Document deleted' },
                },
            },
        },

        // Health
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                responses: {
                    200: {
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/HealthStatus' },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT access token obtained via OAuth',
            },
        },
        schemas: {
            AuthTokens: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'integer' },
                    tokenType: { type: 'string', default: 'Bearer' },
                },
            },
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    avatar_url: { type: 'string', format: 'uri' },
                    oauth_provider: { type: 'string' },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            UserSettings: {
                type: 'object',
                properties: {
                    theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
                    language: { type: 'string' },
                    notifications: { type: 'boolean' },
                    defaultModel: { type: 'string' },
                },
            },
            UsageStats: {
                type: 'object',
                properties: {
                    totalMessages: { type: 'integer' },
                    tokensUsed: { type: 'integer' },
                    documentsIngested: { type: 'integer' },
                    period: { type: 'string' },
                },
            },
            ApiKey: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    provider: { type: 'string' },
                    name: { type: 'string' },
                    maskedKey: { type: 'string' },
                    modelId: { type: 'string' },
                    is_active: { type: 'boolean' },
                    is_validated: { type: 'boolean' },
                    last_used_at: { type: 'string', format: 'date-time' },
                },
            },
            Platform: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    platform: { type: 'string' },
                    platform_username: { type: 'string' },
                    mode: { type: 'string' },
                    is_active: { type: 'boolean' },
                    connected_at: { type: 'string', format: 'date-time' },
                },
            },
            ChatResponse: {
                type: 'object',
                properties: {
                    response: { type: 'string' },
                    messageId: { type: 'string' },
                    tokensUsed: { type: 'integer' },
                    model: { type: 'string' },
                },
            },
            ChatMessage: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    role: { type: 'string', enum: ['user', 'assistant'] },
                    content: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                },
            },
            MemoryResult: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    score: { type: 'number' },
                    metadata: { type: 'object' },
                },
            },
            MemoryStats: {
                type: 'object',
                properties: {
                    totalDocuments: { type: 'integer' },
                    totalChunks: { type: 'integer' },
                    storageUsedMB: { type: 'number' },
                },
            },
            HealthStatus: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    version: { type: 'string' },
                    uptime: { type: 'integer' },
                    services: {
                        type: 'object',
                        properties: {
                            database: { type: 'string' },
                            redis: { type: 'string' },
                            memory: { type: 'string' },
                        },
                    },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                },
            },
        },
    },
};
