/**
 * ShellManager.ts - Multi-Agent Coordination System
 *
 * Manages multiple shells (AI agents), handles communication between them,
 * provides supervision, and integrates with n8n workflows.
 *
 * Think of this as the "control room" for all your AI agents.
 */
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { Shell } from './Shell.js';
// ============================================================================
// Shell Manager
// ============================================================================
export class ShellManager extends EventEmitter {
    shells = new Map();
    workflows = new Map();
    messageLog = [];
    alerts = [];
    completedTasks = new Map();
    startTime;
    n8nBaseUrl;
    constructor(options = {}) {
        super();
        this.n8nBaseUrl = options.n8nBaseUrl;
        this.startTime = new Date();
    }
    // ============================================================================
    // Shell Management
    // ============================================================================
    /**
     * Create a new shell from config
     */
    createShell(config) {
        const shell = new Shell(config);
        this.shells.set(shell.id, shell);
        // Wire up events
        this.wireShellEvents(shell);
        this.emit('shellCreated', { shell: shell.id, name: config.name, role: config.role });
        console.log(`[ShellManager] Created shell: ${config.name} (${shell.id})`);
        return shell;
    }
    /**
     * Create shell from template
     */
    createFromTemplate(template, overrides) {
        const config = {
            name: template.name,
            role: template.role,
            description: template.description,
            systemPrompt: template.systemPrompt,
            capabilities: template.capabilities,
            canCommunicateWith: 'all',
            canReceiveFrom: 'all',
            ...overrides,
        };
        return this.createShell(config);
    }
    /**
     * Create multiple shells at once
     */
    createShells(configs) {
        return configs.map(config => this.createShell(config));
    }
    /**
     * Get a shell by ID
     */
    getShell(id) {
        return this.shells.get(id);
    }
    /**
     * Get all shells
     */
    getAllShells() {
        return Array.from(this.shells.values());
    }
    /**
     * Get shells by role
     */
    getShellsByRole(role) {
        return this.getAllShells().filter(s => s.config.role === role);
    }
    /**
     * Remove a shell
     */
    async removeShell(id) {
        const shell = this.shells.get(id);
        if (!shell)
            return false;
        await shell.shutdown();
        this.shells.delete(id);
        this.emit('shellRemoved', { shell: id });
        console.log(`[ShellManager] Removed shell: ${id}`);
        return true;
    }
    /**
     * Wire up shell events to manager
     */
    wireShellEvents(shell) {
        shell.on('messageSent', (message) => {
            this.routeMessage(message);
        });
        shell.on('taskCompleted', ({ task }) => {
            this.completedTasks.set(task.id, task);
            this.emit('taskCompleted', { shell: shell.id, task });
        });
        shell.on('taskFailed', ({ task, error }) => {
            this.addAlert('error', shell.id, `Task failed: ${error}`);
            this.emit('taskFailed', { shell: shell.id, task, error });
        });
        shell.on('approvalRequired', ({ task }) => {
            this.addAlert('info', shell.id, `Approval required for: ${task.title}`);
            this.emit('approvalRequired', { shell: shell.id, task });
        });
        shell.on('statusChange', ({ from, to }) => {
            if (to === 'error') {
                this.addAlert('error', shell.id, `Shell entered error state`);
            }
            this.emit('shellStatusChange', { shell: shell.id, from, to });
        });
    }
    // ============================================================================
    // Message Routing
    // ============================================================================
    /**
     * Route a message to its destination(s)
     */
    routeMessage(message) {
        this.messageLog.push(message);
        if (message.to === 'all') {
            // Broadcast to all shells except sender
            for (const [id, shell] of this.shells) {
                if (id !== message.from) {
                    shell.receiveMessage(message);
                }
            }
        }
        else {
            // Direct message
            const target = this.shells.get(message.to);
            if (target) {
                target.receiveMessage(message);
            }
            else {
                console.warn(`[ShellManager] Message target not found: ${message.to}`);
            }
        }
        this.emit('messageRouted', message);
    }
    /**
     * Send a message to a shell (from outside the shell system)
     */
    sendToShell(shellId, content, data) {
        const message = {
            id: `msg_${crypto.randomBytes(8).toString('hex')}`,
            from: 'manager',
            to: shellId,
            type: 'task',
            content,
            data,
            timestamp: new Date(),
            priority: 'normal',
        };
        const shell = this.shells.get(shellId);
        if (shell) {
            shell.receiveMessage(message);
        }
    }
    /**
     * Broadcast a message to all shells
     */
    broadcast(content, type = 'update', data) {
        const message = {
            id: `msg_${crypto.randomBytes(8).toString('hex')}`,
            from: 'manager',
            to: 'all',
            type,
            content,
            data,
            timestamp: new Date(),
            priority: 'normal',
        };
        for (const shell of this.shells.values()) {
            shell.receiveMessage(message);
        }
    }
    // ============================================================================
    // Workflow Management
    // ============================================================================
    /**
     * Create a new workflow
     */
    createWorkflow(config) {
        const workflow = {
            id: `workflow_${crypto.randomBytes(8).toString('hex')}`,
            status: 'draft',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...config,
        };
        this.workflows.set(workflow.id, workflow);
        this.emit('workflowCreated', workflow);
        return workflow;
    }
    /**
     * Start a workflow
     */
    async startWorkflow(workflowId, input) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        workflow.status = 'active';
        workflow.updatedAt = new Date();
        // Start the first shell(s) in the workflow
        const startShells = this.getWorkflowStartShells(workflow);
        for (const shellId of startShells) {
            this.sendToShell(shellId, `Start workflow: ${workflow.name}`, { workflowId, input });
        }
        this.emit('workflowStarted', { workflow: workflowId, input });
    }
    getWorkflowStartShells(workflow) {
        // Find shells that have no incoming connections
        const hasIncoming = new Set(workflow.connections.map(c => c.to));
        return workflow.shells.filter(id => !hasIncoming.has(id));
    }
    /**
     * Get workflow by ID
     */
    getWorkflow(id) {
        return this.workflows.get(id);
    }
    /**
     * Get all workflows
     */
    getAllWorkflows() {
        return Array.from(this.workflows.values());
    }
    // ============================================================================
    // n8n Integration
    // ============================================================================
    /**
     * Handle incoming n8n webhook
     */
    async handleN8nWebhook(payload) {
        switch (payload.action) {
            case 'create_shell':
                const shell = this.createShell(payload.data);
                return { shellId: shell.id, status: 'created' };
            case 'send_message':
                this.sendToShell(payload.data.shellId, payload.data.message, payload.data.data);
                return { status: 'sent' };
            case 'assign_task':
                const targetShell = this.getShell(payload.data.shellId);
                if (targetShell) {
                    const task = await targetShell.assignTask(payload.data.task);
                    return { taskId: task.id, status: 'assigned' };
                }
                return { error: 'Shell not found' };
            case 'start_workflow':
                await this.startWorkflow(payload.data.workflowId, payload.data.input);
                return { status: 'started' };
            case 'get_status':
                return this.getSupervisorView();
            default:
                return { error: 'Unknown action' };
        }
    }
    /**
     * Trigger n8n workflow
     */
    async triggerN8nWorkflow(webhookUrl, data) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'astra-shell-manager',
                    timestamp: new Date().toISOString(),
                    ...data,
                }),
            });
            console.log(`[ShellManager] Triggered n8n workflow: ${webhookUrl}`);
        }
        catch (error) {
            console.error(`[ShellManager] Failed to trigger n8n:`, error);
        }
    }
    // ============================================================================
    // Supervision & Monitoring
    // ============================================================================
    /**
     * Get supervisor view - all monitoring data
     */
    getSupervisorView() {
        const shells = this.getAllShells().map(s => s.getState());
        const recentMessages = this.messageLog.slice(-50);
        const pendingApprovals = [];
        // Find shells waiting for approval
        for (const shell of this.getAllShells()) {
            const state = shell.getState();
            if (state.status === 'waiting' && state.currentTask) {
                pendingApprovals.push({ shell: shell.id, task: state.currentTask });
            }
        }
        return {
            shells,
            recentMessages,
            pendingApprovals,
            alerts: this.alerts.filter(a => !a.acknowledged).slice(-20),
            stats: this.getStats(),
        };
    }
    /**
     * Get manager statistics
     */
    getStats() {
        let completedTasks = 0;
        let failedTasks = 0;
        let activeShells = 0;
        for (const shell of this.getAllShells()) {
            const state = shell.getState();
            completedTasks += state.completedTasks;
            failedTasks += state.failedTasks;
            if (state.status !== 'idle' && state.status !== 'paused') {
                activeShells++;
            }
        }
        return {
            totalShells: this.shells.size,
            activeShells,
            totalTasks: completedTasks + failedTasks,
            completedTasks,
            failedTasks,
            messagesExchanged: this.messageLog.length,
            uptime: Date.now() - this.startTime.getTime(),
        };
    }
    /**
     * Add an alert
     */
    addAlert(type, shell, message) {
        const alert = {
            id: `alert_${crypto.randomBytes(8).toString('hex')}`,
            type,
            shell,
            message,
            timestamp: new Date(),
            acknowledged: false,
        };
        this.alerts.push(alert);
        this.emit('alert', alert);
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
        }
    }
    /**
     * Approve a pending task
     */
    approveTask(shellId, taskId) {
        const shell = this.getShell(shellId);
        if (shell) {
            shell.approveTask(taskId);
            this.emit('taskApproved', { shell: shellId, task: taskId });
        }
    }
    /**
     * Reject a pending task
     */
    rejectTask(shellId, taskId, reason) {
        const shell = this.getShell(shellId);
        if (shell) {
            shell.rejectTask(taskId, reason);
            this.emit('taskRejected', { shell: shellId, task: taskId, reason });
        }
    }
    // ============================================================================
    // Lifecycle
    // ============================================================================
    /**
     * Pause all shells
     */
    pauseAll() {
        for (const shell of this.shells.values()) {
            shell.pause();
        }
        this.emit('allPaused');
    }
    /**
     * Resume all shells
     */
    resumeAll() {
        for (const shell of this.shells.values()) {
            shell.resume();
        }
        this.emit('allResumed');
    }
    /**
     * Shutdown manager and all shells
     */
    async shutdown() {
        console.log('[ShellManager] Shutting down...');
        for (const shell of this.shells.values()) {
            await shell.shutdown();
        }
        this.shells.clear();
        this.workflows.clear();
        this.emit('shutdown');
        console.log('[ShellManager] Shutdown complete');
    }
}
// ============================================================================
// Export
// ============================================================================
export default ShellManager;
//# sourceMappingURL=ShellManager.js.map