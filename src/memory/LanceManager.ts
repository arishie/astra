import * as lancedb from '@lancedb/lancedb';
import { LocalEmbeddings } from './LocalEmbeddings.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface MemoryRecord {
    id: string;
    vector: number[];
    text: string;
    metadata: string; // JSON string of metadata
    userId?: string; // For backward compatibility in shared tables
}

/**
 * Multi-tenant LanceDB memory manager.
 * Each user gets their own isolated table for vector storage.
 * This ensures complete data isolation between tenants.
 */
export class LanceManager {
    private dbPath: string = './astra_memory';
    private db: lancedb.Connection | null = null;
    private userTables: Map<string, lancedb.Table> = new Map();
    private embeddings: LocalEmbeddings;
    private readonly SYSTEM_TABLE = 'memory_system'; // For system-level data only

    constructor(dbPath?: string) {
        this.embeddings = new LocalEmbeddings();
        if (dbPath) {
            this.dbPath = dbPath;
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
    }

    public async initialize(): Promise<void> {
        if (this.db) return;

        try {
            this.db = await lancedb.connect(this.dbPath);
            console.log(`[LanceManager] Connected to LanceDB at: ${this.dbPath}`);
        } catch (e: any) {
            console.error(`[LanceManager] Failed to connect to LanceDB: ${e.message}`);
            throw e;
        }
    }

    /**
     * Sanitize user ID for use as table name.
     * Prevents injection and ensures valid table names.
     */
    private sanitizeUserId(userId: string): string {
        // Only allow alphanumeric, hyphens, and underscores
        // Replace invalid characters and limit length
        const sanitized = userId
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 64);

        if (!sanitized || sanitized.length < 1) {
            throw new Error('Invalid user ID for memory table');
        }

        return sanitized;
    }

    /**
     * Get table name for a specific user.
     * Each user gets their own isolated table.
     */
    private getUserTableName(userId: string): string {
        const sanitizedId = this.sanitizeUserId(userId);
        return `memory_user_${sanitizedId}`;
    }

    /**
     * Get or create a table for a specific user.
     * Ensures complete tenant isolation.
     */
    private async getUserTable(userId: string, sampleVector?: number[]): Promise<lancedb.Table | null> {
        if (!this.db) {
            await this.initialize();
        }
        if (!this.db) return null;

        const tableName = this.getUserTableName(userId);

        // Check cache first
        if (this.userTables.has(tableName)) {
            return this.userTables.get(tableName)!;
        }

        try {
            const tables = await this.db.tableNames();

            if (tables.includes(tableName)) {
                const table = await this.db.openTable(tableName);
                this.userTables.set(tableName, table);
                return table;
            }

            // Table doesn't exist - create if we have a sample vector
            if (sampleVector) {
                console.log(`[LanceManager] Creating isolated table for user: ${userId.substring(0, 8)}...`);

                // Create table with schema initialization record
                const dummy: MemoryRecord = {
                    id: 'init',
                    vector: sampleVector,
                    text: 'Schema Initialization',
                    metadata: JSON.stringify({ type: 'system', createdAt: new Date().toISOString() }),
                };

                const table = await this.db.createTable(tableName, [dummy] as any);

                // Clean up initialization record
                await table.delete("id = 'init'");

                this.userTables.set(tableName, table);
                console.log(`[LanceManager] Isolated table created for user: ${userId.substring(0, 8)}...`);
                return table;
            }

            return null;
        } catch (e: any) {
            console.error(`[LanceManager] Error getting user table: ${e.message}`);
            return null;
        }
    }

