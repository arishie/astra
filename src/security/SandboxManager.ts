import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export enum SandboxMode {
    DOCKER = 'docker',
    HOST = 'host',
    MOCK = 'mock',
}

interface SandboxConfig {
    memoryLimit: string;
    cpuLimit: string;
    timeout: number;
    networkAccess: boolean;
    readOnly: boolean;
}

const DEFAULT_CONFIG: SandboxConfig = {
    memoryLimit: '256m',
    cpuLimit: '0.5',
    timeout: 30000,
    networkAccess: false,
    readOnly: true,
};

export class SandboxManager {
    private mode: SandboxMode;
    private dockerImage: string = 'alpine:latest';
    private workspaceBase: string = './workspaces';
    private config: SandboxConfig;
    private dockerAvailable: boolean = false;

    constructor(mode: SandboxMode = SandboxMode.DOCKER, config: Partial<SandboxConfig> = {}) {
        this.mode = mode;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.ensureWorkspaceBase();
        this.checkDockerAvailability();
    }

    private ensureWorkspaceBase() {
        if (!fs.existsSync(this.workspaceBase)) {
            fs.mkdirSync(this.workspaceBase, { recursive: true });
        }
    }

    private async checkDockerAvailability() {
        if (this.mode === SandboxMode.DOCKER) {
            try {
                const result = await this.executeInternal('docker --version', 5000);
                this.dockerAvailable = true;
                console.log(`[SandboxManager] Docker available: ${result.trim()}`);
            } catch (e) {
                console.warn('[SandboxManager] Docker not available. Falling back to HOST mode (LESS SECURE).');
                console.warn('[SandboxManager] To enable Docker sandboxing, install Docker and ensure it is running.');
                this.dockerAvailable = false;
                this.mode = SandboxMode.HOST;
            }
        }
    }

    public setMode(mode: SandboxMode) {
        this.mode = mode;
        if (mode === SandboxMode.DOCKER) {
            this.checkDockerAvailability();
        }
    }

    public getMode(): SandboxMode {
        return this.mode;
    }

    public isDockerAvailable(): boolean {
        return this.dockerAvailable;
    }

    public setConfig(config: Partial<SandboxConfig>) {
        this.config = { ...this.config, ...config };
    }

    private getUserWorkspace(userId?: string): string {
        const safeUserId = userId
            ? userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32)
            : 'default';
        const workspacePath = path.resolve(this.workspaceBase, safeUserId);

        if (!fs.existsSync(workspacePath)) {
            fs.mkdirSync(workspacePath, { recursive: true });
        }

