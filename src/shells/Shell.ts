/**
 * Shell.ts - Custom AI Agent System
 *
 * A "Shell" is a customizable AI agent that users can create, configure,
 * and connect together. Think of it like a container for AI behavior.
 *
 * Features:
 * - Easy to create and customize
 * - Can communicate with other shells
 * - Integrates with n8n workflows
 * - Can write and execute code
 * - Monitored by a supervisor
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Shell status */
export type ShellStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error' | 'paused';

/** Shell role/type */
export type ShellRole =
    | 'coder'        // Writes and reviews code
    | 'researcher'   // Searches and analyzes information
    | 'writer'       // Creates content and documentation
    | 'analyst'      // Analyzes data and provides insights
    | 'planner'      // Creates plans and breaks down tasks
    | 'reviewer'     // Reviews and critiques work
    | 'executor'     // Executes tasks and commands
    | 'communicator' // Handles external communication
    | 'supervisor'   // Monitors and coordinates other shells
    | 'custom';      // User-defined role

/** Message between shells */
export interface ShellMessage {
    id: string;
    from: string;        // Shell ID
    to: string | 'all';  // Shell ID or broadcast
    type: 'task' | 'response' | 'question' | 'update' | 'error' | 'complete';
    content: string;
    data?: any;
    timestamp: Date;
    priority: 'low' | 'normal' | 'high' | 'urgent';
}

/** Task assigned to a shell */
export interface ShellTask {
    id: string;
    title: string;
    description: string;
    assignedTo: string;   // Shell ID
    assignedBy: string;   // Shell ID or 'user'
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    dependencies?: string[];  // Task IDs that must complete first
    result?: any;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

/** Shell configuration */
export interface ShellConfig {
    id?: string;
    name: string;
    role: ShellRole;
    description: string;

    // Behavior
    systemPrompt: string;
    temperature?: number;       // 0-1, creativity level
    maxTokens?: number;

    // Capabilities
    capabilities: ShellCapability[];

    // Communication
    canCommunicateWith: string[] | 'all';  // Shell IDs or 'all'
    canReceiveFrom: string[] | 'all';

    // Execution limits
    maxConcurrentTasks?: number;
    taskTimeout?: number;        // milliseconds
    maxRetries?: number;

    // n8n integration
    n8nWebhookUrl?: string;
    n8nTriggers?: N8nTrigger[];

    // Memory
    sharedMemoryAccess?: boolean;
    privateMemory?: boolean;

    // Supervision
    requiresApproval?: boolean;  // Human approval before executing
    supervisorId?: string;       // Shell that supervises this one

    // Metadata
    tags?: string[];
    metadata?: Record<string, any>;
}

/** Shell capabilities */
export type ShellCapability =
    | 'code_write'       // Can write code
    | 'code_execute'     // Can execute code
    | 'code_review'      // Can review code
    | 'web_search'       // Can search the web
    | 'web_browse'       // Can browse websites
    | 'file_read'        // Can read files
    | 'file_write'       // Can write files
    | 'api_call'         // Can make API calls
    | 'database'         // Can access database
    | 'email_send'       // Can send emails
    | 'message_send'     // Can send messages (WhatsApp/Telegram)
    | 'schedule'         // Can schedule tasks
    | 'spawn_shell'      // Can create new shells
    | 'terminate_shell'  // Can terminate other shells
    | 'human_escalate';  // Can escalate to human

/** n8n trigger configuration */
export interface N8nTrigger {
    event: 'task_complete' | 'task_failed' | 'message_received' | 'status_change' | 'custom';
    webhookUrl: string;
    payload?: Record<string, any>;
    conditions?: Record<string, any>;
}

/** Shell state snapshot */
export interface ShellState {
    id: string;
    name: string;
    role: ShellRole;
    status: ShellStatus;
    currentTask?: ShellTask;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    lastActivity: Date;
    uptime: number;
    memoryUsage?: number;
    error?: string;
}

// ============================================================================
// Shell Class - Individual AI Agent
// ============================================================================

export class Shell extends EventEmitter {
    public readonly id: string;
    public readonly config: ShellConfig;
    private status: ShellStatus = 'idle';
    private taskQueue: ShellTask[] = [];
    private currentTask: ShellTask | null = null;
    private messageHistory: ShellMessage[] = [];
    private memory: Map<string, any> = new Map();
    private startTime: Date;
    private completedCount: number = 0;
    private failedCount: number = 0;
    private lastActivity: Date;