    /**
     * Add memory for a specific user.
     * Data is stored in the user's isolated table.
     */
    public async addMemory(text: string, metadata: any = {}, userId?: string): Promise<string | null> {
        if (!userId) {
            console.error('[LanceManager] userId required for addMemory in multi-tenant mode');
            return null;
        }

        try {
            const embedding = await this.embeddings.embedQuery(text);
            const table = await this.getUserTable(userId, embedding);

            if (!table) {
                console.error(`[LanceManager] Failed to get table for user: ${userId.substring(0, 8)}...`);
                return null;
            }

            const id = uuidv4();
            const record: MemoryRecord = {
                id,
                vector: embedding,
                text: text,
                metadata: JSON.stringify({
                    ...metadata,
                    userId, // Include for audit purposes
                    createdAt: new Date().toISOString(),
                }),
            };

            await table.add([record] as any);
            console.log(`[LanceManager] 🧠 Memory stored for user ${userId.substring(0, 8)}...: "${text.substring(0, 30)}..."`);
            return id;
        } catch (e: any) {
            console.error(`[LanceManager] Failed to add memory: ${e.message}`);
            return null;
        }
    }

    /**
     * Search memories for a specific user.
     * Only searches within the user's isolated table.
     */
    public async search(
        query: string,
        limit: number = 5,
        userId?: string
    ): Promise<{ id: string; text: string; metadata: any; score?: number }[]> {
        if (!userId) {
            console.error('[LanceManager] userId required for search in multi-tenant mode');
            return [];
        }

        try {
            const queryVector = await this.embeddings.embedQuery(query);
            const table = await this.getUserTable(userId, queryVector);

            if (!table) {
                // No table means no memories yet for this user
                return [];
            }

            const results = await table.vectorSearch(queryVector).limit(limit).toArray();

            return results.map((r: any) => ({
                id: r.id,
                text: r.text,
                metadata: JSON.parse(r.metadata),
                score: r._distance ? 1 - r._distance : undefined,
            }));
        } catch (e: any) {
            console.error(`[LanceManager] Search failed: ${e.message}`);
            return [];
        }
    }

    /**
     * Delete a specific memory record for a user.
     */
    public async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
        try {
            const table = await this.getUserTable(userId);
            if (!table) return false;

            await table.delete(`id = '${memoryId.replace(/'/g, "''")}'`);
            console.log(`[LanceManager] Deleted memory ${memoryId} for user ${userId.substring(0, 8)}...`);
            return true;
        } catch (e: any) {
            console.error(`[LanceManager] Failed to delete memory: ${e.message}`);
            return false;
        }
    }

    /**
     * Clear all memories for a specific user.
     * WARNING: This is destructive and cannot be undone.
     */
    public async clearUserMemories(userId: string): Promise<boolean> {
        if (!this.db) {
            await this.initialize();
        }
        if (!this.db) return false;

        const tableName = this.getUserTableName(userId);

        try {
            const tables = await this.db.tableNames();
            if (tables.includes(tableName)) {
                await this.db.dropTable(tableName);
                this.userTables.delete(tableName);
                console.log(`[LanceManager] Cleared all memories for user: ${userId.substring(0, 8)}...`);
            }
            return true;
        } catch (e: any) {
            console.error(`[LanceManager] Failed to clear user memories: ${e.message}`);
            return false;
        }
    }

    /**
     * Get memory statistics for a user.
     */
    public async getUserStats(userId: string): Promise<{ count: number; tableName: string } | null> {
        try {
            const table = await this.getUserTable(userId);
            if (!table) {
                return { count: 0, tableName: this.getUserTableName(userId) };
            }

            const count = await table.countRows();
            return {
                count,
                tableName: this.getUserTableName(userId),
            };
        } catch (e: any) {
            console.error(`[LanceManager] Failed to get user stats: ${e.message}`);
            return null;
        }
    }

    /**
     * List all user tables (admin function).
     * Should only be called by authenticated admins.
     */
    public async listUserTables(): Promise<string[]> {
        if (!this.db) {
            await this.initialize();
        }
        if (!this.db) return [];

        try {
            const allTables = await this.db.tableNames();
            return allTables.filter((name) => name.startsWith('memory_user_'));
        } catch (e: any) {
            console.error(`[LanceManager] Failed to list tables: ${e.message}`);
            return [];
        }
    }

    /**
     * Close the database connection and clear caches.
     */
    public async close(): Promise<void> {
        this.userTables.clear();
        this.db = null;
        console.log('[LanceManager] Closed connection');
    }
}
