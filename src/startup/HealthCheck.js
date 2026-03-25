import { Database } from '../database/Database.js';
/**
 * Startup health check to verify all required services are available.
 * Run this before starting the server to catch configuration issues early.
 */
export class StartupHealthCheck {
    results = [];
    /**
     * Run all health checks.
     * Returns true if all required checks pass.
     */
    async runAll() {
        console.log('\n=== Astra Startup Health Check ===\n');
        // Environment checks
        await this.checkEnvironment();
        // Database check
        await this.checkDatabase();
        // Redis check (optional)
        await this.checkRedis();
        // Directory checks
        await this.checkDirectories();
        // Print results
        this.printResults();
        // Return true if all required checks pass
        const requiredFailed = this.results.filter(r => r.required && r.status === 'fail');
        return requiredFailed.length === 0;
    }
    async checkEnvironment() {
        // Required environment variables
        const required = [
            'DATABASE_URL',
            'JWT_SECRET',
        ];
        // Optional but recommended
        const recommended = [
            'SYSTEM_SECRET',
            'ENCRYPTION_KEY',
            'REDIS_URL',
        ];
        for (const envVar of required) {
            if (process.env[envVar]) {
                this.addResult(envVar, 'pass', 'Set', true);
            }
            else {
                this.addResult(envVar, 'fail', 'Missing required environment variable', true);
            }
        }
        for (const envVar of recommended) {
            if (process.env[envVar]) {
                this.addResult(envVar, 'pass', 'Set', false);
            }
            else {
                this.addResult(envVar, 'warn', 'Not set (optional but recommended)', false);
            }
        }
        // Check JWT_SECRET strength
        if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
            this.addResult('JWT_SECRET_STRENGTH', 'warn', 'Should be at least 32 characters', false);
        }
    }
    async checkDatabase() {
        const db = Database.getInstance();
        try {
            await db.connect();
            const start = Date.now();
            await db.query('SELECT 1');
            const latency = Date.now() - start;
            if (latency > 1000) {
                this.addResult('Database', 'warn', `Connected but slow (${latency}ms)`, true);
            }
            else {
                this.addResult('Database', 'pass', `Connected (${latency}ms)`, true);
            }
            // Check if migrations table exists
            const migrationCheck = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = '_migrations'
                ) as exists
            `);
            if (migrationCheck.rows[0]?.exists) {
                this.addResult('Migrations', 'pass', 'Migration table exists', false);
            }
            else {
                this.addResult('Migrations', 'warn', 'No migrations applied yet. Run: npm run migrate:run', false);
            }
            // Check if users table exists (basic schema check)
            const schemaCheck = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'users'
                ) as exists
            `);
            if (schemaCheck.rows[0]?.exists) {
                this.addResult('Schema', 'pass', 'Core tables exist', true);
            }
            else {
                this.addResult('Schema', 'fail', 'Core tables missing. Run migrations.', true);
            }
            await db.disconnect();
        }
        catch (error) {
            this.addResult('Database', 'fail', `Connection failed: ${error.message}`, true);
        }
    }
    async checkRedis() {
        if (!process.env.REDIS_URL) {
            this.addResult('Redis', 'warn', 'Not configured (will use in-memory rate limiting)', false);
            return;
        }
        try {
            const { createClient } = await import('redis');
            const client = createClient({ url: process.env.REDIS_URL });
            const start = Date.now();
            await client.connect();
            await client.ping();
            const latency = Date.now() - start;
            await client.quit();
            this.addResult('Redis', 'pass', `Connected (${latency}ms)`, false);
        }
        catch (error) {
            this.addResult('Redis', 'warn', `Connection failed: ${error.message}`, false);
        }
    }
    async checkDirectories() {
        const fs = await import('fs/promises');
        const path = await import('path');
        const dirs = [
            { path: './astra_memory', name: 'Memory Storage', required: false },
            { path: './sessions', name: 'Session Storage', required: false },
            { path: './logs', name: 'Log Directory', required: false },
        ];
        for (const dir of dirs) {
            try {
                await fs.access(dir.path);
                this.addResult(dir.name, 'pass', `Directory exists: ${dir.path}`, dir.required);
            }
            catch {
                try {
                    await fs.mkdir(dir.path, { recursive: true });
                    this.addResult(dir.name, 'pass', `Created directory: ${dir.path}`, dir.required);
                }
                catch (error) {
                    this.addResult(dir.name, dir.required ? 'fail' : 'warn', `Cannot create: ${error.message}`, dir.required);
                }
            }
        }
    }
    addResult(name, status, message, required) {
        this.results.push({ name, status, message, required });
    }
    printResults() {
        const icons = {
            pass: '\x1b[32m✓\x1b[0m', // Green check
            fail: '\x1b[31m✗\x1b[0m', // Red X
            warn: '\x1b[33m!\x1b[0m', // Yellow warning
        };
        for (const result of this.results) {
            const icon = icons[result.status];
            const required = result.required ? '' : ' (optional)';
            console.log(`${icon} ${result.name}${required}: ${result.message}`);
        }
        const passed = this.results.filter(r => r.status === 'pass').length;
        const failed = this.results.filter(r => r.status === 'fail').length;
        const warned = this.results.filter(r => r.status === 'warn').length;
        console.log(`\n=== Summary: ${passed} passed, ${failed} failed, ${warned} warnings ===\n`);
        if (failed > 0) {
            console.log('\x1b[31mStartup blocked: Fix required issues above.\x1b[0m\n');
        }
        else if (warned > 0) {
            console.log('\x1b[33mStartup OK with warnings. Consider addressing optional issues.\x1b[0m\n');
        }
        else {
            console.log('\x1b[32mAll checks passed! Ready to start.\x1b[0m\n');
        }
    }
    /**
     * Get results as JSON (for API endpoint).
     */
    getResults() {
        return this.results;
    }
}
// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    // Load environment
    const dotenv = await import('dotenv');
    dotenv.config();
    const healthCheck = new StartupHealthCheck();
    const success = await healthCheck.runAll();
    process.exit(success ? 0 : 1);
}
export default StartupHealthCheck;
//# sourceMappingURL=HealthCheck.js.map