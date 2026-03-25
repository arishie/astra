interface Migration {
    id: number;
    name: string;
    appliedAt: Date;
}
/**
 * Database migration runner for Astra.
 * Tracks and applies SQL migrations in order.
 */
export declare class MigrationRunner {
    private db;
    private migrationsDir;
    constructor(migrationsDir?: string);
    /**
     * Initialize the migrations table if it doesn't exist.
     */
    initialize(): Promise<void>;
    /**
     * Get list of applied migrations.
     */
    getAppliedMigrations(): Promise<Migration[]>;
    /**
     * Get list of pending migrations.
     */
    getPendingMigrations(): Promise<string[]>;
    /**
     * Run all pending migrations.
     */
    runPending(): Promise<{
        applied: string[];
        errors: string[];
    }>;
    /**
     * Run a specific migration file.
     */
    runMigration(filename: string): Promise<void>;
    /**
     * Get migration status.
     */
    getStatus(): Promise<{
        applied: Migration[];
        pending: string[];
    }>;
    /**
     * Create a new migration file.
     */
    createMigration(name: string): Promise<string>;
}
export default MigrationRunner;
//# sourceMappingURL=MigrationRunner.d.ts.map