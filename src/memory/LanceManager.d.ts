export interface MemoryRecord {
    id: string;
    vector: number[];
    text: string;
    metadata: string;
    userId?: string;
}
/**
 * Multi-tenant LanceDB memory manager.
 * Each user gets their own isolated table for vector storage.
 * This ensures complete data isolation between tenants.
 */
export declare class LanceManager {
    private dbPath;
    private db;
    private userTables;
    private embeddings;
    private readonly SYSTEM_TABLE;
    constructor(dbPath?: string);
    initialize(): Promise<void>;
    /**
     * Sanitize user ID for use as table name.
     * Prevents injection and ensures valid table names.
     */
    private sanitizeUserId;
    /**
     * Get table name for a specific user.
     * Each user gets their own isolated table.
     */
    private getUserTableName;
    /**
     * Get or create a table for a specific user.
     * Ensures complete tenant isolation.
     */
    private getUserTable;
    /**
     * Add memory for a specific user.
     * Data is stored in the user's isolated table.
     */
    addMemory(text: string, metadata?: any, userId?: string): Promise<string | null>;
    /**
     * Search memories for a specific user.
     * Only searches within the user's isolated table.
     */
    search(query: string, limit?: number, userId?: string): Promise<{
        id: string;
        text: string;
        metadata: any;
        score?: number;
    }[]>;
    /**
     * Delete a specific memory record for a user.
     */
    deleteMemory(memoryId: string, userId: string): Promise<boolean>;
    /**
     * Clear all memories for a specific user.
     * WARNING: This is destructive and cannot be undone.
     */
    clearUserMemories(userId: string): Promise<boolean>;
    /**
     * Get memory statistics for a user.
     */
    getUserStats(userId: string): Promise<{
        count: number;
        tableName: string;
    } | null>;
    /**
     * List all user tables (admin function).
     * Should only be called by authenticated admins.
     */
    listUserTables(): Promise<string[]>;
    /**
     * Close the database connection and clear caches.
     */
    close(): Promise<void>;
}
//# sourceMappingURL=LanceManager.d.ts.map