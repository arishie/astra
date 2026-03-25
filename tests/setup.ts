import { beforeAll, afterAll, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.MASTER_ENCRYPTION_KEY = 'test-master-key-for-testing-only-32chars';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-testing-32chars';
process.env.SYSTEM_SECRET = 'test-system-secret-for-testing-32chars';

vi.mock('redis', () => ({
    createClient: vi.fn(() => ({
        connect: vi.fn(),
        quit: vi.fn(),
        on: vi.fn(),
        multi: vi.fn(() => ({
            zRemRangeByScore: vi.fn().mockReturnThis(),
            zCard: vi.fn().mockReturnThis(),
            zAdd: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([null, 0, null, null]),
        })),
        zPopMax: vi.fn(),
        zRange: vi.fn().mockResolvedValue([]),
        set: vi.fn(),
        get: vi.fn(),
        del: vi.fn(),
    })),
}));

vi.mock('pg', () => ({
    Pool: vi.fn(() => ({
        connect: vi.fn(),
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        end: vi.fn(),
        on: vi.fn(),
    })),
}));

beforeAll(() => {
    console.log('[Test Setup] Starting test suite');
});

afterAll(() => {
    console.log('[Test Setup] Test suite completed');
});