    constructor(config: ShellConfig) {
        super();
        this.id = config.id || `shell_${crypto.randomBytes(8).toString('hex')}`;
        this.config = {
            ...config,
            id: this.id,
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 4096,
            maxConcurrentTasks: config.maxConcurrentTasks ?? 1,
            taskTimeout: config.taskTimeout ?? 300000, // 5 minutes
            maxRetries: config.maxRetries ?? 3,
        };
        this.startTime = new Date();
        this.lastActivity = new Date();
    }

    // ---- Status Management ----

    public getStatus(): ShellStatus {
        return this.status;
    }

    public setStatus(status: ShellStatus): void {
        const oldStatus = this.status;
        this.status = status;
        this.lastActivity = new Date();
        this.emit('statusChange', { shell: this.id, from: oldStatus, to: status });

        // Trigger n8n webhook if configured
        this.triggerN8n('status_change', { from: oldStatus, to: status });
    }

    public getState(): ShellState {
        return {
            id: this.id,
            name: this.config.name,
            role: this.config.role,
            status: this.status,
            currentTask: this.currentTask || undefined,
            pendingTasks: this.taskQueue.length,
            completedTasks: this.completedCount,
            failedTasks: this.failedCount,
            lastActivity: this.lastActivity,
            uptime: Date.now() - this.startTime.getTime(),
        };
    }

    // ---- Task Management ----

    public async assignTask(task: Omit<ShellTask, 'id' | 'assignedTo' | 'status' | 'createdAt'>): Promise<ShellTask> {
        const newTask: ShellTask = {
            id: `task_${crypto.randomBytes(8).toString('hex')}`,
            assignedTo: this.id,
            status: 'pending',
            createdAt: new Date(),
            ...task,
        };

        this.taskQueue.push(newTask);
        this.emit('taskAssigned', { shell: this.id, task: newTask });

        // Start processing if idle
        if (this.status === 'idle') {
            this.processNextTask();
        }

        return newTask;
    }

    private async processNextTask(): Promise<void> {
        if (this.taskQueue.length === 0) {
            this.setStatus('idle');
            return;
        }

        // Check dependencies
        const readyTask = this.taskQueue.find(t => this.areDependenciesMet(t));
        if (!readyTask) {
            this.setStatus('waiting');
            return;
        }

        // Remove from queue
        this.taskQueue = this.taskQueue.filter(t => t.id !== readyTask.id);
        this.currentTask = readyTask;
        this.currentTask.status = 'in_progress';
        this.currentTask.startedAt = new Date();

        this.setStatus('thinking');
        this.emit('taskStarted', { shell: this.id, task: this.currentTask });

        try {
            // Check if approval is required
            if (this.config.requiresApproval) {
                this.setStatus('waiting');
                this.emit('approvalRequired', { shell: this.id, task: this.currentTask });
                return; // Wait for approval
            }

            // Execute the task
            const result = await this.executeTask(this.currentTask);

            this.currentTask.status = 'completed';
            this.currentTask.result = result;
            this.currentTask.completedAt = new Date();
            this.completedCount++;

            this.emit('taskCompleted', { shell: this.id, task: this.currentTask, result });
            this.triggerN8n('task_complete', { task: this.currentTask, result });

        } catch (error) {
            this.currentTask.status = 'failed';
            this.currentTask.error = error instanceof Error ? error.message : String(error);
            this.currentTask.completedAt = new Date();
            this.failedCount++;

            this.emit('taskFailed', { shell: this.id, task: this.currentTask, error });
            this.triggerN8n('task_failed', { task: this.currentTask, error: this.currentTask.error });
        }

        this.currentTask = null;
        this.processNextTask();
    }