        return workspacePath;
    }

    public async execute(command: string, userId?: string): Promise<string> {
        const sanitizedCommand = this.sanitizeCommand(command);

        console.log(`[SandboxManager] Executing: "${sanitizedCommand}" in mode: ${this.mode}`);

        switch (this.mode) {
            case SandboxMode.MOCK:
                return this.executeMock(sanitizedCommand);
            case SandboxMode.DOCKER:
                return this.executeInDocker(sanitizedCommand, userId);
            case SandboxMode.HOST:
                return this.executeOnHost(sanitizedCommand, userId);
            default:
                throw new Error(`Unknown sandbox mode: ${this.mode}`);
        }
    }

    private sanitizeCommand(command: string): string {
        const dangerous = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
        for (const pattern of dangerous) {
            if (command.toLowerCase().includes(pattern.toLowerCase())) {
                throw new Error(`Blocked dangerous command pattern: ${pattern}`);
            }
        }
        return command;
    }

    private executeMock(command: string): Promise<string> {
        return Promise.resolve(`[Sandbox-Mock] Would execute: ${command}`);
    }

    private async executeInDocker(command: string, userId?: string): Promise<string> {
        const workspace = this.getUserWorkspace(userId);
        const containerName = `astra-sandbox-${crypto.randomBytes(8).toString('hex')}`;

        const dockerArgs = [
            'run',
            '--rm',
            '--name', containerName,
            '--network', this.config.networkAccess ? 'bridge' : 'none',
            '--memory', this.config.memoryLimit,
            '--cpus', this.config.cpuLimit,
            '--pids-limit', '100',
            '--user', 'nobody:nogroup',
            '--security-opt', 'no-new-privileges',
            '--cap-drop', 'ALL',
        ];

        if (this.config.readOnly) {
            dockerArgs.push('--read-only');
            dockerArgs.push('--tmpfs', '/tmp:rw,noexec,nosuid,size=64m');
        }

        dockerArgs.push(
            '-v', `${workspace}:/workspace:rw`,
            '-w', '/workspace',
            this.dockerImage,
            'sh', '-c', command
        );

        return this.spawnWithTimeout('docker', dockerArgs, this.config.timeout);
    }

    private async executeOnHost(command: string, userId?: string): Promise<string> {
        console.warn('[SandboxManager] Executing on HOST. This is less secure than Docker mode.');

        const workspace = this.getUserWorkspace(userId);
        const fullCommand = `cd "${workspace}" && ${command}`;

        return this.spawnWithTimeout('sh', ['-c', fullCommand], this.config.timeout);
    }

    private executeInternal(command: string, timeout: number = 10000): Promise<string> {
        return this.spawnWithTimeout('sh', ['-c', command], timeout);
    }

    private spawnWithTimeout(cmd: string, args: string[], timeout: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, {
                timeout,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';
            let killed = false;

            const timer = setTimeout(() => {
                killed = true;
                child.kill('SIGKILL');
                reject(new Error(`Command timed out after ${timeout}ms`));
            }, timeout);

            child.stdout.on('data', (data) => {
                stdout += data.toString();
                if (stdout.length > 1024 * 1024) {
                    child.kill('SIGTERM');
                    reject(new Error('Output exceeded 1MB limit'));
                }
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                clearTimeout(timer);

                if (killed) return;

                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Exit code ${code}: ${stderr || stdout || 'No output'}`));
                }
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                if (!killed) {
                    reject(err);
                }
            });
        });
    }

    public async executeScript(
        code: string,
        language: 'python' | 'javascript' | 'shell',
        userId?: string
    ): Promise<{ success: boolean; output: string; exitCode: number }> {
        const workspace = this.getUserWorkspace(userId);
        const scriptId = crypto.randomBytes(8).toString('hex');

        let filename: string;
        let interpreter: string;

        switch (language) {
            case 'python':
                filename = `script_${scriptId}.py`;
                interpreter = 'python3';
                break;
            case 'javascript':
                filename = `script_${scriptId}.js`;
                interpreter = 'node';
                break;
            case 'shell':
                filename = `script_${scriptId}.sh`;
                interpreter = 'sh';
                break;
            default:
                return { success: false, output: 'Unsupported language', exitCode: 1 };
        }

        const scriptPath = path.join(workspace, filename);

        try {
            fs.writeFileSync(scriptPath, code, { mode: 0o644 });

            const output = await this.execute(`${interpreter} ${filename}`, userId);

            return { success: true, output, exitCode: 0 };
        } catch (error: any) {
            return {
                success: false,
                output: error.message || 'Execution failed',
                exitCode: error.code || 1,
            };
        } finally {
            try {
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
            } catch {
            }
        }
    }

    public async cleanup(userId?: string): Promise<void> {
        const workspace = this.getUserWorkspace(userId);

        try {
            const files = fs.readdirSync(workspace);
            for (const file of files) {
                if (file.startsWith('script_') || file.startsWith('temp_')) {
                    fs.unlinkSync(path.join(workspace, file));
                }
            }
            console.log(`[SandboxManager] Cleaned up workspace for user: ${userId || 'default'}`);
        } catch (error) {
            console.error(`[SandboxManager] Cleanup failed: ${error}`);
        }
    }

    public getStats(): {
        mode: SandboxMode;
        dockerAvailable: boolean;
        config: SandboxConfig;
    } {
        return {
            mode: this.mode,
            dockerAvailable: this.dockerAvailable,
            config: this.config,
        };
    }
}
