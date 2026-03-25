import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
export var SandboxMode;
(function (SandboxMode) {
    SandboxMode["DOCKER"] = "docker";
    SandboxMode["HOST"] = "host";
    SandboxMode["MOCK"] = "mock";
})(SandboxMode || (SandboxMode = {}));
const DEFAULT_CONFIG = {
    memoryLimit: '256m',
    cpuLimit: '0.5',
    timeout: 30000,
    networkAccess: false,
    readOnly: true,
};
export class SandboxManager {
    mode;
    dockerImage = 'alpine:latest';
    workspaceBase = './workspaces';
    config;
    dockerAvailable = false;
    constructor(mode = SandboxMode.DOCKER, config = {}) {
        this.mode = mode;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.ensureWorkspaceBase();
        this.checkDockerAvailability();
    }
    ensureWorkspaceBase() {
        if (!fs.existsSync(this.workspaceBase)) {
            fs.mkdirSync(this.workspaceBase, { recursive: true });
        }
    }
    async checkDockerAvailability() {
        if (this.mode === SandboxMode.DOCKER) {
            try {
                const result = await this.executeInternal('docker --version', 5000);
                this.dockerAvailable = true;
                console.log(`[SandboxManager] Docker available: ${result.trim()}`);
            }
            catch (e) {
                console.warn('[SandboxManager] Docker not available. Falling back to HOST mode (LESS SECURE).');
                console.warn('[SandboxManager] To enable Docker sandboxing, install Docker and ensure it is running.');
                this.dockerAvailable = false;
                this.mode = SandboxMode.HOST;
            }
        }
    }
    setMode(mode) {
        this.mode = mode;
        if (mode === SandboxMode.DOCKER) {
            this.checkDockerAvailability();
        }
    }
    getMode() {
        return this.mode;
    }
    isDockerAvailable() {
        return this.dockerAvailable;
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getUserWorkspace(userId) {
        const safeUserId = userId
            ? userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32)
            : 'default';
        const workspacePath = path.resolve(this.workspaceBase, safeUserId);
        if (!fs.existsSync(workspacePath)) {
            fs.mkdirSync(workspacePath, { recursive: true });
        }
        return workspacePath;
    }
    async execute(command, userId) {
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
    sanitizeCommand(command) {
        const dangerous = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
        for (const pattern of dangerous) {
            if (command.toLowerCase().includes(pattern.toLowerCase())) {
                throw new Error(`Blocked dangerous command pattern: ${pattern}`);
            }
        }
        return command;
    }
    executeMock(command) {
        return Promise.resolve(`[Sandbox-Mock] Would execute: ${command}`);
    }
    async executeInDocker(command, userId) {
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
        dockerArgs.push('-v', `${workspace}:/workspace:rw`, '-w', '/workspace', this.dockerImage, 'sh', '-c', command);
        return this.spawnWithTimeout('docker', dockerArgs, this.config.timeout);
    }
    async executeOnHost(command, userId) {
        console.warn('[SandboxManager] Executing on HOST. This is less secure than Docker mode.');
        const workspace = this.getUserWorkspace(userId);
        const fullCommand = `cd "${workspace}" && ${command}`;
        return this.spawnWithTimeout('sh', ['-c', fullCommand], this.config.timeout);
    }
    executeInternal(command, timeout = 10000) {
        return this.spawnWithTimeout('sh', ['-c', command], timeout);
    }
    spawnWithTimeout(cmd, args, timeout) {
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
                if (killed)
                    return;
                if (code === 0) {
                    resolve(stdout.trim());
                }
                else {
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
    async executeScript(code, language, userId) {
        const workspace = this.getUserWorkspace(userId);
        const scriptId = crypto.randomBytes(8).toString('hex');
        let filename;
        let interpreter;
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
        }
        catch (error) {
            return {
                success: false,
                output: error.message || 'Execution failed',
                exitCode: error.code || 1,
            };
        }
        finally {
            try {
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
            }
            catch {
            }
        }
    }
    async cleanup(userId) {
        const workspace = this.getUserWorkspace(userId);
        try {
            const files = fs.readdirSync(workspace);
            for (const file of files) {
                if (file.startsWith('script_') || file.startsWith('temp_')) {
                    fs.unlinkSync(path.join(workspace, file));
                }
            }
            console.log(`[SandboxManager] Cleaned up workspace for user: ${userId || 'default'}`);
        }
        catch (error) {
            console.error(`[SandboxManager] Cleanup failed: ${error}`);
        }
    }
    getStats() {
        return {
            mode: this.mode,
            dockerAvailable: this.dockerAvailable,
            config: this.config,
        };
    }
}
//# sourceMappingURL=SandboxManager.js.map