    private areDependenciesMet(task: ShellTask): boolean {
        if (!task.dependencies || task.dependencies.length === 0) {
            return true;
        }
        // Would check against completed tasks from ShellManager
        return true;
    }

    private async executeTask(task: ShellTask): Promise<any> {
        this.setStatus('executing');

        // In production, this would:
        // 1. Build a prompt from task + system prompt
        // 2. Call LLM
        // 3. Parse response and execute actions based on capabilities
        // 4. Return result

        // Simulated execution
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            success: true,
            output: `Task "${task.title}" completed by ${this.config.name}`,
            timestamp: new Date(),
        };
    }

    public approveTask(taskId: string): void {
        if (this.currentTask?.id === taskId && this.status === 'waiting') {
            this.processNextTask();
        }
    }

    public rejectTask(taskId: string, reason: string): void {
        if (this.currentTask?.id === taskId) {
            this.currentTask.status = 'cancelled';
            this.currentTask.error = `Rejected: ${reason}`;
            this.currentTask = null;
            this.processNextTask();
        }
    }

    // ---- Messaging ----

    public sendMessage(to: string | 'all', content: string, type: ShellMessage['type'] = 'update', data?: any): ShellMessage {
        const message: ShellMessage = {
            id: `msg_${crypto.randomBytes(8).toString('hex')}`,
            from: this.id,
            to,
            type,
            content,
            data,
            timestamp: new Date(),
            priority: 'normal',
        };

        this.messageHistory.push(message);
        this.emit('messageSent', message);
        this.triggerN8n('message_received', { message });

        return message;
    }

    public receiveMessage(message: ShellMessage): void {
        // Check if we can receive from this sender
        if (this.config.canReceiveFrom !== 'all') {
            if (!this.config.canReceiveFrom.includes(message.from)) {
                return; // Ignore message from unauthorized sender
            }
        }

        this.messageHistory.push(message);
        this.lastActivity = new Date();
        this.emit('messageReceived', message);

        // Handle different message types
        if (message.type === 'task') {
            // Convert message to task
            this.assignTask({
                title: message.content,
                description: message.data?.description || message.content,
                assignedBy: message.from,
                priority: message.priority,
            });
        }
    }

    // ---- Memory ----

    public setMemory(key: string, value: any): void {
        this.memory.set(key, value);
        this.emit('memoryUpdated', { shell: this.id, key, value });
    }

    public getMemory(key: string): any {
        return this.memory.get(key);
    }

    public getAllMemory(): Record<string, any> {
        return Object.fromEntries(this.memory);
    }

    // ---- n8n Integration ----

    private async triggerN8n(event: N8nTrigger['event'], data: any): Promise<void> {
        if (!this.config.n8nTriggers) return;

        const triggers = this.config.n8nTriggers.filter(t => t.event === event);

        for (const trigger of triggers) {
            try {
                const payload = {
                    shellId: this.id,
                    shellName: this.config.name,
                    event,
                    timestamp: new Date().toISOString(),
                    ...trigger.payload,
                    ...data,
                };

                await fetch(trigger.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                this.emit('n8nTriggered', { shell: this.id, event, webhookUrl: trigger.webhookUrl });
            } catch (error) {
                console.error(`[Shell ${this.id}] n8n trigger failed:`, error);
            }
        }
    }

    // ---- Lifecycle ----

    public pause(): void {
        this.setStatus('paused');
    }

    public resume(): void {
        if (this.status === 'paused') {
            this.processNextTask();
        }
    }

    public async shutdown(): Promise<void> {
        this.setStatus('idle');
        this.taskQueue = [];
        this.currentTask = null;
        this.emit('shutdown', { shell: this.id });
    }
}

// ============================================================================
// Export
// ============================================================================

export default Shell;
