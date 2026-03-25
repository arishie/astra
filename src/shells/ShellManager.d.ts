/**
 * ShellManager.ts - Multi-Agent Coordination System
 *
 * Manages multiple shells (AI agents), handles communication between them,
 * provides supervision, and integrates with n8n workflows.
 *
 * Think of this as the "control room" for all your AI agents.
 */
import { EventEmitter } from 'events';
import { Shell } from './Shell.js';
import type { ShellConfig, ShellMessage, ShellTask, ShellState, ShellRole, ShellCapability } from './Shell.js';
/** Workflow definition - a series of connected shells */
export interface ShellWorkflow {
    id: string;
    name: string;
    description: string;
    shells: string[];
    connections: WorkflowConnection[];
    triggers: WorkflowTrigger[];
    status: 'draft' | 'active' | 'paused' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}
/** Connection between shells in a workflow */
export interface WorkflowConnection {
    from: string;
    to: string;
    condition?: string;
    transform?: string;
}
/** What triggers a workflow */
export interface WorkflowTrigger {
    type: 'manual' | 'schedule' | 'webhook' | 'message' | 'event';
    config: Record<string, any>;
}
/** Shell template for quick creation */
export interface ShellTemplate {
    id: string;
    name: string;
    description: string;
    role: ShellRole;
    systemPrompt: string;
    capabilities: ShellCapability[];
    suggestedConnections?: ShellRole[];
    icon?: string;
    category: 'coding' | 'research' | 'writing' | 'analysis' | 'automation' | 'communication';
}
/** Manager statistics */
export interface ManagerStats {
    totalShells: number;
    activeShells: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    messagesExchanged: number;
    uptime: number;
}
/** Supervisor view - aggregated monitoring data */
export interface SupervisorView {
    shells: ShellState[];
    recentMessages: ShellMessage[];
    pendingApprovals: {
        shell: string;
        task: ShellTask;
    }[];
    alerts: SupervisorAlert[];
    stats: ManagerStats;
}
/** Alert for supervisor */
export interface SupervisorAlert {
    id: string;
    type: 'error' | 'warning' | 'info';
    shell: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
}
export declare class ShellManager extends EventEmitter {
    private shells;
    private workflows;
    private messageLog;
    private alerts;
    private completedTasks;
    private startTime;
    private n8nBaseUrl?;
    constructor(options?: {
        n8nBaseUrl?: string;
    });
    /**
     * Create a new shell from config
     */
    createShell(config: ShellConfig): Shell;
    /**
     * Create shell from template
     */
    createFromTemplate(template: ShellTemplate, overrides?: Partial<ShellConfig>): Shell;
    /**
     * Create multiple shells at once
     */
    createShells(configs: ShellConfig[]): Shell[];
    /**
     * Get a shell by ID
     */
    getShell(id: string): Shell | undefined;
    /**
     * Get all shells
     */
    getAllShells(): Shell[];
    /**
     * Get shells by role
     */
    getShellsByRole(role: ShellRole): Shell[];
    /**
     * Remove a shell
     */
    removeShell(id: string): Promise<boolean>;
    /**
     * Wire up shell events to manager
     */
    private wireShellEvents;
    /**
     * Route a message to its destination(s)
     */
    private routeMessage;
    /**
     * Send a message to a shell (from outside the shell system)
     */
    sendToShell(shellId: string, content: string, data?: any): void;
    /**
     * Broadcast a message to all shells
     */
    broadcast(content: string, type?: ShellMessage['type'], data?: any): void;
    /**
     * Create a new workflow
     */
    createWorkflow(config: Omit<ShellWorkflow, 'id' | 'status' | 'createdAt' | 'updatedAt'>): ShellWorkflow;
    /**
     * Start a workflow
     */
    startWorkflow(workflowId: string, input?: any): Promise<void>;
    private getWorkflowStartShells;
    /**
     * Get workflow by ID
     */
    getWorkflow(id: string): ShellWorkflow | undefined;
    /**
     * Get all workflows
     */
    getAllWorkflows(): ShellWorkflow[];
    /**
     * Handle incoming n8n webhook
     */
    handleN8nWebhook(payload: {
        action: 'create_shell' | 'send_message' | 'assign_task' | 'start_workflow' | 'get_status';
        data: any;
    }): Promise<any>;
    /**
     * Trigger n8n workflow
     */
    triggerN8nWorkflow(webhookUrl: string, data: any): Promise<void>;
    /**
     * Get supervisor view - all monitoring data
     */
    getSupervisorView(): SupervisorView;
    /**
     * Get manager statistics
     */
    getStats(): ManagerStats;
    /**
     * Add an alert
     */
    private addAlert;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): void;
    /**
     * Approve a pending task
     */
    approveTask(shellId: string, taskId: string): void;
    /**
     * Reject a pending task
     */
    rejectTask(shellId: string, taskId: string, reason: string): void;
    /**
     * Pause all shells
     */
    pauseAll(): void;
    /**
     * Resume all shells
     */
    resumeAll(): void;
    /**
     * Shutdown manager and all shells
     */
    shutdown(): Promise<void>;
}
export default ShellManager;
//# sourceMappingURL=ShellManager.d.ts.map