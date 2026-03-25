import { Database } from './Database.js';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Database migration runner for Astra.
 * Tracks and applies SQL migrations in order.
 */
export class MigrationRunner {
    db;
    migrationsDir;
    constructor(migrationsDir) {
        this.db = Database.getInstance();
        this.migrationsDir = migrationsDir || path.join(new URL('.', import.meta.url).pathname, 'migrations');
    }
    /**
     * Initialize the migrations table if it doesn't exist.
     */
    async initialize() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
    }
    /**
     * Get list of applied migrations.
     */
    async getAppliedMigrations() {
        const result = await this.db.query(`
            SELECT id, name, applied_at FROM _migrations ORDER BY name ASC
        `);
        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            appliedAt: row.applied_at,
        }));
    }
    /**
     * Get list of pending migrations.
     */
    async getPendingMigrations() {
        const applied = await this.getAppliedMigrations();
        const appliedNames = new Set(applied.map(m => m.name));
        const files = await fs.readdir(this.migrationsDir);
        const sqlFiles = files
            .filter(f => f.endsWith('.sql'))
            .sort();
        return sqlFiles.filter(f => !appliedNames.has(f));
    }
    /**
     * Run all pending migrations.
     */
    async runPending() {
        await this.initialize();
        const pending = await this.getPendingMigrations();
        const applied = [];
        const errors = [];
        for (const migrationFile of pending) {
            try {
                console.log(`[Migration] Applying: ${migrationFile}`);
                await this.runMigration(migrationFile);
                applied.push(migrationFile);
                console.log(`[Migration] Applied: ${migrationFile}`);
            }
            catch (error) {
                const errorMsg = `Failed to apply ${migrationFile}: ${error.message}`;
                console.error(`[Migration] ${errorMsg}`);
                errors.push(errorMsg);
                // Stop on first error
                break;
            }
        }
        return { applied, errors };
    }
    /**
     * Run a specific migration file.
     */
    async runMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = await fs.readFile(filePath, 'utf-8');
        // Run in transaction
        await this.db.query('BEGIN');
        try {
            // Execute migration SQL
            await this.db.query(sql);
            // Record migration as applied
            await this.db.query('INSERT INTO _migrations (name) VALUES ($1)', [filename]);
            await this.db.query('COMMIT');
        }
        catch (error) {
            await this.db.query('ROLLBACK');
            throw error;
        }
    }
    /**
     * Get migration status.
     */
    async getStatus() {
        await this.initialize();
        const applied = await this.getAppliedMigrations();
        const pending = await this.getPendingMigrations();
        return { applied, pending };
    }
    /**
     * Create a new migration file.
     */
    async createMigration(name) {
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const files = await fs.readdir(this.migrationsDir);
        const existingNumbers = files
            .filter(f => f.endsWith('.sql'))
            .map(f => {
            const numPart = f.split('_')[0];
            return numPart ? parseInt(numPart, 10) : NaN;
        })
            .filter(n => !isNaN(n));
        const nextNumber = existingNumbers.length > 0
            ? Math.max(...existingNumbers) + 1
            : 1;
        const filename = `${String(nextNumber).padStart(3, '0')}_${name}.sql`;
        const filePath = path.join(this.migrationsDir, filename);
        const template = `-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString().slice(0, 10)}

-- Write your migration SQL here

`;
        await fs.writeFile(filePath, template, 'utf-8');
        console.log(`[Migration] Created: ${filename}`);
        return filename;
    }
}
// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    const runner = new MigrationRunner();
    const db = Database.getInstance();
    async function main() {
        await db.connect();
        try {
            switch (command) {
                case 'status': {
                    const status = await runner.getStatus();
                    console.log('\n=== Migration Status ===\n');
                    console.log('Applied:');
                    for (const m of status.applied) {
                        console.log(`  [x] ${m.name} (${m.appliedAt.toISOString()})`);
                    }
                    if (status.applied.length === 0) {
                        console.log('  (none)');
                    }
                    console.log('\nPending:');
                    for (const p of status.pending) {
                        console.log(`  [ ] ${p}`);
                    }
                    if (status.pending.length === 0) {
                        console.log('  (none)');
                    }
                    break;
                }
                case 'run': {
                    const result = await runner.runPending();
                    console.log('\n=== Migration Results ===\n');
                    if (result.applied.length > 0) {
                        console.log('Applied:');
                        for (const a of result.applied) {
                            console.log(`  [x] ${a}`);
                        }
                    }
                    else {
                        console.log('No pending migrations.');
                    }
                    if (result.errors.length > 0) {
                        console.log('\nErrors:');
                        for (const e of result.errors) {
                            console.log(`  [!] ${e}`);
                        }
                        process.exit(1);
                    }
                    break;
                }
                case 'create': {
                    const name = process.argv[3];
                    if (!name) {
                        console.error('Usage: migrate create <name>');
                        process.exit(1);
                    }
                    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    await runner.createMigration(sanitizedName);
                    break;
                }
                default:
                    console.log('Astra Database Migration Tool\n');
                    console.log('Usage:');
                    console.log('  npm run migrate status  - Show migration status');
                    console.log('  npm run migrate run     - Run pending migrations');
                    console.log('  npm run migrate create <name> - Create new migration');
            }
        }
        finally {
            await db.disconnect();
        }
    }
    main().catch(err => {
        console.error('Migration error:', err);
        process.exit(1);
    });
}
export default MigrationRunner;
//# sourceMappingURL=MigrationRunner.js.map