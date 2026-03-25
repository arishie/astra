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
/** Shell status */
export type ShellStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error' | 'paused';
/** Shell role/type */
export type ShellRole = 'coder' | 'researcher' | 'writer' | 'analyst' | 'planner' | 'reviewer' | 'executor' | 'communicator' | 'supervisor' | 'custom';
/** Message between shells */
export interface ShellMessage {
    id: string;
    from: string;
    to: string | 'all';
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
    assignedTo: string;
    assignedBy: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    dependencies?: string[];
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
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    capabilities: ShellCapability[];
    canCommunicateWith: string[] | 'all';
    canReceiveFrom: string[] | 'all';
    maxConcurrentTasks?: number;
    taskTimeout?: number;
    maxRetries?: number;
    n8nWebhookUrl?: string;
    n8nTriggers?: N8nTrigger[];
    sharedMemoryAccess?: boolean;
    privateMemory?: boolean;
    requiresApproval?: boolean;
    supervisorId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}
/** Shell capabilities */
export type ShellCapability = 'code_write' | 'code_execute' | 'code_review' | 'web_search' | 'web_browse' | 'file_read' | 'file_write' | 'api_call' | 'database' | 'email_send' | 'message_send' | 'schedule' | 'spawn_shell' | 'terminate_shell' | 'human_escalate';
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
export declare class Shell extends EventEmitter {
    readonly id: string;
    readonly config: ShellConfig;
    private status;
    private taskQueue;
    private currentTask;
    private messageHistory;
    private memory;
    private startTime;
    private completedCount;
    private failedCount;
    private lastActivity;
    constructor(config: ShellConfig);
    getStatus(): ShellStatus;
    setStatus(status: ShellStatus): void;
    getState(): ShellState;
    assignTask(task: Omit<ShellTask, 'id' | 'assignedTo' | 'status' | 'createdAt'>): Promise<ShellTask>;
    private processNextTask;
    private areDependenciesMet;
    private executeTask;
    approveTask(taskId: string): void;
    rejectTask(taskId: string, reason: string): void;
    sendMessage(to: string | 'all', content: string, type?: ShellMessage['type'], data?: any): ShellMessage;
    receiveMessage(message: ShellMessage): void;
    setMemory(key: string, value: any): void;
    getMemory(key: string): any;
    getAllMemory(): Record<string, any>;
    private triggerN8n;
    pause(): void;
    resume(): void;
    shutdown(): Promise<void>;
}
export default Shell;
//# sourceMappingURL=Shell.d.ts.map