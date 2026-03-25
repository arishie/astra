import { Pool } from 'pg';
export class Database {
    static instance;
    pool = null;
    isConnected = false;
    constructor() { }
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
    async connect(config) {
        if (this.isConnected && this.pool) {
            return;
        }
        const dbConfig = config || this.getConfigFromEnv();
        try {
            this.pool = new Pool({
                connectionString: dbConfig.connectionString,
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user,
                password: dbConfig.password,
                ssl: dbConfig.ssl,
                max: dbConfig.max || 20,
                idleTimeoutMillis: dbConfig.idleTimeoutMillis || 30000,
                connectionTimeoutMillis: dbConfig.connectionTimeoutMillis || 5000,
            });
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            this.isConnected = true;
            console.log('[Database] Connected to PostgreSQL');
        }
        catch (error) {
            console.error('[Database] Connection failed:', error);
            throw error;
        }
    }
    getConfigFromEnv() {
        const connectionString = process.env.DATABASE_URL;
        if (connectionString) {
            return {
                connectionString,
                ssl: process.env.NODE_ENV === 'production'
                    ? { rejectUnauthorized: false }
                    : false,
            };
        }
        return {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'astra',
            user: process.env.DB_USER || 'astra',
            password: process.env.DB_PASSWORD || 'astra',
            ssl: process.env.DB_SSL === 'true',
        };
    }
    async query(text, params) {
        if (!this.pool) {
            throw new Error('[Database] Not connected');
        }
        return this.pool.query(text, params);
    }
    async getClient() {
        if (!this.pool) {
            throw new Error('[Database] Not connected');
        }
        return this.pool.connect();
    }
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.isConnected = false;
            console.log('[Database] Disconnected from PostgreSQL');
        }
    }
    isReady() {
        return this.isConnected && this.pool !== null;
    }
    async healthCheck() {
        if (!this.pool)
            return false;
        try {
            const result = await this.pool.query('SELECT 1');
            return result.rowCount === 1;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=Database.js.map