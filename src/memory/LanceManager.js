import * as lancedb from '@lancedb/lancedb';
import { LocalEmbeddings } from './LocalEmbeddings.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
/**
 * Multi-tenant LanceDB memory manager.
 * Each user gets their own isolated table for vector storage.
 * This ensures complete data isolation between tenants.
 */
export class LanceManager {
    dbPath = './astra_memory';
    db = null;
    userTables = new Map();
    embeddings;
    SYSTEM_TABLE = 'memory_system'; // For system-level data only
    constructor(dbPath) {
        this.embeddings = new LocalEmbeddings();
        if (dbPath) {
            this.dbPath = dbPath;
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }
    }
    async initialize() {
        if (this.db)
            return;
        try {
            this.db = await lancedb.connect(this.dbPath);
            console.log(`[LanceManager] Connected to LanceDB at: ${this.dbPath}`);
        }
        catch (e) {
            console.error(`[LanceManager] Failed to connect to LanceDB: ${e.message}`);
            throw e;
        }
    }
    /**
     * Sanitize user ID for use as table name.
     * Prevents injection and ensures valid table names.
     */
    sanitizeUserId(userId) {
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
    getUserTableName(userId) {
        const sanitizedId = this.sanitizeUserId(userId);
        return `memory_user_${sanitizedId}`;
    }
    /**
     * Get or create a table for a specific user.
     * Ensures complete tenant isolation.
     */
    async getUserTable(userId, sampleVector) {
        if (!this.db) {
            await this.initialize();
        }
        if (!this.db)
            return null;
        const tableName = this.getUserTableName(userId);
        // Check cache first
        if (this.userTables.has(tableName)) {
            return this.userTables.get(tableName);
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
                const dummy = {
                    id: 'init',
                    vector: sampleVector,
                    text: 'Schema Initialization',
                    metadata: JSON.stringify({ type: 'system', createdAt: new Date().toISOString() }),
                };
                const table = await this.db.createTable(tableName, [dummy]);
                // Clean up initialization record
                await table.delete("id = 'init'");
                this.userTables.set(tableName, table);
                console.log(`[LanceManager] Isolated table created for user: ${userId.substring(0, 8)}...`);
                return table;
            }
            return null;
        }
        catch (e) {
            console.error(`[LanceManager] Error getting user table: ${e.message}`);
            return null;
        }
    }
    /**
     * Add memory for a specific user.
     * Data is stored in the user's isolated table.
     */
    async addMemory(text, metadata = {}, userId) {
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
            const record = {
                id,
                vector: embedding,
                text: text,
                metadata: JSON.stringify({
                    ...metadata,
                    userId, // Include for audit purposes
                    createdAt: new Date().toISOString(),
                }),
            };
            await table.add([record]);
            console.log(`[LanceManager] 🧠 Memory stored for user ${userId.substring(0, 8)}...: "${text.substring(0, 30)}..."`);
            return id;
        }
        catch (e) {
            console.error(`[LanceManager] Failed to add memory: ${e.message}`);
            return null;
        }
    }
    /**
     * Search memories for a specific user.
     * Only searches within the user's isolated table.
     */
    async search(query, limit = 5, userId) {
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
            return results.map((r) => ({
                id: r.id,
                text: r.text,
                metadata: JSON.parse(r.metadata),
                score: r._distance ? 1 - r._distance : undefined,
            }));
        }
        catch (e) {
            console.error(`[LanceManager] Search failed: ${e.message}`);
            return [];
        }
    }
    /**
     * Delete a specific memory record for a user.
     */
    async deleteMemory(memoryId, userId) {
        try {
            const table = await this.getUserTable(userId);
            if (!table)
                return false;
            await table.delete(`id = '${memoryId.replace(/'/g, "''")}'`);
            console.log(`[LanceManager] Deleted memory ${memoryId} for user ${userId.substring(0, 8)}...`);
            return true;
        }
        catch (e) {
            console.error(`[LanceManager] Failed to delete memory: ${e.message}`);
            return false;
        }
    }
    /**
     * Clear all memories for a specific user.
     * WARNING: This is destructive and cannot be undone.
     */
    async clearUserMemories(userId) {
        if (!this.db) {
            await this.initialize();
        }
        if (!this.db)
            return false;
        const tableName = this.getUserTableName(userId);
        try {
            const tables = await this.db.tableNames();
            if (tables.includes(tableName)) {
                await this.db.dropTable(tableName);
                this.userTables.delete(tableName);
                console.log(`[LanceManager] Cleared all memories for user: ${userId.substring(0, 8)}...`);
            }
            return true;
        }
        catch (e) {
            console.error(`[LanceManager] Failed to clear user memories: ${e.message}`);
            return false;
        }
    }
    /**
     * Get memory statistics for a user.
     */
    async getUserStats(userId) {
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
        }
        catch (e) {
            console.error(`[LanceManager] Failed to get user stats: ${e.message}`);
            return null;
        }
    }
    /**
     * List all user tables (admin function).
     * Should only be called by authenticated admins.
     */
    async listUserTables() {
        if (!this.db) {
            await this.initialize();
        }
        if (!this.db)
            return [];
        try {
            const allTables = await this.db.tableNames();
            return allTables.filter((name) => name.startsWith('memory_user_'));
        }
        catch (e) {
            console.error(`[LanceManager] Failed to list tables: ${e.message}`);
            return [];
        }
    }
    /**
     * Close the database connection and clear caches.
     */
    async close() {
        this.userTables.clear();
        this.db = null;
        console.log('[LanceManager] Closed connection');
    }
}
//# sourceMappingURL=LanceManager.js.map