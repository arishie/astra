interface CheckResult {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    required: boolean;
}
/**
 * Startup health check to verify all required services are available.
 * Run this before starting the server to catch configuration issues early.
 */
export declare class StartupHealthCheck {
    private results;
    /**
     * Run all health checks.
     * Returns true if all required checks pass.
     */
    runAll(): Promise<boolean>;
    private checkEnvironment;
    private checkDatabase;
    private checkRedis;
    private checkDirectories;
    private addResult;
    private printResults;
    /**
     * Get results as JSON (for API endpoint).
     */
    getResults(): CheckResult[];
}
export default StartupHealthCheck;
//# sourceMappingURL=HealthCheck.d.ts.map