export declare enum SandboxMode {
    DOCKER = "docker",
    HOST = "host",
    MOCK = "mock"
}
interface SandboxConfig {
    memoryLimit: string;
    cpuLimit: string;
    timeout: number;
    networkAccess: boolean;
    readOnly: boolean;
}
export declare class SandboxManager {
    private mode;
    private dockerImage;
    private workspaceBase;
    private config;
    private dockerAvailable;
    constructor(mode?: SandboxMode, config?: Partial<SandboxConfig>);
    private ensureWorkspaceBase;
    private checkDockerAvailability;
    setMode(mode: SandboxMode): void;
    getMode(): SandboxMode;
    isDockerAvailable(): boolean;
    setConfig(config: Partial<SandboxConfig>): void;
    private getUserWorkspace;
    execute(command: string, userId?: string): Promise<string>;
    private sanitizeCommand;
    private executeMock;
    private executeInDocker;
    private executeOnHost;
    private executeInternal;
    private spawnWithTimeout;
    executeScript(code: string, language: 'python' | 'javascript' | 'shell', userId?: string): Promise<{
        success: boolean;
        output: string;
        exitCode: number;
    }>;
    cleanup(userId?: string): Promise<void>;
    getStats(): {
        mode: SandboxMode;
        dockerAvailable: boolean;
        config: SandboxConfig;
    };
}
export {};
//# sourceMappingURL=SandboxManager.d.ts.map