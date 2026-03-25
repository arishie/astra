import { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
export interface DatabaseConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean | {
        rejectUnauthorized: boolean;
    };
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}
export declare class Database {
    private static instance;
    private pool;
    private isConnected;
    private constructor();
    static getInstance(): Database;
    connect(config?: DatabaseConfig): Promise<void>;
    private getConfigFromEnv;
    query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
    getClient(): Promise<PoolClient>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    disconnect(): Promise<void>;
    isReady(): boolean;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=Database.d.ts.map